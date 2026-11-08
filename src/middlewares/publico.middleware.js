// ========================================
// Importaciones
// ========================================
const { verificarToken } = require("../utils/jwt.util");
const usuariosService = require("../services/usuarios.service");

// ========================================
// Quién ve el catálogo completo
// ========================================
// El mostrador necesita ver lo que el público no: un evento desactivado, una
// función cancelada o una localidad fuera de servicio siguen existiendo para
// quien las administra.
const ROLES_DE_MOSTRADOR = ["administrador", "taquilla"];

// ========================================
// Sesión opcional
// Identifica si hay token, y si no lo hay sigue adelante
// ========================================
// A diferencia de autenticarJWT, esto nunca responde 401: las rutas que lo
// usan son públicas. Solo sirve para saber si quien pregunta es del mostrador,
// y enseñarle entonces el catálogo completo.
//
// Un token roto o caducado se trata como si no hubiera ninguno. No se le
// avisa al cliente, porque en una ruta pública eso no es un error.
const sesionOpcional = async (req, res, next) => {
  const cabecera = req.get("Authorization");

  if (!cabecera) return next();

  const [esquema, token] = cabecera.split(" ");

  if (esquema !== "Bearer" || !token) return next();

  try {
    const carga = verificarToken(token);
    const usuario = await usuariosService.obtenerUsuarioPorId(Number(carga.sub));

    // Las mismas comprobaciones que la ruta privada: cuenta viva y token que
    // no haya quedado revocado por un cambio de contraseña.
    if (
      usuario &&
      usuario.activo &&
      Number.isSafeInteger(carga.vs) &&
      carga.vs === usuario.versionSesion
    ) {
      req.usuario = { id: usuario.id, email: usuario.email, rol: usuario.rol };
    }
  } catch (error) {
    // Un token inválido en una ruta pública no es motivo de error: se ignora
    // y la petición continúa como anónima.
  }

  next();
};

// ========================================
// ¿Esta petición ve el catálogo completo?
// ========================================
const esMostrador = (req) =>
  Boolean(req.usuario && ROLES_DE_MOSTRADOR.includes(req.usuario.rol));

// ========================================
// Qué se muestra al público
// ========================================
// Un evento desactivado no se anuncia. Una función solo aparece cuando hay
// algo que hacer con ella: comprar, o saber que ya no quedan butacas. Las
// programadas todavía no se anuncian, y las canceladas y finalizadas ya no
// interesan a quien busca qué ver esta semana.
const ESTADOS_PUBLICOS = ["en_venta", "agotada", "en_curso"];

const filtrarEventos = (lista, req) =>
  esMostrador(req) ? lista : lista.filter((e) => e.activo);

const filtrarFunciones = (lista, req) =>
  esMostrador(req)
    ? lista
    : lista.filter((f) => ESTADOS_PUBLICOS.includes(f.estado));

const filtrarLocalidades = (lista, req) =>
  esMostrador(req) ? lista : lista.filter((l) => l.activa);

// ========================================
// ¿Se puede enseñar este registro suelto?
// ========================================
// Un GET por id de algo que el público no debería ver responde 404, no 403:
// decir "existe pero no te lo enseño" ya es contar algo.
const visibleEvento = (evento, req) => esMostrador(req) || evento.activo;

const visibleFuncion = (funcion, req) =>
  esMostrador(req) || ESTADOS_PUBLICOS.includes(funcion.estado);

const visibleLocalidad = (localidad, req) => esMostrador(req) || localidad.activa;

// ========================================
// Exportaciones
// ========================================
module.exports = {
  ESTADOS_PUBLICOS,
  sesionOpcional,
  esMostrador,
  filtrarEventos,
  filtrarFunciones,
  filtrarLocalidades,
  visibleEvento,
  visibleFuncion,
  visibleLocalidad
};
