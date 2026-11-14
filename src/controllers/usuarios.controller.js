// ========================================
// Importaciones
// ========================================
const { matchedData } = require("express-validator");

const usuariosService = require("../services/usuarios.service");

// ========================================
// Lectura del cuerpo
// ========================================
// matchedData devuelve solo los campos declarados en el validador, por lo que
// cualquier campo extra enviado por el cliente se descarta. Es la protección
// contra Mass Assignment: nunca se lee req.body directamente. Aquí importa el
// doble, porque el cuerpo sí trae un rol: lo que no se declara, como id,
// activo o passwordHash, no llega ni al service.
const leerDatos = (req) => matchedData(req, { locations: ["body"] });

// ========================================
// Respuesta pública de un usuario
// El passwordHash JAMÁS sale de la API
// ========================================
const usuarioPublico = (usuario) => ({
  id: usuario.id,
  nombre: usuario.nombre,
  email: usuario.email,
  rol: usuario.rol,
  activo: usuario.activo
});

// ========================================
// POST /api/usuarios
// Solo un administrador llega hasta aquí, y solo otorga taquilla o administrador
// ========================================
const crearUsuario = async (req, res, next) => {
  try {
    const datos = leerDatos(req);

    if (await usuariosService.obtenerUsuarioPorEmail(datos.email)) {
      return res.status(409).json({
        mensaje: "Ya existe un usuario con ese correo electrónico"
      });
    }

    const usuario = await usuariosService.crearUsuarioAdministrativo(datos);

    res.status(201).json({
      mensaje: "Usuario creado correctamente",
      usuario: usuarioPublico(usuario)
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// GET /api/usuarios
// ========================================
const listarUsuarios = async (req, res, next) => {
  try {
    const filtros = matchedData(req, { locations: ["query"] });

    const resultado = await usuariosService.listarUsuarios({
      q: filtros.q ?? "",
      rol: filtros.rol ?? null,
      activo: filtros.activo === undefined ? null : filtros.activo === "true",
      pagina: filtros.pagina ?? 1
    });

    res.set("Cache-Control", "no-store");
    res.status(200).json(resultado);
  } catch (error) {
    next(error);
  }
};

// ========================================
// GET /api/usuarios/busqueda-recuperacion
// ========================================
const buscarParaRecuperacion = async (req, res, next) => {
  try {
    const { q } = matchedData(req, { locations: ["query"] });
    const usuarios = await usuariosService.buscarParaRecuperacion(q);

    res.set("Cache-Control", "no-store");
    res.status(200).json({ usuarios });
  } catch (error) {
    next(error);
  }
};

// ========================================
// PUT /api/usuarios/:id
// ========================================
const actualizarUsuario = async (req, res, next) => {
  try {
    const datos = leerDatos(req);
    const usuario = await usuariosService.actualizarUsuario(req.params.id, datos);

    if (!usuario) {
      return res.status(404).json({ mensaje: "Usuario no encontrado" });
    }

    res.set("Cache-Control", "no-store");
    res.status(200).json({ mensaje: "Usuario actualizado correctamente", usuario });
  } catch (error) {
    next(error);
  }
};

// ========================================
// PATCH /api/usuarios/:id/estado
// ========================================
const RESPUESTAS_ESTADO = {
  PROPIA: [409, "No puede desactivar su propia cuenta"],
  NO_EXISTE: [404, "Usuario no encontrado"],
  ULTIMO_ADMINISTRADOR: [409, "No se puede desactivar al último administrador activo"]
};

const cambiarEstadoUsuario = async (req, res, next) => {
  try {
    const { activo } = leerDatos(req);
    const resultado = await usuariosService.cambiarEstadoUsuario(
      req.params.id,
      activo,
      req.usuario.id
    );

    if (resultado.estado !== "OK") {
      const [codigo, mensaje] = RESPUESTAS_ESTADO[resultado.estado];
      return res.status(codigo).json({ mensaje });
    }

    res.set("Cache-Control", "no-store");
    res.status(200).json({
      mensaje: activo ? "Usuario activado correctamente" : "Usuario desactivado correctamente",
      usuario: resultado.usuario
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// Exportaciones
// ========================================
module.exports = {
  crearUsuario,
  listarUsuarios,
  buscarParaRecuperacion,
  actualizarUsuario,
  cambiarEstadoUsuario
};
