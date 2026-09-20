// ========================================
// Importaciones
// ========================================
const { matchedData } = require("express-validator");

const funcionesService = require("../services/funciones.service");
const eventosService = require("../services/eventos.service");
const localidadesService = require("../services/localidades.service");
const boletasService = require("../services/boletas.service");

// ========================================
// Lectura del cuerpo
// ========================================
// matchedData devuelve solo los campos declarados en el validador, por lo que
// cualquier campo extra enviado por el cliente se descarta. Es la protección
// contra Mass Assignment: nunca se lee req.body directamente. Por eso el
// campo estado, que no está declarado, jamás llega hasta el service.
const leerDatos = (req) => matchedData(req, { locations: ["body"] });

// ========================================
// Fecha en el pasado
// Compara solo el día, en UTC
// ========================================
const esFechaPasada = (fecha) => {
  const dia = new Date(`${fecha}T00:00:00Z`);
  const hoy = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  return dia.getTime() < hoy.getTime();
};

// ========================================
// Validar tarifas
// Reglas 5 a 8. Devuelve null o { status, mensaje }, con status como código HTTP
// ========================================
const validarTarifas = (tarifas) => {
  // Regla 5: cada localidad referenciada debe existir y estar activa.
  for (const tarifa of tarifas) {
    const localidad = localidadesService.obtenerLocalidadPorId(
      tarifa.localidadId
    );

    if (!localidad) {
      return {
        status: 400,
        mensaje: `La localidad con id ${tarifa.localidadId} no existe`
      };
    }

    if (!localidad.activa) {
      return {
        status: 409,
        mensaje: `La localidad ${localidad.nombre} no está activa`
      };
    }
  }

  // Regla 6: no puede haber dos tarifas para la misma localidad.
  const idsLocalidades = tarifas.map((t) => t.localidadId);

  if (new Set(idsLocalidades).size !== idsLocalidades.length) {
    return {
      status: 409,
      mensaje: "No puede haber dos tarifas para la misma localidad"
    };
  }

  // Regla 7: debe existir una tarifa para todas las localidades activas.
  const faltantes = localidadesService
    .obtenerLocalidades()
    .filter((l) => l.activa && !idsLocalidades.includes(l.id));

  if (faltantes.length > 0) {
    return {
      status: 409,
      mensaje: `Faltan tarifas para las localidades: ${faltantes
        .map((l) => l.nombre)
        .join(", ")}`
    };
  }

  // Regla 8: a menor orden, más cerca del escenario y mayor precio.
  const conLocalidad = tarifas.map((tarifa) => ({
    precio: tarifa.precio,
    localidad: localidadesService.obtenerLocalidadPorId(tarifa.localidadId)
  }));

  for (const cercana of conLocalidad) {
    for (const lejana of conLocalidad) {
      if (
        cercana.localidad.orden < lejana.localidad.orden &&
        cercana.precio <= lejana.precio
      ) {
        return {
          status: 409,
          mensaje: `El precio de ${cercana.localidad.nombre} debe ser mayor que el de ${lejana.localidad.nombre} por estar más cerca del escenario`
        };
      }
    }
  }

  return null;
};

// ========================================
// Validar reglas de la función
// Reglas 1 a 8. funcionIdExcluir excluye la propia función de la agenda
// ========================================
const validarReglasFuncion = (datos, funcionIdExcluir = null) => {
  // Regla 1: el evento debe existir.
  const evento = eventosService.obtenerEventoPorId(datos.eventoId);

  if (!evento) {
    return { status: 400, mensaje: "El evento indicado no existe" };
  }

  // Regla 2: el evento debe estar activo.
  if (!evento.activo) {
    return {
      status: 409,
      mensaje: "No se pueden programar funciones de un evento inactivo"
    };
  }

  // Regla 3: la fecha no puede estar en el pasado.
  if (esFechaPasada(datos.fecha)) {
    return {
      status: 409,
      mensaje: "La fecha de la función no puede estar en el pasado"
    };
  }

  // Regla 4: la sala es única, no puede haber dos funciones simultáneas.
  if (
    funcionesService.funcionTieneConflicto(
      datos.fecha,
      datos.hora,
      funcionIdExcluir
    )
  ) {
    return {
      status: 409,
      mensaje: "Ya existe una función programada en esa fecha y hora"
    };
  }

  return validarTarifas(datos.tarifas);
};

// ========================================
// GET todas
// ========================================
const obtenerFunciones = (req, res) => {
  res.status(200).json(funcionesService.obtenerFunciones());
};

// ========================================
// GET por evento
// ========================================
const obtenerFuncionesPorEvento = (req, res) => {
  const { eventoId } = req.params;

  if (!eventosService.obtenerEventoPorId(eventoId)) {
    return res.status(404).json({ mensaje: "Evento no encontrado" });
  }

  res.status(200).json(funcionesService.obtenerFuncionesPorEvento(eventoId));
};

// ========================================
// GET por id
// ========================================
const obtenerFuncionPorId = (req, res) => {
  const funcion = funcionesService.obtenerFuncionPorId(req.params.id);

  if (!funcion) {
    return res.status(404).json({ mensaje: "Función no encontrada" });
  }

  res.status(200).json(funcion);
};

// ========================================
// GET tarifas
// ========================================
const obtenerTarifasDeFuncion = (req, res) => {
  const tarifas = funcionesService.obtenerTarifasDeFuncion(req.params.id);

  if (!tarifas) {
    return res.status(404).json({ mensaje: "Función no encontrada" });
  }

  res.status(200).json(tarifas);
};

// ========================================
// POST
// La función siempre nace programada
// ========================================
const crearFuncion = (req, res) => {
  const datos = leerDatos(req);

  const problema = validarReglasFuncion(datos);
  if (problema) {
    return res.status(problema.status).json({ mensaje: problema.mensaje });
  }

  const funcion = funcionesService.crearFuncion(datos);

  res.status(201).json({ mensaje: "Función creada correctamente", funcion });
};

// ========================================
// PUT
// Una función en curso, finalizada o cancelada no se modifica
// ========================================
const actualizarFuncion = (req, res) => {
  const { id } = req.params;
  const datos = leerDatos(req);

  const actual = funcionesService.obtenerFuncionPorId(id);

  if (!actual) {
    return res.status(404).json({ mensaje: "Función no encontrada" });
  }

  if (!funcionesService.esEstadoModificable(actual.estado)) {
    return res.status(409).json({
      mensaje: `No se puede modificar una función en estado ${actual.estado}`
    });
  }

  const problema = validarReglasFuncion(datos, id);
  if (problema) {
    return res.status(problema.status).json({ mensaje: problema.mensaje });
  }

  const funcion = funcionesService.actualizarFuncion(id, datos);

  res
    .status(200)
    .json({ mensaje: "Función actualizada correctamente", funcion });
};

// ========================================
// PATCH
// Las reglas se comprueban sobre cómo queda la función después del cambio
// ========================================
const actualizarFuncionParcial = (req, res) => {
  const { id } = req.params;
  const datos = leerDatos(req);

  if (Object.keys(datos).length === 0) {
    return res
      .status(400)
      .json({ mensaje: "Debe enviar al menos un campo para actualizar" });
  }

  const actual = funcionesService.obtenerFuncionPorId(id);

  if (!actual) {
    return res.status(404).json({ mensaje: "Función no encontrada" });
  }

  if (!funcionesService.esEstadoModificable(actual.estado)) {
    return res.status(409).json({
      mensaje: `No se puede modificar una función en estado ${actual.estado}`
    });
  }

  const resultante = {
    eventoId: datos.eventoId ?? actual.eventoId,
    fecha: datos.fecha ?? actual.fecha,
    hora: datos.hora ?? actual.hora,
    tarifas: datos.tarifas ?? actual.tarifas,
    descuentosHabilitados:
      datos.descuentosHabilitados ?? actual.descuentosHabilitados
  };

  const problema = validarReglasFuncion(resultante, id);
  if (problema) {
    return res.status(problema.status).json({ mensaje: problema.mensaje });
  }

  const funcion = funcionesService.actualizarFuncionParcial(id, datos);

  res
    .status(200)
    .json({ mensaje: "Función actualizada correctamente", funcion });
};

// ========================================
// PATCH estado
// Pasar a en_venta exige un cuadro de tarifas completo y coherente
// ========================================
const cambiarEstadoFuncion = (req, res) => {
  const { id } = req.params;
  const { estado } = leerDatos(req);

  const actual = funcionesService.obtenerFuncionPorId(id);

  if (!actual) {
    return res.status(404).json({ mensaje: "Función no encontrada" });
  }

  if (!funcionesService.esTransicionPermitida(actual.estado, estado)) {
    return res.status(409).json({
      mensaje: `No se permite cambiar una función de ${actual.estado} a ${estado}`
    });
  }

  if (estado === "en_venta") {
    const problema = validarTarifas(actual.tarifas);
    if (problema) {
      return res.status(409).json({
        mensaje: `No se puede poner la función en venta: ${problema.mensaje}`
      });
    }
  }

  const funcion = funcionesService.cambiarEstadoFuncion(id, estado);

  res.status(200).json({
    mensaje: `Función actualizada al estado ${estado}`,
    funcion
  });
};

// ========================================
// DELETE
// Una función con boletas asociadas no se elimina, aunque estén canceladas
// ========================================
const eliminarFuncion = (req, res) => {
  const { id } = req.params;

  if (!funcionesService.obtenerFuncionPorId(id)) {
    return res.status(404).json({ mensaje: "Función no encontrada" });
  }

  if (boletasService.funcionTieneBoletas(id)) {
    return res.status(409).json({
      mensaje: "No se puede eliminar la función porque tiene boletas asociadas"
    });
  }

  funcionesService.eliminarFuncion(id);

  res.status(200).json({ mensaje: "Función eliminada correctamente" });
};

// ========================================
// Exportaciones
// ========================================
module.exports = {
  obtenerFunciones,
  obtenerFuncionesPorEvento,
  obtenerFuncionPorId,
  obtenerTarifasDeFuncion,
  crearFuncion,
  actualizarFuncion,
  actualizarFuncionParcial,
  cambiarEstadoFuncion,
  eliminarFuncion
};
