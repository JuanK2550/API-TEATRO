// ========================================
// Importaciones
// ========================================
const crypto = require("crypto");

// ========================================
// Comparación en tiempo constante
// Evita deducir la clave midiendo cuánto tarda cada intento
// ========================================
// Con === la comparación se detiene en el primer carácter distinto, así que
// tarda más cuantos más caracteres iniciales acierte el atacante. Midiendo esos
// tiempos la clave se deduce carácter a carácter: es un timing attack.
// timingSafeEqual compara todos los bytes siempre, en tiempo constante.
const compararSeguro = (valorRecibido, valorEsperado) => {
  const recibido = Buffer.from(valorRecibido);
  const esperado = Buffer.from(valorEsperado);

  if (recibido.length !== esperado.length) return false;

  return crypto.timingSafeEqual(recibido, esperado);
};

// ========================================
// Validación de la API Key
// Autentica al cliente que consume la API, no a una persona
// ========================================
const validarApiKey = (req, res, next) => {
  const claveEsperada = process.env.API_KEY;

  if (!claveEsperada) {
    console.error("API_KEY no está configurada en las variables de entorno");
    return res
      .status(500)
      .json({ mensaje: "Error de configuración del servidor" });
  }

  const claveRecibida = req.get("X-API-Key");

  if (!claveRecibida) {
    return res.status(401).json({ mensaje: "API Key requerida" });
  }

  if (!compararSeguro(claveRecibida, claveEsperada)) {
    return res.status(401).json({ mensaje: "API Key inválida" });
  }

  next();
};

// ========================================
// Exportaciones
// ========================================
module.exports = validarApiKey;
