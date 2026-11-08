// ========================================
// Importaciones
// ========================================
const { verificarToken } = require("../utils/jwt.util");
const usuariosService = require("../services/usuarios.service");

// ========================================
// Errores propios de jsonwebtoken
// ========================================
// Solo estos tres significan que el token del cliente está mal. Cualquier otro
// error, por ejemplo que falte JWT_SECRET, es un fallo del servidor: se pasa a
// manejarError para que responda 500 y quede registrado, en vez de culpar al
// cliente con un 401 que además escondería el problema.
const ERRORES_DE_TOKEN = [
  "TokenExpiredError",
  "JsonWebTokenError",
  "NotBeforeError"
];

// ========================================
// Autenticación mediante JWT
// Identifica a la persona; la API Key identifica a la aplicación
// ========================================
// Desde el bloque 11 el middleware consulta la base en cada petición
// autenticada. Cuesta una consulta, y a cambio el rol y la versión de sesión
// salen de PostgreSQL y no del token: una cuenta desactivada, un rol rebajado o
// una contraseña cambiada surten efecto en el acto, sin esperar a que el token
// expire.
const autenticarJWT = async (req, res, next) => {
  const cabecera = req.get("Authorization");

  if (!cabecera) {
    return res
      .status(401)
      .json({ mensaje: "Token de autenticación requerido" });
  }

  const [esquema, token] = cabecera.split(" ");

  if (esquema !== "Bearer" || !token) {
    return res.status(401).json({ mensaje: "Formato de token inválido" });
  }

  try {
    const carga = verificarToken(token);

    const usuario = await usuariosService.obtenerUsuarioPorId(Number(carga.sub));

    if (!usuario || !usuario.activo) {
      return res.status(401).json({ mensaje: "Cuenta no disponible" });
    }

    // Un JWT emitido antes del último cambio de contraseña ya no sirve.
    if (!Number.isSafeInteger(carga.vs) || carga.vs !== usuario.versionSesion) {
      return res.status(401).json({ mensaje: "Sesión revocada" });
    }

    req.usuario = {
      id: usuario.id,
      email: usuario.email,
      rol: usuario.rol
    };

    next();
  } catch (error) {
    if (!ERRORES_DE_TOKEN.includes(error.name)) return next(error);

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ mensaje: "Token expirado" });
    }

    res.status(401).json({ mensaje: "Token inválido" });
  }
};

// ========================================
// Exportaciones
// ========================================
module.exports = autenticarJWT;
