// ========================================
// Importaciones
// ========================================
const localidades = require("../data/localidades");

// ========================================
// Utilidades internas
// El id nuevo es el mayor existente más uno
// ========================================
const generarId = () =>
  localidades.length === 0 ? 1 : Math.max(...localidades.map((l) => l.id)) + 1;

const buscarIndice = (id) => localidades.findIndex((l) => l.id === Number(id));

// La capacidad la administra la API, nunca llega del cliente.
const calcularCapacidad = (filas, butacasPorFila) => filas * butacasPorFila;

// ========================================
// Obtener todas
// ========================================
const obtenerLocalidades = () => localidades;

// ========================================
// Obtener por id
// ========================================
const obtenerLocalidadPorId = (id) => {
  const localidad = localidades.find((l) => l.id === Number(id));
  return localidad || null;
};

// ========================================
// Buscar por código
// idExcluido evita que un registro choque consigo mismo al actualizarse
// ========================================
const buscarLocalidadPorCodigo = (codigo, idExcluido = null) => {
  const localidad = localidades.find(
    (l) => l.codigo === codigo && l.id !== Number(idExcluido)
  );
  return localidad || null;
};

// ========================================
// Buscar por orden
// Dos localidades no pueden estar a la misma distancia del escenario
// ========================================
const buscarLocalidadPorOrden = (orden, idExcluido = null) => {
  const localidad = localidades.find(
    (l) => l.orden === Number(orden) && l.id !== Number(idExcluido)
  );
  return localidad || null;
};

// ========================================
// Crear
// La capacidad se calcula y la localidad nace activa
// ========================================
const crearLocalidad = (datos) => {
  const localidad = {
    id: generarId(),
    codigo: datos.codigo,
    nombre: datos.nombre,
    orden: datos.orden,
    filas: datos.filas,
    butacasPorFila: datos.butacasPorFila,
    capacidad: calcularCapacidad(datos.filas, datos.butacasPorFila),
    activa: true
  };

  localidades.push(localidad);
  return localidad;
};

// ========================================
// Actualizar completo
// Conserva el id y el campo activa, y recalcula la capacidad
// ========================================
const actualizarLocalidad = (id, datos) => {
  const indice = buscarIndice(id);
  if (indice === -1) return null;

  const actual = localidades[indice];

  localidades[indice] = {
    id: actual.id,
    codigo: datos.codigo,
    nombre: datos.nombre,
    orden: datos.orden,
    filas: datos.filas,
    butacasPorFila: datos.butacasPorFila,
    capacidad: calcularCapacidad(datos.filas, datos.butacasPorFila),
    activa: actual.activa
  };

  return localidades[indice];
};

// ========================================
// Actualizar parcial
// Los campos que no llegan conservan su valor y la capacidad se recalcula
// ========================================
const actualizarLocalidadParcial = (id, datos) => {
  const indice = buscarIndice(id);
  if (indice === -1) return null;

  const actual = localidades[indice];
  const filas = datos.filas ?? actual.filas;
  const butacasPorFila = datos.butacasPorFila ?? actual.butacasPorFila;

  localidades[indice] = {
    id: actual.id,
    codigo: datos.codigo ?? actual.codigo,
    nombre: datos.nombre ?? actual.nombre,
    orden: datos.orden ?? actual.orden,
    filas,
    butacasPorFila,
    capacidad: calcularCapacidad(filas, butacasPorFila),
    activa: actual.activa
  };

  return localidades[indice];
};

// ========================================
// Cambiar estado
// Único punto donde se modifica el campo activa
// ========================================
const cambiarEstadoLocalidad = (id, activa) => {
  const indice = buscarIndice(id);
  if (indice === -1) return null;

  localidades[indice].activa = activa;
  return localidades[indice];
};

// ========================================
// Eliminar
// ========================================
const eliminarLocalidad = (id) => {
  const indice = buscarIndice(id);
  if (indice === -1) return null;

  const [eliminada] = localidades.splice(indice, 1);
  return eliminada;
};

// ========================================
// Exportaciones
// ========================================
module.exports = {
  obtenerLocalidades,
  obtenerLocalidadPorId,
  buscarLocalidadPorCodigo,
  buscarLocalidadPorOrden,
  crearLocalidad,
  actualizarLocalidad,
  actualizarLocalidadParcial,
  cambiarEstadoLocalidad,
  eliminarLocalidad
};
