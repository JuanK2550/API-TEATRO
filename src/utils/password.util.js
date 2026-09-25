// ========================================
// Importaciones
// ========================================
const bcrypt = require("bcrypt");

// ========================================
// Cost factor de bcrypt
// ========================================
const SALT_ROUNDS = 12;

// ========================================
// Generar hash de contraseña
// bcrypt genera el salt y lo incluye en el hash resultante
// ========================================
// Las dos funciones son asíncronas porque bcrypt es lento a propósito: con
// versiones síncronas cada registro o login bloquearía el hilo del servidor.
const generarPasswordHash = async (password) =>
  bcrypt.hash(password, SALT_ROUNDS);

// ========================================
// Verificar contraseña
// ========================================
const verificarPassword = async (password, passwordHash) =>
  bcrypt.compare(password, passwordHash);

// ========================================
// Exportaciones
// ========================================
module.exports = {
  generarPasswordHash,
  verificarPassword
};
