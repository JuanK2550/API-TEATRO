// ========================================
// Pesos colombianos, sin decimales
// ========================================
const PESOS = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0
});

export const formatearPesos = (valor) => (Number.isFinite(Number(valor)) ? PESOS.format(Number(valor)) : "—");

// ========================================
// Fechas YYYY-MM-DD sin desfase de zona horaria
// ========================================
export function aFechaLocal(texto) {
  const [anio, mes, dia] = String(texto).slice(0, 10).split("-").map(Number);
  return new Date(anio, mes - 1, dia);
}

export function aTextoFecha(fecha) {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

const FECHA_CORTA = new Intl.DateTimeFormat("es-CO", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
const FECHA_LARGA = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

export const mayusculaInicial = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1);

export const formatearFecha = (texto) => (texto ? FECHA_CORTA.format(aFechaLocal(texto)) : "—");
export const formatearFechaLarga = (fecha) => mayusculaInicial(FECHA_LARGA.format(fecha));

export const hoyComoTexto = () => aTextoFecha(new Date());

// ========================================
// Etiquetas legibles de los valores de la API
// ========================================
export const ETIQUETAS_ESTADO = {
  programada: "Programada",
  en_venta: "En venta",
  agotada: "Agotada",
  en_curso: "En curso",
  finalizada: "Finalizada",
  cancelada: "Cancelada",
  reservada: "Reservada",
  pagada: "Pagada",
  usada: "Usada"
};

export const ETIQUETAS_ROL = {
  administrador: "Administrador",
  taquilla: "Taquilla",
  asistente: "Asistente"
};

export const ETIQUETAS_DESCUENTO = {
  ninguno: "Sin descuento",
  estudiante: "Estudiante (20 %)",
  infantil: "Infantil (50 %)",
  adultoMayor: "Adulto mayor (30 %)"
};

export const ETIQUETAS_TIPO_EVENTO = {
  obra: "Obra",
  concierto: "Concierto",
  cine: "Cine",
  institucional: "Institucional"
};

export const etiquetaEstado = (estado) => ETIQUETAS_ESTADO[estado] ?? estado;

// ========================================
// Búsqueda sin tildes ni mayúsculas
// ========================================
const normalizar = (texto) =>
  String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export const coincide = (texto, consulta) => normalizar(texto).includes(normalizar(consulta).trim());

// ========================================
// Índice por id de una lista de la API
// ========================================
export const indexarPorId = (lista) => new Map((Array.isArray(lista) ? lista : []).map((item) => [item.id, item]));

// ========================================
// Serie de los seis últimos meses con datos
// ========================================
export function contarPorMes(fechas) {
  const meses = new Map();
  for (const fecha of fechas) {
    const mes = String(fecha).slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(mes)) meses.set(mes, (meses.get(mes) || 0) + 1);
  }
  return [...meses.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([mes, total]) => ({ mes, total }));
}
