// ========================================
// Importaciones
// ========================================
const { body, param } = require("express-validator");

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
// Contraseña nueva
// Más exigente que la del registro, y a propósito
// ========================================
// Una contraseña que se pone para recuperar el acceso suele escribirse con
// prisa y después de un susto. Pedir doce caracteres y tres clases distintas
// evita que el apuro acabe en una clave peor que la perdida.
const reglaPasswordNueva = (campo) =>
  body(campo)
    .isString()
    .withMessage("La contraseña debe ser texto")
    .isLength({ min: 12, max: 72 })
    .withMessage("La nueva contraseña debe tener entre 12 y 72 caracteres")
    .custom((valor) => {
      if (!/[a-z]/.test(valor) || !/[A-Z]/.test(valor) || !/[0-9]/.test(valor)) {
        throw new Error("Incluya mayúscula, minúscula y número");
      }
      return true;
    });

// La confirmación se compara contra req.body y no contra el campo ya saneado:
// es lo que el cliente escribió de verdad en el segundo recuadro.
const reglaConfirmacion = () =>
  body("confirmarPassword")
    .isString()
    .withMessage("La confirmación debe ser texto")
    .custom((valor, { req }) => {
      if (valor !== req.body.passwordNueva) {
        throw new Error("La confirmación no coincide");
      }
      return true;
    });

// ========================================
// Cambio de contraseña con la sesión abierta
// ========================================
const validarCambioPassword = [
  body("passwordActual")
    .isString()
    .withMessage("La contraseña actual debe ser texto")
    .notEmpty()
    .withMessage("La contraseña actual es obligatoria"),
  reglaPasswordNueva("passwordNueva"),
  reglaConfirmacion()
];

// ========================================
// Recuperación autorizada por un administrador
// ========================================
const validarGenerarRecuperacion = [
  param("usuarioId")
    .isInt({ min: 1 })
    .withMessage("El id de usuario debe ser un número entero mayor o igual a 1")
    .toInt()
];

// El token son 32 bytes en hexadecimal: 64 caracteres y nada más.
const validarRestablecimiento = [
  body("token")
    .isString()
    .withMessage("El token debe ser texto")
    .matches(/^[a-f0-9]{64}$/i)
    .withMessage("El token no tiene el formato esperado"),
  reglaPasswordNueva("passwordNueva"),
  reglaConfirmacion()
];

// ========================================
// Códigos de respaldo
// ========================================
const validarGenerarCodigos = [
  body("passwordActual")
    .isString()
    .withMessage("La contraseña actual debe ser texto")
    .notEmpty()
    .withMessage("La contraseña actual es obligatoria")
];

// Ocho grupos de cuatro caracteres hexadecimales separados por guiones.
const validarRestablecerConCodigo = [
  reglaEmail(),
  body("codigo")
    .isString()
    .withMessage("El código debe ser texto")
    .matches(/^[a-f0-9]{4}(?:-[a-f0-9]{4}){7}$/i)
    .withMessage("El código no tiene el formato esperado"),
  reglaPasswordNueva("passwordNueva"),
  reglaConfirmacion()
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
  validarLogin,
  validarCambioPassword,
  validarGenerarRecuperacion,
  validarRestablecimiento,
  validarGenerarCodigos,
  validarRestablecerConCodigo
};
