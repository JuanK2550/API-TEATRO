// ========================================
// Boletas
// ========================================
// Cada boleta ocupa una butaca concreta (localidad + fila + numero)
// dentro de una función, por lo que esa combinación no se repite.
// tipoDescuento: "ninguno" | "estudiante" | "infantil" | "adultoMayor"
// precio: valor ya calculado sobre la tarifa de la localidad en esa función.
// codigo: identificador único impreso en la boleta.
// estado: "reservada" | "pagada" | "usada" | "cancelada"
const boletas = [
  {
    id: 1,
    asistenteId: 1,
    funcionId: 1,
    localidadId: 1,
    fila: 2,
    numero: 7,
    tipoDescuento: "ninguno",
    precio: 75000,
    codigo: "BOL-2026-0001",
    estado: "pagada"
  },
  {
    id: 2,
    asistenteId: 3,
    funcionId: 1,
    localidadId: 2,
    fila: 4,
    numero: 12,
    tipoDescuento: "estudiante",
    precio: 44000,
    codigo: "BOL-2026-0002",
    estado: "pagada"
  },
  {
    id: 3,
    asistenteId: 4,
    funcionId: 1,
    localidadId: 3,
    fila: 1,
    numero: 5,
    tipoDescuento: "adultoMayor",
    precio: 26600,
    codigo: "BOL-2026-0003",
    estado: "reservada"
  },
  {
    id: 4,
    asistenteId: 5,
    funcionId: 4,
    localidadId: 2,
    fila: 3,
    numero: 9,
    tipoDescuento: "infantil",
    precio: 9000,
    codigo: "BOL-2026-0004",
    estado: "pagada"
  },
  {
    id: 5,
    asistenteId: 2,
    funcionId: 4,
    localidadId: 1,
    fila: 1,
    numero: 15,
    tipoDescuento: "ninguno",
    precio: 25000,
    codigo: "BOL-2026-0005",
    estado: "pagada"
  },
  {
    id: 6,
    asistenteId: 2,
    funcionId: 6,
    localidadId: 2,
    fila: 5,
    numero: 3,
    tipoDescuento: "ninguno",
    precio: 55000,
    codigo: "BOL-2026-0006",
    estado: "usada"
  },
  {
    id: 7,
    asistenteId: 1,
    funcionId: 7,
    localidadId: 1,
    fila: 3,
    numero: 10,
    tipoDescuento: "ninguno",
    precio: 95000,
    codigo: "BOL-2026-0007",
    estado: "cancelada"
  }
];

// ========================================
// Exportaciones
// ========================================
module.exports = boletas;
