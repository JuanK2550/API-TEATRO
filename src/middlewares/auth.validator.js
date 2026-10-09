// ========================================
// Importaciones
// ========================================
const { body } = require("express-validator");

// ========================================
// Reglas por campo
// ========================================
// Los campos rol, passwordHash y activo no aparecen en ninguna regla a propósito:
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

// ========================================
// Registro
// El rol no se declara: lo asigna el servidor, no el cliente
// ========================================
const validarRegistro = [reglaNombre(), reglaEmail(), reglaPassword()];

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
// Las tres reglas se exportan porque el validador de usuarios
// administrativos pide exactamente las mismas: una sola definición
// evita que el registro y la creación administrativa se separen.
module.exports = {
  reglaNombre,
  reglaEmail,
  reglaPassword,
  validarRegistro,
  validarLogin
};
