// ========================================
// Importaciones
// ========================================
const asistentes = require("../data/asistentes");

// ========================================
// Utilidades internas
// El id nuevo es el mayor existente más uno
// ========================================
const generarId = () =>
  asistentes.length === 0 ? 1 : Math.max(...asistentes.map((a) => a.id)) + 1;

const buscarIndice = (id) => asistentes.findIndex((a) => a.id === Number(id));

// ========================================
// Obtener todos
// ========================================
const obtenerAsistentes = () => asistentes;

// ========================================
// Obtener por id
// ========================================
const obtenerAsistentePorId = (id) => {
  const asistente = asistentes.find((a) => a.id === Number(id));
  return asistente || null;
};

// ========================================
// Buscar por documento
// idExcluido evita que un registro choque consigo mismo al actualizarse
// ========================================
const buscarAsistentePorDocumento = (documento, idExcluido = null) => {
  const asistente = asistentes.find(
    (a) => a.documento === documento && a.id !== Number(idExcluido)
  );
  return asistente || null;
};

// ========================================
// Crear
// ========================================
const crearAsistente = (datos) => {
  const asistente = {
    id: generarId(),
    nombre: datos.nombre,
    documento: datos.documento,
    email: datos.email,
    telefono: datos.telefono,
    fechaNacimiento: datos.fechaNacimiento
  };

  asistentes.push(asistente);
  return asistente;
};

// ========================================
// Actualizar completo
// Reemplaza todos los campos y conserva el id
// ========================================
const actualizarAsistente = (id, datos) => {
  const indice = buscarIndice(id);
  if (indice === -1) return null;

  asistentes[indice] = {
    id: asistentes[indice].id,
    nombre: datos.nombre,
    documento: datos.documento,
    email: datos.email,
    telefono: datos.telefono,
    fechaNacimiento: datos.fechaNacimiento
  };

  return asistentes[indice];
};

// ========================================
// Actualizar parcial
// Los campos que no llegan conservan su valor
// ========================================
const actualizarAsistenteParcial = (id, datos) => {
  const indice = buscarIndice(id);
  if (indice === -1) return null;

  const actual = asistentes[indice];

  asistentes[indice] = {
    id: actual.id,
    nombre: datos.nombre ?? actual.nombre,
    documento: datos.documento ?? actual.documento,
    email: datos.email ?? actual.email,
    telefono: datos.telefono ?? actual.telefono,
    fechaNacimiento: datos.fechaNacimiento ?? actual.fechaNacimiento
  };

  return asistentes[indice];
};

// ========================================
// Eliminar
// ========================================
const eliminarAsistente = (id) => {
  const indice = buscarIndice(id);
  if (indice === -1) return null;

  const [eliminado] = asistentes.splice(indice, 1);
  return eliminado;
};

// ========================================
// Exportaciones
// ========================================
module.exports = {
  obtenerAsistentes,
  obtenerAsistentePorId,
  buscarAsistentePorDocumento,
  crearAsistente,
  actualizarAsistente,
  actualizarAsistenteParcial,
  eliminarAsistente
};
