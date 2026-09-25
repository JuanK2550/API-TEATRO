// ========================================
// Importaciones
// ========================================
const { body } = require("express-validator");

const { ROLES } = require("../services/usuarios.service");

// ========================================
// Reglas por campo
// ========================================
// Los campos passwordHash y activo no aparecen en ninguna regla a propósito:
// al no estar declarados, matchedData los descarta y el cliente no puede
// enviarlos. El service es el único que los fija.
const reglaNombre = () =>
  body("nombre")
    .isString()
    .withMessage("El nombre debe ser texto")
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage("El nombre debe tener entre 3 y 100 caracteres");

const reglaEmail = () =>
  body("email")
    .isEmail()
    .withMessage("Debe proporcionar un correo electrónico válido")
    .normalizeEmail();

// bcrypt solo procesa 72 bytes de entrada, así que lo que pase de ahí se
// ignoraría en silencio. Se rechaza antes en vez de aceptarlo a medias.
const reglaPassword = () =>
  body("password")
    .isString()
    .withMessage("La contraseña debe ser texto")
    .isLength({ min: 10, max: 72 })
    .withMessage("La contraseña debe tener entre 10 y 72 caracteres");

const reglaRol = () =>
  body("rol")
    .isIn(ROLES)
    .withMessage(`El rol debe ser ${ROLES.join(", ")}`);

// ========================================
// Registro
// ========================================
const validarRegistro = [
  reglaNombre(),
  reglaEmail(),
  reglaPassword(),
  reglaRol()
];

// ========================================
// Login
// La contraseña solo se comprueba que venga: la longitud la juzga bcrypt
// ========================================
const validarLogin = [
  reglaEmail(),
  body("password")
    .isString()
    .withMessage("La contraseña debe ser texto")
    .notEmpty()
    .withMessage("La contraseña es obligatoria")
];

// ========================================
// Exportaciones
// ========================================
module.exports = {
  validarRegistro,
  validarLogin
};
