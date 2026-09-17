// ========================================
// Importaciones
// ========================================
const { matchedData } = require("express-validator");

const boletasService = require("../services/boletas.service");
const asistentesService = require("../services/asistentes.service");
const funcionesService = require("../services/funciones.service");
const localidadesService = require("../services/localidades.service");

// ========================================
// Lectura del cuerpo
// ========================================
// matchedData devuelve solo los campos declarados en el validador, por lo que
// cualquier campo extra enviado por el cliente se descarta. Es la protección
// contra Mass Assignment: nunca se lee req.body directamente. Aquí es lo más
// importante del recurso: aunque el cliente mande "precio": 1, "codigo" o
// "estado", esos campos no están declarados, no llegan hasta aquí y el
// servidor los calcula por su cuenta.
const leerDatos = (req) => matchedData(req, { locations: ["body"] });

// ========================================
// Estados de la función que condicionan la venta
// ========================================
const ESTADO_FUNCION_EN_VENTA = "en_venta";
const ESTADO_FUNCION_PARA_USAR = "en_curso";

// ========================================
// Validar relaciones
// Devuelve null o { status, mensaje }, con status como código HTTP
// ========================================
const validarRelacionesBoleta = (datos) => {
  // 1. El asistente debe existir.
  if (!asistentesService.obtenerAsistentePorId(datos.asistenteId)) {
    return { status: 400, mensaje: "El asistente indicado no existe" };
  }

  // 2. La función debe existir.
  const funcion = funcionesService.obtenerFuncionPorId(datos.funcionId);

  if (!funcion) {
    return { status: 400, mensaje: "La función indicada no existe" };
  }

  // 3. Solo se venden boletas de funciones en venta.
  if (funcion.estado !== ESTADO_FUNCION_EN_VENTA) {
    return {
      status: 409,
      mensaje: `No se pueden vender boletas de una función en estado ${funcion.estado}`
    };
  }

  // 4. La localidad debe existir y estar activa.
  const localidad = localidadesService.obtenerLocalidadPorId(datos.localidadId);

  if (!localidad) {
    return { status: 400, mensaje: "La localidad indicada no existe" };
  }

  if (!localidad.activa) {
    return {
      status: 409,
      mensaje: `La localidad ${localidad.nombre} no está activa`
    };
  }

  // 5. La localidad debe tener tarifa en esa función.
  const tieneTarifa = funcion.tarifas.some(
    (t) => t.localidadId === localidad.id
  );

  if (!tieneTarifa) {
    return {
      status: 409,
      mensaje: "La localidad no tiene tarifa asignada en esta función"
    };
  }

  // 6. La butaca debe existir dentro del aforo de la localidad.
  if (datos.fila > localidad.filas || datos.numero > localidad.butacasPorFila) {
    return { status: 409, mensaje: "La butaca no existe en esta localidad" };
  }

  // 7. El descuento aplicado debe estar habilitado en esa función.
  const tipoDescuento = datos.tipoDescuento ?? boletasService.DESCUENTO_POR_DEFECTO;

  if (
    tipoDescuento !== boletasService.DESCUENTO_POR_DEFECTO &&
    !funcion.descuentosHabilitados.includes(tipoDescuento)
  ) {
    return {
      status: 409,
      mensaje: `El descuento ${tipoDescuento} no está habilitado para esta función`
    };
  }

  return null;
};

// ========================================
// Validar disponibilidad
// boletaIdExcluir excluye la propia boleta al actualizarse
// ========================================
const validarDisponibilidadBoleta = (datos, boletaIdExcluir = null) => {
  // 1. La butaca no puede estar ocupada por otra boleta viva.
  if (
    boletasService.butacaOcupada(
      datos.funcionId,
      datos.localidadId,
      datos.fila,
      datos.numero,
      boletaIdExcluir
    )
  ) {
    return {
      status: 409,
      mensaje: "La butaca ya está ocupada en esta función"
    };
  }

  // 2. No se puede superar el aforo de la localidad en esa función.
  const localidad = localidadesService.obtenerLocalidadPorId(datos.localidadId);
  const vendidas = boletasService.contarBoletasPorFuncionYLocalidad(
    datos.funcionId,
    datos.localidadId,
    boletaIdExcluir
  );

  if (vendidas >= localidad.capacidad) {
    return {
      status: 409,
      mensaje: "Se alcanzó el aforo de la localidad para esta función"
    };
  }

  // 3. Un mismo asistente no puede acaparar una función.
  const delAsistente = boletasService.contarBoletasPorAsistenteYFuncion(
    datos.asistenteId,
    datos.funcionId,
    boletaIdExcluir
  );

  if (delAsistente >= boletasService.LIMITE_BOLETAS_POR_ASISTENTE) {
    return {
      status: 409,
      mensaje: `Se superó el límite de ${boletasService.LIMITE_BOLETAS_POR_ASISTENTE} boletas por asistente en una función`
    };
  }

  return null;
};

// ========================================
// GET todas
// ========================================
const obtenerBoletas = (req, res) => {
  res.status(200).json(boletasService.obtenerBoletas());
};

// ========================================
// GET por asistente
// ========================================
const obtenerBoletasPorAsistente = (req, res) => {
  const { asistenteId } = req.params;

  if (!asistentesService.obtenerAsistentePorId(asistenteId)) {
    return res.status(404).json({ mensaje: "Asistente no encontrado" });
  }

  res.status(200).json(boletasService.obtenerBoletasPorAsistente(asistenteId));
};

// ========================================
// GET por función
// ========================================
const obtenerBoletasPorFuncion = (req, res) => {
  const { funcionId } = req.params;

  if (!funcionesService.obtenerFuncionPorId(funcionId)) {
    return res.status(404).json({ mensaje: "Función no encontrada" });
  }

  res.status(200).json(boletasService.obtenerBoletasPorFuncion(funcionId));
};

// ========================================
// GET por id
// ========================================
const obtenerBoletaPorId = (req, res) => {
  const boleta = boletasService.obtenerBoletaPorId(req.params.id);

  if (!boleta) {
    return res.status(404).json({ mensaje: "Boleta no encontrada" });
  }

  res.status(200).json(boleta);
};

// ========================================
// POST
// La boleta siempre nace reservada, con el precio y el codigo que calcula la API
// ========================================
const crearBoleta = (req, res) => {
  const datos = leerDatos(req);

  const problemaRelaciones = validarRelacionesBoleta(datos);
  if (problemaRelaciones) {
    return res
      .status(problemaRelaciones.status)
      .json({ mensaje: problemaRelaciones.mensaje });
  }

  const problemaDisponibilidad = validarDisponibilidadBoleta(datos);
  if (problemaDisponibilidad) {
    return res
      .status(problemaDisponibilidad.status)
      .json({ mensaje: problemaDisponibilidad.mensaje });
  }

  const funcion = funcionesService.obtenerFuncionPorId(datos.funcionId);
  const boleta = boletasService.crearBoleta(datos, funcion);

  res.status(201).json({ mensaje: "Boleta creada correctamente", boleta });
};

// ========================================
// PUT
// Solo se modifica una boleta reservada; el precio se recalcula
// ========================================
const actualizarBoleta = (req, res) => {
  const { id } = req.params;
  const datos = leerDatos(req);

  const actual = boletasService.obtenerBoletaPorId(id);

  if (!actual) {
    return res.status(404).json({ mensaje: "Boleta no encontrada" });
  }

  if (!boletasService.esBoletaModificable(actual.estado)) {
    return res.status(409).json({
      mensaje: `No se puede modificar una boleta en estado ${actual.estado}`
    });
  }

  const problemaRelaciones = validarRelacionesBoleta(datos);
  if (problemaRelaciones) {
    return res
      .status(problemaRelaciones.status)
      .json({ mensaje: problemaRelaciones.mensaje });
  }

  const problemaDisponibilidad = validarDisponibilidadBoleta(datos, id);
  if (problemaDisponibilidad) {
    return res
      .status(problemaDisponibilidad.status)
      .json({ mensaje: problemaDisponibilidad.mensaje });
  }

  const funcion = funcionesService.obtenerFuncionPorId(datos.funcionId);
  const boleta = boletasService.actualizarBoleta(id, datos, funcion);

  res.status(200).json({ mensaje: "Boleta actualizada correctamente", boleta });
};

// ========================================
// PATCH
// Las reglas se comprueban sobre cómo queda la boleta después del cambio
// ========================================
const actualizarBoletaParcial = (req, res) => {
  const { id } = req.params;
  const datos = leerDatos(req);

  if (Object.keys(datos).length === 0) {
    return res
      .status(400)
      .json({ mensaje: "Debe enviar al menos un campo para actualizar" });
  }

  const actual = boletasService.obtenerBoletaPorId(id);

  if (!actual) {
    return res.status(404).json({ mensaje: "Boleta no encontrada" });
  }

  if (!boletasService.esBoletaModificable(actual.estado)) {
    return res.status(409).json({
      mensaje: `No se puede modificar una boleta en estado ${actual.estado}`
    });
  }

  const resultante = {
    asistenteId: datos.asistenteId ?? actual.asistenteId,
    funcionId: datos.funcionId ?? actual.funcionId,
    localidadId: datos.localidadId ?? actual.localidadId,
    fila: datos.fila ?? actual.fila,
    numero: datos.numero ?? actual.numero,
    tipoDescuento: datos.tipoDescuento ?? actual.tipoDescuento
  };

  const problemaRelaciones = validarRelacionesBoleta(resultante);
  if (problemaRelaciones) {
    return res
      .status(problemaRelaciones.status)
      .json({ mensaje: problemaRelaciones.mensaje });
  }

  const problemaDisponibilidad = validarDisponibilidadBoleta(resultante, id);
  if (problemaDisponibilidad) {
    return res
      .status(problemaDisponibilidad.status)
      .json({ mensaje: problemaDisponibilidad.mensaje });
  }

  const funcion = funcionesService.obtenerFuncionPorId(resultante.funcionId);
  const boleta = boletasService.actualizarBoletaParcial(id, datos, funcion);

  res.status(200).json({ mensaje: "Boleta actualizada correctamente", boleta });
};

// ========================================
// PATCH estado
// Validación en la puerta: solo se marca usada con la función en curso
// ========================================
const cambiarEstadoBoleta = (req, res) => {
  const { id } = req.params;
  const { estado } = leerDatos(req);

  const actual = boletasService.obtenerBoletaPorId(id);

  if (!actual) {
    return res.status(404).json({ mensaje: "Boleta no encontrada" });
  }

  if (!boletasService.esTransicionPermitida(actual.estado, estado)) {
    return res.status(409).json({
      mensaje: `No se permite cambiar una boleta de ${actual.estado} a ${estado}`
    });
  }

  if (estado === "usada") {
    const funcion = funcionesService.obtenerFuncionPorId(actual.funcionId);

    if (!funcion || funcion.estado !== ESTADO_FUNCION_PARA_USAR) {
      return res.status(409).json({
        mensaje: `Solo se puede marcar una boleta como usada si la función está en estado ${ESTADO_FUNCION_PARA_USAR}`
      });
    }
  }

  const boleta = boletasService.cambiarEstadoBoleta(id, estado);

  res.status(200).json({
    mensaje: `Boleta actualizada al estado ${estado}`,
    boleta
  });
};

// ========================================
// DELETE
// Solo se eliminan boletas reservadas o canceladas
// ========================================
const eliminarBoleta = (req, res) => {
  const { id } = req.params;

  const boleta = boletasService.obtenerBoletaPorId(id);

  if (!boleta) {
    return res.status(404).json({ mensaje: "Boleta no encontrada" });
  }

  if (!boletasService.esBoletaEliminable(boleta.estado)) {
    return res.status(409).json({
      mensaje: `No se puede eliminar una boleta en estado ${boleta.estado}`
    });
  }

  boletasService.eliminarBoleta(id);

  res.status(200).json({ mensaje: "Boleta eliminada correctamente" });
};

// ========================================
// Exportaciones
// ========================================
module.exports = {
  obtenerBoletas,
  obtenerBoletasPorAsistente,
  obtenerBoletasPorFuncion,
  obtenerBoletaPorId,
  crearBoleta,
  actualizarBoleta,
  actualizarBoletaParcial,
  cambiarEstadoBoleta,
  eliminarBoleta
};
