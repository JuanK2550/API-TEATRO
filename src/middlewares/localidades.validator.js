// ========================================
// Importaciones
// ========================================
const { body, param } = require("express-validator");

// ========================================
// Utilidades internas
// El código se almacena siempre en mayúsculas
// ========================================
const aMayusculas = (valor) =>
  typeof valor === "string" ? valor.toUpperCase() : valor;

// ========================================
// Reglas por campo
// ========================================
// Los campos capacidad y activa no aparecen en ninguna regla a propósito:
// al no estar declarados, matchedData los descarta y el cliente no puede
// enviarlos. La capacidad la calcula el service.
const reglaCodigo = () =>
  body("codigo")
    .trim()
    .notEmpty()
    .withMessage("El código es obligatorio")
    .customSanitizer(aMayusculas)
    .matches(/^[A-Z0-9-]{2,20}$/)
    .withMessage(
      "El código debe tener entre 2 y 20 caracteres y solo admite letras, números y guiones"
    );

const reglaNombre = () =>
  body("nombre")
    .trim()
    .notEmpty()
    .withMessage("El nombre es obligatorio")
    .isLength({ min: 3, max: 100 })
    .withMessage("El nombre debe tener entre 3 y 100 caracteres")
    .matches(/^[^<>]*$/)
    .withMessage("El nombre no puede contener los caracteres < ni >");

const reglaOrden = () =>
  body("orden")
    .isInt({ min: 1 })
    .withMessage(
      "El orden debe ser un número entero mayor o igual a 1, donde 1 es la localidad más cercana al escenario"
    )
    .toInt();

const reglaFilas = () =>
  body("filas")
    .isInt({ min: 1 })
    .withMessage("Las filas deben ser un número entero mayor que 0")
    .toInt();

const reglaButacasPorFila = () =>
  body("butacasPorFila")
    .isInt({ min: 1 })
    .withMessage("Las butacas por fila deben ser un número entero mayor que 0")
    .toInt();

// ========================================
// Validar id
// ========================================
const validarIdLocalidad = [
  param("id")
    .isInt({ min: 1 })
    .withMessage("El id debe ser un número entero mayor o igual a 1")
    .toInt()
];

// ========================================
// Validar creación
// ========================================
const validarCreacionLocalidad = [
  reglaCodigo(),
  reglaNombre(),
  reglaOrden(),
  reglaFilas(),
  reglaButacasPorFila()
];

// ========================================
// Validar actualización total
// ========================================
const validarActualizacionLocalidad = [
  reglaCodigo(),
  reglaNombre(),
  reglaOrden(),
  reglaFilas(),
  reglaButacasPorFila()
];

// ========================================
// Validar actualización parcial
// ========================================
const validarLocalidadParcial = [
  reglaCodigo().optional(),
  reglaNombre().optional(),
  reglaOrden().optional(),
  reglaFilas().optional(),
  reglaButacasPorFila().optional()
];

// ========================================
// Validar cambio de estado
// ========================================
const validarEstadoLocalidad = [
  body("activa")
    .exists()
    .withMessage("El campo activa es obligatorio")
    .isBoolean({ strict: true })
    .withMessage("El campo activa debe ser un booleano")
    .toBoolean()
];

// ========================================
// Exportaciones
// ========================================
module.exports = {
  validarIdLocalidad,
  validarCreacionLocalidad,
  validarActualizacionLocalidad,
  validarLocalidadParcial,
  validarEstadoLocalidad
};
