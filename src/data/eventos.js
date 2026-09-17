// ========================================
// Eventos
// ========================================
// Espectáculos del teatro. Un evento puede tener varias funciones.
// tipo: "obra" | "concierto" | "cine" | "institucional"
// clasificacionEdad: "G" | "+7" | "+12" | "+15" | "+18"
const eventos = [
  {
    id: 1,
    titulo: "La Casa de Bernarda Alba",
    tipo: "obra",
    descripcion:
      "Montaje de la obra de Federico García Lorca a cargo del grupo de teatro de la UPTC.",
    duracionMinutos: 110,
    clasificacionEdad: "+12",
    activo: true
  },
  {
    id: 2,
    titulo: "Concierto de Gala de la Orquesta Filarmónica de Boyacá",
    tipo: "concierto",
    descripcion:
      "Programa sinfónico con obras de Beethoven y compositores boyacenses.",
    duracionMinutos: 95,
    clasificacionEdad: "G",
    activo: true
  },
  {
    id: 3,
    titulo: "Ciclo de Cine Colombiano: La Estrategia del Caracol",
    tipo: "cine",
    descripcion:
      "Proyección en formato digital con conversatorio posterior sobre cine nacional.",
    duracionMinutos: 116,
    clasificacionEdad: "+12",
    activo: true
  },
  {
    id: 4,
    titulo: "Ceremonia de Grados UPTC 2026-II",
    tipo: "institucional",
    descripcion:
      "Ceremonia de grados de la Universidad Pedagógica y Tecnológica de Colombia.",
    duracionMinutos: 180,
    clasificacionEdad: "G",
    activo: true
  },
  {
    id: 5,
    titulo: "Noche de Bandas Tunjanas",
    tipo: "concierto",
    descripcion:
      "Encuentro de rock y música alternativa con agrupaciones locales de Tunja.",
    duracionMinutos: 150,
    clasificacionEdad: "+15",
    activo: false
  }
];

// ========================================
// Exportaciones
// ========================================
module.exports = eventos;
