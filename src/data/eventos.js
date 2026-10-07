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
  },
  {
    id: 6,
    titulo: "Ballet Folclórico de Boyacá",
    tipo: "obra",
    descripcion:
      "Danzas tradicionales del altiplano con el cuerpo de baile del departamento, acompañadas por música en vivo.",
    duracionMinutos: 85,
    clasificacionEdad: "G",
    activo: true
  },
  {
    id: 7,
    titulo: "Noche de Jazz: Tunja Big Band",
    tipo: "concierto",
    descripcion:
      "La big band de la ciudad repasa el repertorio clásico del swing y del jazz latino en formato de catorce músicos.",
    duracionMinutos: 80,
    clasificacionEdad: "G",
    activo: true
  },
  {
    id: 8,
    titulo: "El Gato con Botas",
    tipo: "obra",
    descripcion:
      "Función infantil con títeres y narración en vivo, pensada para público familiar y colegios de la ciudad.",
    duracionMinutos: 55,
    clasificacionEdad: "G",
    activo: true
  },
  {
    id: 9,
    titulo: "Ciclo de Cine Mudo con Piano en Vivo",
    tipo: "cine",
    descripcion:
      "Proyección de cortometrajes mudos de los años veinte, acompañados al piano por un intérprete en la sala.",
    duracionMinutos: 92,
    clasificacionEdad: "+7",
    activo: true
  },
  {
    id: 10,
    titulo: "Festival de Música Joven de Boyacá",
    tipo: "concierto",
    descripcion:
      "Tres agrupaciones emergentes del departamento comparten escenario en una noche de música en vivo.",
    duracionMinutos: 120,
    clasificacionEdad: "+12",
    activo: true
  },
  {
    id: 11,
    titulo: "Foro Abierto: Patrimonio y Ciudad",
    tipo: "institucional",
    descripcion:
      "Conversación pública sobre el patrimonio arquitectónico del centro histórico de Tunja, con entrada libre.",
    duracionMinutos: 120,
    clasificacionEdad: "G",
    activo: true
  }
];

// ========================================
// Exportaciones
// ========================================
module.exports = eventos;
