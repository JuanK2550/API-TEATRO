// ========================================
// Importaciones
// ========================================
const { body, param } = require("express-validator");

const { ESTADOS, TIPOS_DESCUENTO } = require("../services/boletas.service");

// ========================================
// Reglas por campo
// ========================================
// Los campos precio, codigo y estado no aparecen en ninguna regla a
// propósito: al no estar declarados, matchedData los descarta y el cliente
// no puede fijarlos por mucho que los envíe en el cuerpo. El precio lo
// calcula el service, el código lo genera el service y el estado solo se
// cambia desde PATCH /api/boletas/:id/estado.
const reglaAsistenteId = () =>
  body("asistenteId")
    .isInt({ min: 1 })
    .withMessage("El asistenteId debe ser un número entero mayor o igual a 1")
    .toInt();

const reglaFuncionId = () =>
  body("funcionId")
    .isInt({ min: 1 })
    .withMessage("El funcionId debe ser un número entero mayor o igual a 1")
    .toInt();

const reglaLocalidadId = () =>
  body("localidadId")
    .isInt({ min: 1 })
    .withMessage("El localidadId debe ser un número entero mayor o igual a 1")
    .toInt();

const reglaFila = () =>
  body("fila")
    .isInt({ min: 1 })
    .withMessage("La fila debe ser un número entero mayor o igual a 1")
    .toInt();

const reglaNumero = () =>
  body("numero")
    .isInt({ min: 1 })
    .withMessage("El número de butaca debe ser un número entero mayor o igual a 1")
    .toInt();

const reglaTipoDescuento = () =>
  body("tipoDescuento")
    .optional()
    .trim()
    .isIn(TIPOS_DESCUENTO)
    .withMessage(
      `El tipo de descuento debe ser uno de: ${TIPOS_DESCUENTO.join(", ")}`
    );

// ========================================
// Validar id
// ========================================
const validarIdBoleta = [
  param("id")
    .isInt({ min: 1 })
    .withMessage("El id debe ser un número entero mayor o igual a 1")
    .toInt()
];

// ========================================
// Validar asistenteId
// ========================================
const validarAsistenteIdBoleta = [
  param("asistenteId")
    .isInt({ min: 1 })
    .withMessage("El asistenteId debe ser un número entero mayor o igual a 1")
    .toInt()
];

// ========================================
// Validar funcionId
// ========================================
const validarFuncionIdBoleta = [
  param("funcionId")
    .isInt({ min: 1 })
    .withMessage("El funcionId debe ser un número entero mayor o igual a 1")
    .toInt()
];

// ========================================
// Validar creación
// ========================================
const validarCreacionBoleta = [
  reglaAsistenteId(),
  reglaFuncionId(),
  reglaLocalidadId(),
  reglaFila(),
  reglaNumero(),
  reglaTipoDescuento()
];

// ========================================
// Validar actualización total
// ========================================
const validarActualizacionBoleta = [
  reglaAsistenteId(),
  reglaFuncionId(),
  reglaLocalidadId(),
  reglaFila(),
  reglaNumero(),
  reglaTipoDescuento()
];

// ========================================
// Validar actualización parcial
// ========================================
const validarBoletaParcial = [
  reglaAsistenteId().optional(),
  reglaFuncionId().optional(),
  reglaLocalidadId().optional(),
  reglaFila().optional(),
  reglaNumero().optional(),
  reglaTipoDescuento()
];

// ========================================
// Validar cambio de estado
// ========================================
const validarEstadoBoleta = [
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
  validarIdBoleta,
  validarAsistenteIdBoleta,
  validarFuncionIdBoleta,
  validarCreacionBoleta,
  validarActualizacionBoleta,
  validarBoletaParcial,
  validarEstadoBoleta
};
