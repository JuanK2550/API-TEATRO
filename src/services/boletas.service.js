// ========================================
// Importaciones
// ========================================
const boletas = require("../data/boletas");

// ========================================
// Descuentos
// Única fuente de los porcentajes
// ========================================
const PORCENTAJES_DESCUENTO = {
  ninguno: 0,
  estudiante: 0.2,
  infantil: 0.5,
  adultoMayor: 0.3
};

const TIPOS_DESCUENTO = Object.keys(PORCENTAJES_DESCUENTO);
const DESCUENTO_POR_DEFECTO = "ninguno";

// ========================================
// Límites de venta
// ========================================
const LIMITE_BOLETAS_POR_ASISTENTE = 6;

// ========================================
// Máquina de estados
// Toda boleta nace reservada; usada y cancelada son terminales
// ========================================
const ESTADO_INICIAL = "reservada";

const TRANSICIONES = {
  reservada: ["pagada", "cancelada"],
  pagada: ["usada", "cancelada"],
  usada: [],
  cancelada: []
};

const ESTADOS = Object.keys(TRANSICIONES);

const ESTADOS_MODIFICABLES = ["reservada"];
const ESTADOS_ELIMINABLES = ["reservada", "cancelada"];

// ========================================
// Transición permitida
// ========================================
const esTransicionPermitida = (estadoActual, estadoNuevo) =>
  (TRANSICIONES[estadoActual] || []).includes(estadoNuevo);

// ========================================
// Boleta modificable
// ========================================
const esBoletaModificable = (estado) => ESTADOS_MODIFICABLES.includes(estado);

// ========================================
// Boleta eliminable
// ========================================
const esBoletaEliminable = (estado) => ESTADOS_ELIMINABLES.includes(estado);

// ========================================
// Utilidades internas
// El id nuevo es el mayor existente más uno
// ========================================
const generarId = () =>
  boletas.length === 0 ? 1 : Math.max(...boletas.map((b) => b.id)) + 1;

const buscarIndice = (id) => boletas.findIndex((b) => b.id === Number(id));

// Una boleta cancelada libera la butaca y deja de contar para los límites.
const estaActiva = (boleta) => boleta.estado !== "cancelada";

// ========================================
// Obtener todas
// ========================================
const obtenerBoletas = () => boletas;

// ========================================
// Obtener por id
// ========================================
const obtenerBoletaPorId = (id) => {
  const boleta = boletas.find((b) => b.id === Number(id));
  return boleta || null;
};

// ========================================
// Obtener por función
// ========================================
const obtenerBoletasPorFuncion = (funcionId) =>
  boletas.filter((b) => b.funcionId === Number(funcionId));

// ========================================
// Obtener por asistente
// ========================================
const obtenerBoletasPorAsistente = (asistenteId) =>
  boletas.filter((b) => b.asistenteId === Number(asistenteId));

// ========================================
// Existen boletas activas de una función
// La usa funciones.controller.js para proteger el borrado
// ========================================
const existenBoletasActivasDeFuncion = (funcionId) =>
  boletas.some((b) => b.funcionId === Number(funcionId) && estaActiva(b));

// ========================================
// Butaca ocupada
// boletaIdExcluir evita que una boleta choque consigo misma al actualizarse
// ========================================
const butacaOcupada = (
  funcionId,
  localidadId,
  fila,
  numero,
  boletaIdExcluir = null
) =>
  boletas.some(
    (b) =>
      b.funcionId === Number(funcionId) &&
      b.localidadId === Number(localidadId) &&
      b.fila === Number(fila) &&
      b.numero === Number(numero) &&
      estaActiva(b) &&
      b.id !== Number(boletaIdExcluir)
  );

// ========================================
// Contar por función y localidad
// ========================================
const contarBoletasPorFuncionYLocalidad = (
  funcionId,
  localidadId,
  boletaIdExcluir = null
) =>
  boletas.filter(
    (b) =>
      b.funcionId === Number(funcionId) &&
      b.localidadId === Number(localidadId) &&
      estaActiva(b) &&
      b.id !== Number(boletaIdExcluir)
  ).length;

// ========================================
// Contar por asistente y función
// ========================================
const contarBoletasPorAsistenteYFuncion = (
  asistenteId,
  funcionId,
  boletaIdExcluir = null
) =>
  boletas.filter(
    (b) =>
      b.asistenteId === Number(asistenteId) &&
      b.funcionId === Number(funcionId) &&
      estaActiva(b) &&
      b.id !== Number(boletaIdExcluir)
  ).length;

// ========================================
// Cálculo del precio
// ========================================
// El precio JAMÁS proviene del cliente. Siempre se calcula aquí a partir de
// la tarifa que la función tiene registrada para esa localidad, aplicando el
// porcentaje de la tabla de descuentos. Aunque el cliente envíe un campo
// precio en el cuerpo, el validador no lo declara, matchedData lo descarta y
// el valor que se guarda es el que devuelve esta función.
const calcularPrecio = (funcion, localidadId, tipoDescuento) => {
  const tarifa = funcion.tarifas.find(
    (t) => t.localidadId === Number(localidadId)
  );

  if (!tarifa) return null;

  const porcentaje = PORCENTAJES_DESCUENTO[tipoDescuento] ?? 0;

  return Math.round(tarifa.precio * (1 - porcentaje));
};

// ========================================
// Generación del código
// Formato BOL-<año>-<consecutivo de 4 dígitos>, único
// ========================================
const generarCodigo = () => {
  const anio = new Date().getFullYear();
  const prefijo = `BOL-${anio}-`;

  const consecutivos = boletas
    .filter((b) => typeof b.codigo === "string" && b.codigo.startsWith(prefijo))
    .map((b) => Number(b.codigo.slice(prefijo.length)))
    .filter((n) => Number.isInteger(n));

  let siguiente = consecutivos.length === 0 ? 1 : Math.max(...consecutivos) + 1;
  let codigo = prefijo + String(siguiente).padStart(4, "0");

  while (boletas.some((b) => b.codigo === codigo)) {
    siguiente += 1;
    codigo = prefijo + String(siguiente).padStart(4, "0");
  }

  return codigo;
};

// ========================================
// Crear
// ========================================
// El cliente nunca envía precio, codigo ni estado: los tres los administra
// el servidor. Toda boleta nace reservada.
const crearBoleta = (datos, funcion) => {
  const tipoDescuento = datos.tipoDescuento ?? DESCUENTO_POR_DEFECTO;

  const boleta = {
    id: generarId(),
    asistenteId: datos.asistenteId,
    funcionId: datos.funcionId,
    localidadId: datos.localidadId,
    fila: datos.fila,
    numero: datos.numero,
    tipoDescuento,
    precio: calcularPrecio(funcion, datos.localidadId, tipoDescuento),
    codigo: generarCodigo(),
    estado: ESTADO_INICIAL
  };

  boletas.push(boleta);
  return boleta;
};

// ========================================
// Actualizar completo
// Conserva el id, el codigo y el estado, y recalcula el precio
// ========================================
const actualizarBoleta = (id, datos, funcion) => {
  const indice = buscarIndice(id);
  if (indice === -1) return null;

  const actual = boletas[indice];
  const tipoDescuento = datos.tipoDescuento ?? DESCUENTO_POR_DEFECTO;

  boletas[indice] = {
    id: actual.id,
    asistenteId: datos.asistenteId,
    funcionId: datos.funcionId,
    localidadId: datos.localidadId,
    fila: datos.fila,
    numero: datos.numero,
    tipoDescuento,
    precio: calcularPrecio(funcion, datos.localidadId, tipoDescuento),
    codigo: actual.codigo,
    estado: actual.estado
  };

  return boletas[indice];
};

// ========================================
// Actualizar parcial
// Los campos que no llegan conservan su valor y el precio se recalcula
// ========================================
const actualizarBoletaParcial = (id, datos, funcion) => {
  const indice = buscarIndice(id);
  if (indice === -1) return null;

  const actual = boletas[indice];
  const localidadId = datos.localidadId ?? actual.localidadId;
  const tipoDescuento = datos.tipoDescuento ?? actual.tipoDescuento;

  boletas[indice] = {
    id: actual.id,
    asistenteId: datos.asistenteId ?? actual.asistenteId,
    funcionId: datos.funcionId ?? actual.funcionId,
    localidadId,
    fila: datos.fila ?? actual.fila,
    numero: datos.numero ?? actual.numero,
    tipoDescuento,
    precio: calcularPrecio(funcion, localidadId, tipoDescuento),
    codigo: actual.codigo,
    estado: actual.estado
  };

  return boletas[indice];
};

// ========================================
// Cambiar estado
// Único punto donde se modifica el estado
// ========================================
const cambiarEstadoBoleta = (id, estado) => {
  const indice = buscarIndice(id);
  if (indice === -1) return null;

  boletas[indice].estado = estado;
  return boletas[indice];
};

// ========================================
// Eliminar
// ========================================
const eliminarBoleta = (id) => {
  const indice = buscarIndice(id);
  if (indice === -1) return null;

  const [eliminada] = boletas.splice(indice, 1);
  return eliminada;
};

// ========================================
// Integridad referencial
// Cuentan todas las boletas, incluidas las canceladas
// ========================================
const asistenteTieneBoletas = (asistenteId) =>
  boletas.some((b) => b.asistenteId === Number(asistenteId));

const funcionTieneBoletas = (funcionId) =>
  boletas.some((b) => b.funcionId === Number(funcionId));

const localidadTieneBoletas = (localidadId) =>
  boletas.some((b) => b.localidadId === Number(localidadId));

// ========================================
// Exportaciones
// ========================================
module.exports = {
  PORCENTAJES_DESCUENTO,
  TIPOS_DESCUENTO,
  DESCUENTO_POR_DEFECTO,
  LIMITE_BOLETAS_POR_ASISTENTE,
  ESTADOS,
  ESTADO_INICIAL,
  TRANSICIONES,
  esTransicionPermitida,
  esBoletaModificable,
  esBoletaEliminable,
  obtenerBoletas,
  obtenerBoletaPorId,
  obtenerBoletasPorFuncion,
  obtenerBoletasPorAsistente,
  existenBoletasActivasDeFuncion,
  asistenteTieneBoletas,
  funcionTieneBoletas,
  localidadTieneBoletas,
  butacaOcupada,
  contarBoletasPorFuncionYLocalidad,
  contarBoletasPorAsistenteYFuncion,
  calcularPrecio,
  generarCodigo,
  crearBoleta,
  actualizarBoleta,
  actualizarBoletaParcial,
  cambiarEstadoBoleta,
  eliminarBoleta
};
