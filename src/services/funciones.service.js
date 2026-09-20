// ========================================
// Importaciones
// ========================================
const funciones = require("../data/funciones");
const localidadesService = require("./localidades.service");

// ========================================
// Máquina de estados
// Toda función nace programada; finalizada y cancelada son terminales
// ========================================
const ESTADO_INICIAL = "programada";

const TRANSICIONES = {
  programada: ["en_venta", "cancelada"],
  en_venta: ["agotada", "en_curso", "cancelada"],
  agotada: ["en_curso", "cancelada"],
  en_curso: ["finalizada"],
  finalizada: [],
  cancelada: []
};

const ESTADOS = Object.keys(TRANSICIONES);

const ESTADOS_NO_MODIFICABLES = ["en_curso", "finalizada", "cancelada"];

// ========================================
// Transición permitida
// ========================================
const esTransicionPermitida = (estadoActual, estadoNuevo) =>
  (TRANSICIONES[estadoActual] || []).includes(estadoNuevo);

// ========================================
// Estado modificable
// ========================================
const esEstadoModificable = (estado) => !ESTADOS_NO_MODIFICABLES.includes(estado);

// ========================================
// Utilidades internas
// El id nuevo es el mayor existente más uno
// ========================================
const generarId = () =>
  funciones.length === 0 ? 1 : Math.max(...funciones.map((f) => f.id)) + 1;

const buscarIndice = (id) => funciones.findIndex((f) => f.id === Number(id));

// Deja cada tarifa con sus dos únicos campos válidos.
const normalizarTarifas = (tarifas) =>
  tarifas.map((t) => ({ localidadId: t.localidadId, precio: t.precio }));

// ========================================
// Obtener todas
// ========================================
const obtenerFunciones = () => funciones;

// ========================================
// Obtener por id
// ========================================
const obtenerFuncionPorId = (id) => {
  const funcion = funciones.find((f) => f.id === Number(id));
  return funcion || null;
};

// ========================================
// Obtener por evento
// ========================================
const obtenerFuncionesPorEvento = (eventoId) =>
  funciones.filter((f) => f.eventoId === Number(eventoId));

// ========================================
// Conflicto de agenda
// La sala es única: una función cancelada libera su franja
// ========================================
const funcionTieneConflicto = (fecha, hora, funcionIdExcluir = null) =>
  funciones.some(
    (f) =>
      f.fecha === fecha &&
      f.hora === hora &&
      f.estado !== "cancelada" &&
      f.id !== Number(funcionIdExcluir)
  );

// ========================================
// Obtener tarifas
// Devuelve los precios con los datos de cada localidad, ordenados por cercanía
// ========================================
const obtenerTarifasDeFuncion = (id) => {
  const funcion = obtenerFuncionPorId(id);
  if (!funcion) return null;

  const tarifas = funcion.tarifas
    .map((tarifa) => {
      const localidad = localidadesService.obtenerLocalidadPorId(
        tarifa.localidadId
      );

      return {
        localidadId: tarifa.localidadId,
        codigo: localidad ? localidad.codigo : null,
        nombre: localidad ? localidad.nombre : null,
        orden: localidad ? localidad.orden : null,
        activa: localidad ? localidad.activa : null,
        precio: tarifa.precio
      };
    })
    .sort((a, b) => (a.orden ?? Infinity) - (b.orden ?? Infinity));

  return {
    funcionId: funcion.id,
    eventoId: funcion.eventoId,
    fecha: funcion.fecha,
    hora: funcion.hora,
    estado: funcion.estado,
    tarifas,
    descuentosHabilitados: funcion.descuentosHabilitados
  };
};

// ========================================
// Crear
// El estado lo administra la API: toda función nace programada
// ========================================
const crearFuncion = (datos) => {
  const funcion = {
    id: generarId(),
    eventoId: datos.eventoId,
    fecha: datos.fecha,
    hora: datos.hora,
    estado: ESTADO_INICIAL,
    tarifas: normalizarTarifas(datos.tarifas),
    descuentosHabilitados: datos.descuentosHabilitados ?? []
  };

  funciones.push(funcion);
  return funcion;
};

// ========================================
// Actualizar completo
// Conserva el id y el estado
// ========================================
const actualizarFuncion = (id, datos) => {
  const indice = buscarIndice(id);
  if (indice === -1) return null;

  const actual = funciones[indice];

  funciones[indice] = {
    id: actual.id,
    eventoId: datos.eventoId,
    fecha: datos.fecha,
    hora: datos.hora,
    estado: actual.estado,
    tarifas: normalizarTarifas(datos.tarifas),
    descuentosHabilitados: datos.descuentosHabilitados ?? []
  };

  return funciones[indice];
};

// ========================================
// Actualizar parcial
// Los campos que no llegan conservan su valor
// ========================================
const actualizarFuncionParcial = (id, datos) => {
  const indice = buscarIndice(id);
  if (indice === -1) return null;

  const actual = funciones[indice];

  funciones[indice] = {
    id: actual.id,
    eventoId: datos.eventoId ?? actual.eventoId,
    fecha: datos.fecha ?? actual.fecha,
    hora: datos.hora ?? actual.hora,
    estado: actual.estado,
    tarifas: datos.tarifas
      ? normalizarTarifas(datos.tarifas)
      : actual.tarifas,
    descuentosHabilitados:
      datos.descuentosHabilitados ?? actual.descuentosHabilitados
  };

  return funciones[indice];
};

// ========================================
// Cambiar estado
// Único punto donde se modifica el estado
// ========================================
const cambiarEstadoFuncion = (id, estado) => {
  const indice = buscarIndice(id);
  if (indice === -1) return null;

  funciones[indice].estado = estado;
  return funciones[indice];
};

// ========================================
// Eliminar
// ========================================
const eliminarFuncion = (id) => {
  const indice = buscarIndice(id);
  if (indice === -1) return null;

  const [eliminada] = funciones.splice(indice, 1);
  return eliminada;
};

// ========================================
// Integridad referencial
// Cuentan todas las funciones, sea cual sea su estado
// ========================================
const eventoTieneFunciones = (eventoId) =>
  funciones.some((f) => f.eventoId === Number(eventoId));

const localidadTieneTarifas = (localidadId) =>
  funciones.some((f) =>
    f.tarifas.some((t) => t.localidadId === Number(localidadId))
  );

// ========================================
// Exportaciones
// ========================================
module.exports = {
  ESTADOS,
  ESTADO_INICIAL,
  TRANSICIONES,
  esTransicionPermitida,
  esEstadoModificable,
  obtenerFunciones,
  obtenerFuncionPorId,
  obtenerFuncionesPorEvento,
  obtenerTarifasDeFuncion,
  funcionTieneConflicto,
  eventoTieneFunciones,
  localidadTieneTarifas,
  crearFuncion,
  actualizarFuncion,
  actualizarFuncionParcial,
  cambiarEstadoFuncion,
  eliminarFuncion
};
