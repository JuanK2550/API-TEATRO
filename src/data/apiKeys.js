// ========================================
// Importaciones
// ========================================
const { generarHash } = require("../utils/crypto.util");

// ========================================
// Validar configuración
// Las tres claves deben existir antes de calcular sus hashes
// ========================================
const clavesConfiguradas = [
  process.env.API_KEY_POSTMAN,
  process.env.API_KEY_TAQUILLA,
  process.env.API_KEY_MOVIL
];

if (clavesConfiguradas.some((clave) => !clave)) {
  throw new Error("Faltan variables de entorno para las API Keys");
}

// ========================================
// API Keys registradas
// Solo se guarda el hash, nunca la clave en claro
// ========================================
const apiKeys = [
  {
    id: 1,
    cliente: "Postman Laboratorio",
    hash: generarHash(process.env.API_KEY_POSTMAN),
    activa: true,
    creadaEn: "2026-09-21"
  },
  {
    id: 2,
    cliente: "Taquilla del Teatro",
    hash: generarHash(process.env.API_KEY_TAQUILLA),
    activa: true,
    creadaEn: "2026-09-21"
  },
  {
    id: 3,
    cliente: "Aplicación Móvil",
    hash: generarHash(process.env.API_KEY_MOVIL),
    activa: false,
    creadaEn: "2026-09-21"
  }
];

module.exports = apiKeys;
