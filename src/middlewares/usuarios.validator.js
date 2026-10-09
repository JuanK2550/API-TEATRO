// ========================================
// Importaciones
// ========================================
const { body } = require("express-validator");

const {
  reglaNombre,
  reglaEmail,
  reglaPassword
} = require("./auth.validator");
const { ROLES_ADMINISTRATIVOS } = require("../services/usuarios.service");

// ========================================
// Regla del rol
// Solo taquilla y administrador: asistente se obtiene registrándose
// ========================================
// La lista blanca vive en el service, que es el dueño de la regla de negocio.
// Cualquier otro valor, incluidos "asistente" y "superadmin", es un 400: una
// lista blanca rechaza lo que no conoce, en lugar de intentar enumerar lo
// peligroso.
const reglaRol = () =>
  body("rol")
    .isString()
    .withMessage("El rol debe ser texto")
    .trim()
    .isIn(ROLES_ADMINISTRATIVOS)
    .withMessage(
      `El rol debe ser uno de: ${ROLES_ADMINISTRATIVOS.join(", ")}`
    );

// ========================================
// Creación de un usuario administrativo
// Los campos id, passwordHash y activo no se declaran a propósito
// ========================================
// Al no estar declarados, matchedData los descarta y el cliente no los puede
// fijar: el id y el activo los pone el servidor, y el hash nace de la
// contraseña. Es la protección contra Mass Assignment.
const validarCreacionUsuario = [
  reglaNombre(),
  reglaEmail(),
  reglaPassword(),
  reglaRol()
];

// ========================================
// Exportaciones
// ========================================
module.exports = {
  validarCreacionUsuario
};
