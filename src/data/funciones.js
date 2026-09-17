// ========================================
// Funciones
// ========================================
// Presentaciones de un evento en una fecha y hora concretas.
// El teatro tiene una sola sala, por lo que la combinación fecha + hora
// es única: no pueden existir dos funciones simultáneas.
// estado: "programada" | "en_venta" | "agotada" | "en_curso" | "finalizada" | "cancelada"
// tarifas: un precio por localidad, mayor cuanto menor sea el orden de la localidad.
// descuentosHabilitados: "estudiante" | "infantil" | "adultoMayor"
const funciones = [
  {
    id: 1,
    eventoId: 1,
    fecha: "2027-02-18",
    hora: "19:00",
    estado: "en_venta",
    tarifas: [
      { localidadId: 1, precio: 75000 },
      { localidadId: 2, precio: 55000 },
      { localidadId: 3, precio: 38000 }
    ],
    descuentosHabilitados: ["estudiante", "adultoMayor"]
  },
  {
    id: 2,
    eventoId: 1,
    fecha: "2027-02-19",
    hora: "19:00",
    estado: "agotada",
    tarifas: [
      { localidadId: 1, precio: 75000 },
      { localidadId: 2, precio: 55000 },
      { localidadId: 3, precio: 38000 }
    ],
    descuentosHabilitados: ["estudiante", "adultoMayor"]
  },
  {
    id: 3,
    eventoId: 2,
    fecha: "2027-02-26",
    hora: "20:00",
    estado: "programada",
    tarifas: [
      { localidadId: 1, precio: 120000 },
      { localidadId: 2, precio: 90000 },
      { localidadId: 3, precio: 60000 }
    ],
    descuentosHabilitados: ["estudiante", "infantil", "adultoMayor"]
  },
  {
    id: 4,
    eventoId: 3,
    fecha: "2027-02-21",
    hora: "16:00",
    estado: "en_venta",
    tarifas: [
      { localidadId: 1, precio: 25000 },
      { localidadId: 2, precio: 18000 },
      { localidadId: 3, precio: 12000 }
    ],
    descuentosHabilitados: ["estudiante", "infantil"]
  },
  {
    id: 5,
    eventoId: 4,
    fecha: "2027-03-05",
    hora: "10:00",
    estado: "programada",
    tarifas: [
      { localidadId: 1, precio: 40000 },
      { localidadId: 2, precio: 30000 },
      { localidadId: 3, precio: 20000 }
    ],
    descuentosHabilitados: []
  },
  {
    id: 6,
    eventoId: 1,
    fecha: "2026-09-05",
    hora: "19:00",
    estado: "finalizada",
    tarifas: [
      { localidadId: 1, precio: 75000 },
      { localidadId: 2, precio: 55000 },
      { localidadId: 3, precio: 38000 }
    ],
    descuentosHabilitados: ["estudiante", "adultoMayor"]
  },
  {
    id: 7,
    eventoId: 5,
    fecha: "2026-09-12",
    hora: "20:00",
    estado: "cancelada",
    tarifas: [
      { localidadId: 1, precio: 95000 },
      { localidadId: 2, precio: 70000 },
      { localidadId: 3, precio: 45000 }
    ],
    descuentosHabilitados: ["estudiante"]
  }
];

// ========================================
// Exportaciones
// ========================================
module.exports = funciones;
