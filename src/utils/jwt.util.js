// ========================================
// Importaciones
// ========================================
const jwt = require("jsonwebtoken");

// ========================================
// Configuración
// El algoritmo se fija aquí, nunca se toma del token recibido
// ========================================
const ALGORITMO = "HS256";
const EXPIRACION_POR_DEFECTO = "1h";

const obtenerSecreto = () => {
  const secreto = process.env.JWT_SECRET;

  if (!secreto) {
    throw new Error("JWT_SECRET no está configurada en las variables de entorno");
  }

  return secreto;
};

// ========================================
// Generar token
// El id va en el claim estándar sub; nunca se incluye la contraseña
// ========================================
// El payload viaja codificado en base64, no cifrado: cualquiera que tenga el
// token puede leerlo. La firma impide modificarlo, no lo oculta.
const generarToken = (usuario) =>
  jwt.sign(
    { email: usuario.email, rol: usuario.rol },
    obtenerSecreto(),
    {
      algorithm: ALGORITMO,
      expiresIn: process.env.JWT_EXPIRES_IN || EXPIRACION_POR_DEFECTO,
      subject: String(usuario.id)
    }
  );

// ========================================
// Verificar token
// Solo se acepta HS256: así un token no puede imponer su propio algoritmo
// ========================================
const verificarToken = (token) =>
  jwt.verify(token, obtenerSecreto(), { algorithms: [ALGORITMO] });

// ========================================
// Exportaciones
// ========================================
module.exports = {
  generarToken,
  verificarToken
};
