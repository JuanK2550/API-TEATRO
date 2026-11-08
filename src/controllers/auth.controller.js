// ========================================
// Importaciones
// ========================================
const { matchedData } = require("express-validator");

const usuariosService = require("../services/usuarios.service");
const recuperacionService = require("../services/recuperacion.service");
const codigosService = require("../services/codigosRecuperacion.service");
const { generarToken } = require("../utils/jwt.util");

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

    if (await usuariosService.obtenerUsuarioPorEmail(datos.email)) {
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
      usuario: usuarioPublico(usuario),
      token: generarToken(usuario)
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// PATCH /api/auth/cambiar-password
// Al cambiarla, los tokens anteriores dejan de valer
// ========================================
const cambiarPassword = async (req, res, next) => {
  try {
    const datos = leerDatos(req);

    const resultado = await usuariosService.cambiarPasswordPropio(
      req.usuario.id,
      datos.passwordActual,
      datos.passwordNueva
    );

    if (
      resultado.estado === "CLAVE_INCORRECTA" ||
      resultado.estado === "NO_AUTORIZADO"
    ) {
      return res.status(401).json({ mensaje: "Contraseña actual inválida" });
    }

    if (resultado.estado === "MISMA_CLAVE") {
      return res
        .status(400)
        .json({ mensaje: "La nueva contraseña debe ser diferente" });
    }

    if (resultado.estado === "CONFLICTO") {
      return res.status(409).json({
        mensaje: "La contraseña cambió durante la operación; inténtelo de nuevo"
      });
    }

    res.status(200).json({
      mensaje: "Contraseña actualizada. Inicie sesión nuevamente."
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// POST /api/auth/recuperacion/:usuarioId
// Solo un administrador la autoriza
// ========================================
// El token se devuelve una sola vez y no se vuelve a mostrar. Cache-Control
// evita que un proxy o el navegador lo guarden.
const generarRecuperacion = async (req, res, next) => {
  try {
    const { usuarioId } = matchedData(req, { locations: ["params"] });

    const resultado = await recuperacionService.generarRecuperacion(
      usuarioId,
      req.usuario.id
    );

    if (resultado.estado === "NO_ENCONTRADO") {
      return res
        .status(404)
        .json({ mensaje: "Usuario no encontrado o deshabilitado" });
    }

    res.set("Cache-Control", "no-store");

    res.status(201).json({
      mensaje: "Token generado. Entréguelo solo al titular de la cuenta.",
      token: resultado.token,
      expiraEn: resultado.expiraEn
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// POST /api/auth/restablecer-password
// No exige sesión: quien la perdió no puede iniciarla
// ========================================
const restablecerPassword = async (req, res, next) => {
  try {
    const datos = leerDatos(req);

    const resultado = await recuperacionService.restablecerPassword(
      datos.token,
      datos.passwordNueva
    );

    if (resultado.estado === "TOKEN_INVALIDO") {
      return res
        .status(400)
        .json({ mensaje: "Token inválido, ya utilizado o expirado" });
    }

    if (resultado.estado === "MISMA_CLAVE") {
      return res
        .status(400)
        .json({ mensaje: "La nueva contraseña debe ser diferente" });
    }

    res.status(200).json({
      mensaje: "Contraseña restablecida. Inicie sesión nuevamente."
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// POST /api/auth/codigos-recuperacion
// Y su variante /regenerar, que usa este mismo controlador
// ========================================
const generarCodigos = async (req, res, next) => {
  try {
    const datos = leerDatos(req);

    const resultado = await codigosService.generar(
      req.usuario.id,
      datos.passwordActual
    );

    if (resultado.estado !== "OK") {
      return res.status(401).json({ mensaje: "Contraseña actual inválida" });
    }

    res.set("Cache-Control", "no-store");

    res.status(201).json({
      mensaje: "Guarde estos códigos: no se volverán a mostrar.",
      codigos: resultado.codigos
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// GET /api/auth/codigos-recuperacion/estado
// Devuelve cuántos quedan, nunca cuáles
// ========================================
const estadoCodigos = async (req, res, next) => {
  try {
    res.status(200).json({
      disponibles: await codigosService.disponibles(req.usuario.id)
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// POST /api/auth/restablecer-con-codigo
// Tampoco exige sesión, por el mismo motivo
// ========================================
// Un código equivocado y una cuenta inexistente responden igual: si el mensaje
// los distinguiera, serviría para averiguar qué correos están registrados.
const restablecerConCodigo = async (req, res, next) => {
  try {
    const datos = leerDatos(req);

    const resultado = await codigosService.restablecer(
      datos.email,
      datos.codigo,
      datos.passwordNueva
    );

    if (resultado.estado === "MISMA_CLAVE") {
      return res
        .status(400)
        .json({ mensaje: "La nueva contraseña debe ser diferente" });
    }

    if (resultado.estado !== "OK") {
      return res.status(400).json({ mensaje: "Código o cuenta inválidos" });
    }

    res.status(200).json({
      mensaje: "Contraseña restablecida. Inicie sesión nuevamente."
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
  login,
  cambiarPassword,
  generarRecuperacion,
  restablecerPassword,
  generarCodigos,
  estadoCodigos,
  restablecerConCodigo
};
