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
  process.env.API_KEY_WEB,
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
  },
  // Desactivada en el bloque 11. Durante varios bloques esta clave se entregó
  // al navegador, así que hay que darla por conocida: no es un secreto que se
  // pueda recuperar, es una clave quemada. Ninguna interfaz la usa —el
  // catálogo se lee sin credenciales y lo demás va con JWT—, así que
  // desactivarla no rompe nada y cierra una puerta que estaba abierta.
  //
  // Si algún día hace falta un cliente web con sesión propia, se registra uno
  // nuevo con otra clave; esta no se reactiva.
  {
    id: 4,
    cliente: "Aplicación Web",
    hash: generarHash(process.env.API_KEY_WEB),
    activa: false,
    creadaEn: "2026-10-05",
    desactivadaEn: "2026-11-07"
  }
];

module.exports = apiKeys;
