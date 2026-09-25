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
// contra Mass Assignment: nunca se lee req.body directamente. Por eso
// passwordHash y activo no se declaran y el cliente no los puede fijar.
const leerDatos = (req) => matchedData(req, { locations: ["body"] });

// ========================================
// Respuesta pública de un usuario
// El passwordHash JAMÁS sale de la API
// ========================================
// La respuesta se arma campo por campo en lugar de devolver el usuario
// completo. Un hash no es la contraseña, pero sigue siendo material con el que
// se puede atacar la contraseña sin conexión si se filtra.
const usuarioPublico = (usuario) => ({
  id: usuario.id,
  nombre: usuario.nombre,
  email: usuario.email,
  rol: usuario.rol
});

// ========================================
// POST /api/auth/registro
// Toda cuenta nace activa
// ========================================
const registrar = async (req, res, next) => {
  try {
    const datos = leerDatos(req);

    if (usuariosService.obtenerUsuarioPorEmail(datos.email)) {
      return res.status(409).json({
        mensaje: "Ya existe un usuario con ese correo electrónico"
      });
    }

    const usuario = await usuariosService.crearUsuario(datos);

    res.status(201).json({
      mensaje: "Usuario registrado correctamente",
      usuario: { ...usuarioPublico(usuario), activo: usuario.activo }
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// POST /api/auth/login
// El mensaje del 401 no revela qué parte de las credenciales falló
// ========================================
// Si respondiera "el usuario no existe", cualquiera podría averiguar qué
// correos están registrados probándolos uno por uno.
const login = async (req, res, next) => {
  try {
    const datos = leerDatos(req);

    const usuario = await usuariosService.verificarCredenciales(
      datos.email,
      datos.password
    );

    if (!usuario) {
      return res.status(401).json({ mensaje: "Credenciales inválidas" });
    }

    if (!usuario.activo) {
      return res.status(403).json({ mensaje: "Usuario deshabilitado" });
    }

    res.status(200).json({
      mensaje: "Autenticación correcta",
      usuario: usuarioPublico(usuario)
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// Exportaciones
// ========================================
module.exports = {
  registrar,
  login
};
