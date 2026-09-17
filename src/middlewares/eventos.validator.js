// ========================================
// Importaciones
// ========================================
const { body, param } = require("express-validator");

// ========================================
// Listas blancas
// ========================================
const TIPOS_PERMITIDOS = ["obra", "concierto", "cine", "institucional"];
const CLASIFICACIONES_PERMITIDAS = ["G", "+7", "+12", "+15", "+18"];

// ========================================
// Reglas por campo
// ========================================
// El campo activo no aparece en ninguna regla a propósito: al no estar
// declarado, matchedData lo descarta y el cliente no puede enviarlo.
const reglaTitulo = () =>
  body("titulo")
    .trim()
    .notEmpty()
    .withMessage("El título es obligatorio")
    .isLength({ min: 3, max: 150 })
    .withMessage("El título debe tener entre 3 y 150 caracteres")
    .matches(/^[^<>]*$/)
    .withMessage("El título no puede contener los caracteres < ni >");

const reglaTipo = () =>
  body("tipo")
    .trim()
    .notEmpty()
    .withMessage("El tipo es obligatorio")
    .isIn(TIPOS_PERMITIDOS)
    .withMessage(`El tipo debe ser uno de: ${TIPOS_PERMITIDOS.join(", ")}`);

const reglaDescripcion = () =>
  body("descripcion")
    .trim()
    .notEmpty()
    .withMessage("La descripción es obligatoria")
    .isLength({ min: 10, max: 500 })
    .withMessage("La descripción debe tener entre 10 y 500 caracteres")
    .matches(/^[^<>]*$/)
    .withMessage("La descripción no puede contener los caracteres < ni >");

const reglaDuracionMinutos = () =>
  body("duracionMinutos")
    .isInt({ min: 10, max: 600 })
    .withMessage("La duración debe ser un número entero entre 10 y 600 minutos")
    .toInt();

const reglaClasificacionEdad = () =>
  body("clasificacionEdad")
    .trim()
    .notEmpty()
    .withMessage("La clasificación de edad es obligatoria")
    .isIn(CLASIFICACIONES_PERMITIDAS)
    .withMessage(
      `La clasificación de edad debe ser una de: ${CLASIFICACIONES_PERMITIDAS.join(", ")}`
    );

// ========================================
// Validar id
// ========================================
const validarIdEvento = [
  param("id")
    .isInt({ min: 1 })
    .withMessage("El id debe ser un número entero mayor o igual a 1")
    .toInt()
];

// ========================================
// Validar creación
// ========================================
const validarCreacionEvento = [
  reglaTitulo(),
  reglaTipo(),
  reglaDescripcion(),
  reglaDuracionMinutos(),
  reglaClasificacionEdad()
];

// ========================================
// Validar actualización total
// ========================================
const validarActualizacionEvento = [
  reglaTitulo(),
  reglaTipo(),
  reglaDescripcion(),
  reglaDuracionMinutos(),
  reglaClasificacionEdad()
];

// ========================================
// Validar actualización parcial
// ========================================
const validarEventoParcial = [
  reglaTitulo().optional(),
  reglaTipo().optional(),
  reglaDescripcion().optional(),
  reglaDuracionMinutos().optional(),
  reglaClasificacionEdad().optional()
];

// ========================================
// Validar cambio de estado
// ========================================
const validarEstadoEvento = [
  body("activo")
    .exists()
    .withMessage("El campo activo es obligatorio")
    .isBoolean({ strict: true })
    .withMessage("El campo activo debe ser un booleano")
    .toBoolean()
];

// ========================================
// Exportaciones
// ========================================
module.exports = {
  validarIdEvento,
  validarCreacionEvento,
  validarActualizacionEvento,
  validarEventoParcial,
  validarEstadoEvento
};
