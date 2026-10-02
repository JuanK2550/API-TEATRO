// ========================================
// Importaciones
// ========================================
const { verificarToken } = require("../utils/jwt.util");

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
const autenticarJWT = (req, res, next) => {
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

    req.usuario = {
      id: Number(carga.sub),
      email: carga.email,
      rol: carga.rol
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
