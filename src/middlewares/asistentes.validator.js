// ========================================
// Importaciones
// ========================================
const { body, param } = require("express-validator");

// ========================================
// Utilidades internas
// ========================================
const aMinusculas = (valor) =>
  typeof valor === "string" ? valor.toLowerCase() : valor;

// Acepta solo fechas reales en formato YYYY-MM-DD que no sean futuras.
const esFechaPasadaValida = (valor) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;

  const fecha = new Date(`${valor}T00:00:00Z`);
  if (Number.isNaN(fecha.getTime())) return false;

  if (fecha.toISOString().slice(0, 10) !== valor) return false;

  const hoy = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  return fecha.getTime() <= hoy.getTime();
};

// ========================================
// Reglas por campo
// ========================================
const reglaNombre = () =>
  body("nombre")
    .trim()
    .notEmpty()
    .withMessage("El nombre es obligatorio")
    .isLength({ min: 3, max: 100 })
    .withMessage("El nombre debe tener entre 3 y 100 caracteres")
    .matches(/^[^<>]*$/)
    .withMessage("El nombre no puede contener los caracteres < ni >");

const reglaDocumento = () =>
  body("documento")
    .trim()
    .notEmpty()
    .withMessage("El documento es obligatorio")
    .isLength({ min: 5, max: 20 })
    .withMessage("El documento debe tener entre 5 y 20 caracteres")
    .matches(/^[0-9A-Za-z-]+$/)
    .withMessage("El documento solo admite letras, números y guiones");

const reglaEmail = () =>
  body("email")
    .trim()
    .notEmpty()
    .withMessage("El email es obligatorio")
    .isEmail()
    .withMessage("El email no tiene un formato válido")
    .customSanitizer(aMinusculas);

const reglaTelefono = () =>
  body("telefono")
    .trim()
    .notEmpty()
    .withMessage("El teléfono es obligatorio")
    .matches(/^[0-9]{7,15}$/)
    .withMessage("El teléfono debe contener entre 7 y 15 dígitos");

const reglaFechaNacimiento = () =>
  body("fechaNacimiento")
    .trim()
    .notEmpty()
    .withMessage("La fecha de nacimiento es obligatoria")
    .custom(esFechaPasadaValida)
    .withMessage(
      "La fecha de nacimiento debe tener el formato YYYY-MM-DD y no puede estar en el futuro"
    );

// ========================================
// Validar id
// ========================================
const validarIdAsistente = [
  param("id")
    .isInt({ min: 1 })
    .withMessage("El id debe ser un número entero mayor o igual a 1")
    .toInt()
];

// ========================================
// Validar creación
// ========================================
const validarCreacionAsistente = [
  reglaNombre(),
  reglaDocumento(),
  reglaEmail(),
  reglaTelefono(),
  reglaFechaNacimiento()
];

// ========================================
// Validar actualización total
// ========================================
const validarActualizacionAsistente = [
  reglaNombre(),
  reglaDocumento(),
  reglaEmail(),
  reglaTelefono(),
  reglaFechaNacimiento()
];

// ========================================
// Validar actualización parcial
// ========================================
const validarAsistenteParcial = [
  reglaNombre().optional(),
  reglaDocumento().optional(),
  reglaEmail().optional(),
  reglaTelefono().optional(),
  reglaFechaNacimiento().optional()
];

// ========================================
// Exportaciones
// ========================================
module.exports = {
  validarIdAsistente,
  validarCreacionAsistente,
  validarActualizacionAsistente,
  validarAsistenteParcial
};
