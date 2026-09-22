// ========================================
// Importaciones
// ========================================
const crypto = require("crypto");

// ========================================
// Generar hash SHA-256
// ========================================
const generarHash = (valor) =>
  crypto.createHash("sha256").update(valor).digest("hex");

// ========================================
// Comparación en tiempo constante
// Evita deducir un secreto midiendo cuánto tarda cada intento
// ========================================
// Con === la comparación se detiene en el primer carácter distinto, así que
// tarda más cuantos más caracteres iniciales acierte el atacante. Midiendo esos
// tiempos el secreto se deduce carácter a carácter: es un timing attack.
// timingSafeEqual compara todos los bytes siempre, en tiempo constante.
const compararSeguro = (valorA, valorB) => {
  const bufferA = Buffer.from(valorA, "utf8");
  const bufferB = Buffer.from(valorB, "utf8");

  if (bufferA.length !== bufferB.length) return false;

  return crypto.timingSafeEqual(bufferA, bufferB);
};

// ========================================
// Exportaciones
// ========================================
module.exports = {
  generarHash,
  compararSeguro
};
