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

    if (usuariosService.obtenerUsuarioPorEmail(datos.email)) {
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
// Exportaciones
// ========================================
module.exports = {
  crearUsuario
};
