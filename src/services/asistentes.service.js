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
// Buscar por usuario
// Qué asistente corresponde a una cuenta
// ========================================
const buscarAsistentePorUsuario = (usuarioId) => {
  const asistente = asistentes.find((a) => a.usuarioId === Number(usuarioId));
  return asistente || null;
};

// ========================================
// Crear
// usuarioId lo pone el controlador desde el token, nunca el cliente
// ========================================
// El cliente no declara usuarioId en ningún validador, así que matchedData lo
// descarta. El vínculo con la cuenta sale del JWT o se queda en null: es la
// diferencia entre un asistente que se identifica solo y uno que registró la
// taquilla.
const crearAsistente = (datos, usuarioId = null) => {
  const asistente = {
    id: generarId(),
    nombre: datos.nombre,
    documento: datos.documento,
    email: datos.email,
    telefono: datos.telefono,
    fechaNacimiento: datos.fechaNacimiento,
    usuarioId: usuarioId === null ? null : Number(usuarioId)
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
    fechaNacimiento: datos.fechaNacimiento,
    // ========================================
    // El vínculo con la cuenta
    // Se fija si llega, se conserva si no: nunca se borra por omisión
    // ========================================
    usuarioId: datos.usuarioId ?? asistentes[indice].usuarioId
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
    fechaNacimiento: datos.fechaNacimiento ?? actual.fechaNacimiento,
    usuarioId: datos.usuarioId ?? actual.usuarioId
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
  buscarAsistentePorUsuario,
  crearAsistente,
  actualizarAsistente,
  actualizarAsistenteParcial,
  eliminarAsistente
};
