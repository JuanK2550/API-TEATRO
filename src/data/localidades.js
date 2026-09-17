// ========================================
// Localidades
// ========================================
// Zonas fijas de la única sala del teatro.
// orden indica la cercanía al escenario: 1 es la más cercana y la más cara.
// capacidad siempre es filas * butacasPorFila.
const localidades = [
  {
    id: 1,
    codigo: "PLA-PREF",
    nombre: "Platea Preferencial",
    orden: 1,
    filas: 5,
    butacasPorFila: 20,
    capacidad: 100,
    activa: true
  },
  {
    id: 2,
    codigo: "PLA-GEN",
    nombre: "Platea General",
    orden: 2,
    filas: 10,
    butacasPorFila: 20,
    capacidad: 200,
    activa: true
  },
  {
    id: 3,
    codigo: "BAL",
    nombre: "Balcón",
    orden: 3,
    filas: 6,
    butacasPorFila: 25,
    capacidad: 150,
    activa: true
  }
];

// ========================================
// Exportaciones
// ========================================
module.exports = localidades;
