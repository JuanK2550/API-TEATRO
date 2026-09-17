// ========================================
// Importaciones
// ========================================
const eventos = require("../data/eventos");

// ========================================
// Utilidades internas
// El id nuevo es el mayor existente más uno
// ========================================
const generarId = () =>
  eventos.length === 0 ? 1 : Math.max(...eventos.map((e) => e.id)) + 1;

const buscarIndice = (id) => eventos.findIndex((e) => e.id === Number(id));

// ========================================
// Obtener todos
// ========================================
const obtenerEventos = () => eventos;

// ========================================
// Obtener por id
// ========================================
const obtenerEventoPorId = (id) => {
  const evento = eventos.find((e) => e.id === Number(id));
  return evento || null;
};

// ========================================
// Crear
// El campo activo lo administra la API: todo evento nace activo
// ========================================
const crearEvento = (datos) => {
  const evento = {
    id: generarId(),
    titulo: datos.titulo,
    tipo: datos.tipo,
    descripcion: datos.descripcion,
    duracionMinutos: datos.duracionMinutos,
    clasificacionEdad: datos.clasificacionEdad,
    activo: true
  };

  eventos.push(evento);
  return evento;
};

// ========================================
// Actualizar completo
// Conserva el id y el campo activo
// ========================================
const actualizarEvento = (id, datos) => {
  const indice = buscarIndice(id);
  if (indice === -1) return null;

  const actual = eventos[indice];

  eventos[indice] = {
    id: actual.id,
    titulo: datos.titulo,
    tipo: datos.tipo,
    descripcion: datos.descripcion,
    duracionMinutos: datos.duracionMinutos,
    clasificacionEdad: datos.clasificacionEdad,
    activo: actual.activo
  };

  return eventos[indice];
};

// ========================================
// Actualizar parcial
// Los campos que no llegan conservan su valor
// ========================================
const actualizarEventoParcial = (id, datos) => {
  const indice = buscarIndice(id);
  if (indice === -1) return null;

  const actual = eventos[indice];

  eventos[indice] = {
    id: actual.id,
    titulo: datos.titulo ?? actual.titulo,
    tipo: datos.tipo ?? actual.tipo,
    descripcion: datos.descripcion ?? actual.descripcion,
    duracionMinutos: datos.duracionMinutos ?? actual.duracionMinutos,
    clasificacionEdad: datos.clasificacionEdad ?? actual.clasificacionEdad,
    activo: actual.activo
  };

  return eventos[indice];
};

// ========================================
// Cambiar estado
// Único punto donde se modifica el campo activo
// ========================================
const cambiarEstadoEvento = (id, activo) => {
  const indice = buscarIndice(id);
  if (indice === -1) return null;

  eventos[indice].activo = activo;
  return eventos[indice];
};

// ========================================
// Eliminar
// ========================================
const eliminarEvento = (id) => {
  const indice = buscarIndice(id);
  if (indice === -1) return null;

  const [eliminado] = eventos.splice(indice, 1);
  return eliminado;
};

// ========================================
// Exportaciones
// ========================================
module.exports = {
  obtenerEventos,
  obtenerEventoPorId,
  crearEvento,
  actualizarEvento,
  actualizarEventoParcial,
  cambiarEstadoEvento,
  eliminarEvento
};
