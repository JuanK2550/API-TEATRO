// ========================================
// Importaciones
// ========================================
const { body, param, query } = require("express-validator");

const {
  reglaNombre,
  reglaEmail,
  reglaPassword
} = require("./auth.validator");
const { ROLES, ROLES_ADMINISTRATIVOS } = require("../services/usuarios.service");

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
// Id de usuario en la ruta
// ========================================
const validarIdUsuario = [
  param("id")
    .isInt({ min: 1 })
    .withMessage("El id debe ser un número entero mayor o igual a 1")
    .toInt()
];

// ========================================
// Filtros del listado
// ========================================
const validarListadoUsuarios = [
  query("q")
    .optional()
    .isString()
    .withMessage("La búsqueda debe ser texto")
    .trim()
    .isLength({ max: 100 })
    .withMessage("La búsqueda admite como máximo 100 caracteres"),
  query("rol")
    .optional()
    .isIn(ROLES)
    .withMessage(`El rol debe ser uno de: ${ROLES.join(", ")}`),
  query("activo")
    .optional()
    .isIn(["true", "false"])
    .withMessage("activo debe ser true o false"),
  query("pagina")
    .optional()
    .isInt({ min: 1, max: 100000 })
    .withMessage("La página debe ser un entero entre 1 y 100000")
    .toInt()
];

// ========================================
// Búsqueda para la recuperación administrativa
// ========================================
const validarBusquedaRecuperacion = [
  query("q")
    .isString()
    .withMessage("La búsqueda debe ser texto")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Escriba entre 2 y 100 caracteres para buscar")
];

// ========================================
// Edición de nombre y correo
// El rol, la contraseña y el estado no se declaran a propósito
// ========================================
const validarEdicionUsuario = [reglaNombre(), reglaEmail()];

// ========================================
// Cambio de estado
// Solo un booleano JSON real
// ========================================
const validarEstadoUsuario = [
  body("activo")
    .isBoolean({ strict: true })
    .withMessage("activo debe ser true o false (booleano)")
];

// ========================================
// Exportaciones
// ========================================
module.exports = {
  validarCreacionUsuario,
  validarIdUsuario,
  validarListadoUsuarios,
  validarBusquedaRecuperacion,
  validarEdicionUsuario,
  validarEstadoUsuario
};
