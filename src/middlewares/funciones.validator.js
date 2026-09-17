// ========================================
// Importaciones
// ========================================
const { body, param } = require("express-validator");

const { ESTADOS } = require("../services/funciones.service");

// ========================================
// Listas blancas
// ========================================
const DESCUENTOS_PERMITIDOS = ["estudiante", "infantil", "adultoMayor"];

// ========================================
// Utilidades internas
// ========================================
const sinDuplicados = (valores) =>
  !Array.isArray(valores) || new Set(valores).size === valores.length;

// ========================================
// Reglas por campo
// ========================================
// El campo estado no aparece en las reglas de creación ni de actualización a
// propósito: al no estar declarado, matchedData lo descarta y el cliente no
// puede fijarlo. Solo se cambia desde PATCH /api/funciones/:id/estado.
const reglaEventoId = () =>
  body("eventoId")
    .isInt({ min: 1 })
    .withMessage("El eventoId debe ser un número entero mayor o igual a 1")
    .toInt();

const reglaFecha = () =>
  body("fecha")
    .trim()
    .notEmpty()
    .withMessage("La fecha es obligatoria")
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage("La fecha debe tener el formato YYYY-MM-DD")
    .isISO8601({ strict: true, strictSeparator: true })
    .withMessage("La fecha debe ser una fecha real en formato YYYY-MM-DD");

const reglaHora = () =>
  body("hora")
    .trim()
    .notEmpty()
    .withMessage("La hora es obligatoria")
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .withMessage("La hora debe tener el formato HH:MM, entre 00:00 y 23:59");

const reglaTarifas = () =>
  body("tarifas")
    .isArray({ min: 1 })
    .withMessage("Las tarifas deben ser un array con al menos un elemento");

const reglaTarifaLocalidadId = () =>
  body("tarifas.*.localidadId")
    .isInt({ min: 1 })
    .withMessage(
      "Cada tarifa debe tener un localidadId entero mayor o igual a 1"
    )
    .toInt();

const reglaTarifaPrecio = () =>
  body("tarifas.*.precio")
    .isInt({ min: 1 })
    .withMessage("Cada tarifa debe tener un precio entero mayor que 0")
    .toInt();

const reglaDescuentos = () =>
  body("descuentosHabilitados")
    .optional()
    .isArray()
    .withMessage("Los descuentos habilitados deben ser un array")
    .custom(sinDuplicados)
    .withMessage("No se pueden repetir descuentos habilitados");

const reglaDescuentoElemento = () =>
  body("descuentosHabilitados.*")
    .isIn(DESCUENTOS_PERMITIDOS)
    .withMessage(
      `Cada descuento debe ser uno de: ${DESCUENTOS_PERMITIDOS.join(", ")}`
    );

// ========================================
// Validar id
// ========================================
const validarIdFuncion = [
  param("id")
    .isInt({ min: 1 })
    .withMessage("El id debe ser un número entero mayor o igual a 1")
    .toInt()
];

// ========================================
// Validar eventoId
// ========================================
const validarEventoIdFuncion = [
  param("eventoId")
    .isInt({ min: 1 })
    .withMessage("El eventoId debe ser un número entero mayor o igual a 1")
    .toInt()
];

// ========================================
// Validar creación
// ========================================
const validarCreacionFuncion = [
  reglaEventoId(),
  reglaFecha(),
  reglaHora(),
  reglaTarifas(),
  reglaTarifaLocalidadId(),
  reglaTarifaPrecio(),
  reglaDescuentos(),
  reglaDescuentoElemento()
];

// ========================================
// Validar actualización total
// ========================================
const validarActualizacionFuncion = [
  reglaEventoId(),
  reglaFecha(),
  reglaHora(),
  reglaTarifas(),
  reglaTarifaLocalidadId(),
  reglaTarifaPrecio(),
  reglaDescuentos(),
  reglaDescuentoElemento()
];

// ========================================
// Validar actualización parcial
// ========================================
const validarFuncionParcial = [
  reglaEventoId().optional(),
  reglaFecha().optional(),
  reglaHora().optional(),
  reglaTarifas().optional(),
  reglaTarifaLocalidadId(),
  reglaTarifaPrecio(),
  reglaDescuentos(),
  reglaDescuentoElemento()
];

// ========================================
// Validar cambio de estado
// ========================================
const validarEstadoFuncion = [
  body("estado")
    .trim()
    .notEmpty()
    .withMessage("El estado es obligatorio")
    .isIn(ESTADOS)
    .withMessage(`El estado debe ser uno de: ${ESTADOS.join(", ")}`)
];

// ========================================
// Exportaciones
// ========================================
module.exports = {
  DESCUENTOS_PERMITIDOS,
  validarIdFuncion,
  validarEventoIdFuncion,
  validarCreacionFuncion,
  validarActualizacionFuncion,
  validarFuncionParcial,
  validarEstadoFuncion
};
