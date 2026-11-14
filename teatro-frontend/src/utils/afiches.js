import obra from "../assets/afiches/afiche-obra-900.webp";
import concierto from "../assets/afiches/afiche-concierto-900.webp";
import cine from "../assets/afiches/afiche-cine-900.webp";
import institucional from "../assets/afiches/afiche-institucional-900.webp";
import musicaJoven from "../assets/afiches/afiche-musica-joven-900.webp";
import ballet from "../assets/afiches/afiche-ballet-900.webp";
import jazz from "../assets/afiches/afiche-jazz-900.webp";
import infantil from "../assets/afiches/afiche-infantil-900.webp";
import cineMudo from "../assets/afiches/afiche-cine-mudo-900.webp";
import foro from "../assets/afiches/afiche-foro-900.webp";

// ========================================
// Afiche de cada tipo de evento
// ========================================
const POR_TIPO = {
  obra: { src: obra, alt: "Tres actores en silueta sobre un telón rojo iluminado" },
  concierto: { src: concierto, alt: "Violinistas de una orquesta tocando durante un concierto" },
  cine: { src: cine, alt: "Proyector de cine encendido en una sala a oscuras" },
  institucional: { src: institucional, alt: "Público asistiendo a un acto en un auditorio" }
};

// ========================================
// Afiche propio de los eventos de la programación
// Así la cartelera no repite la misma foto tres veces
// ========================================
const POR_EVENTO = {
  1: POR_TIPO.obra,
  2: POR_TIPO.concierto,
  3: POR_TIPO.cine,
  4: POR_TIPO.institucional,
  5: { src: musicaJoven, alt: "Músico en el escenario entre luces y humo" },
  6: { src: ballet, alt: "Bailarina en movimiento con falda larga sobre fondo oscuro" },
  7: { src: jazz, alt: "Saxofones de una big band iluminados en el escenario" },
  8: { src: infantil, alt: "Mesa con colores y materiales de un taller infantil" },
  9: { src: cineMudo, alt: "Claqueta de cine sostenida a contraluz" },
  10: { src: musicaJoven, alt: "Músico en el escenario entre luces y humo" },
  11: { src: foro, alt: "Micrófono en primer plano frente a un público reunido" }
};

// Un evento nuevo, sin foto propia, toma la de su tipo.
export const aficheDe = (evento) => POR_EVENTO[evento?.id] ?? POR_TIPO[evento?.tipo] ?? POR_TIPO.obra;
