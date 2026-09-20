// ========================================
// Configuración
// Carga el .env del proyecto y añade la X-API-Key a cada petición
// ========================================
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const CLAVE_API = process.env.API_KEY;
const fetchSinClave = globalThis.fetch;
globalThis.fetch = (url, opciones = {}) =>
  fetchSinClave(url, {
    ...opciones,
    headers: { ...(opciones.headers || {}), "X-API-Key": CLAVE_API }
  });

// Batería de pruebas del recurso boletas contra el servidor en marcha.
const BASE = "http://localhost:3000";

const resultados = [];
let grupoActual = "";
const grupo = (nombre) => {
  grupoActual = nombre;
};

const pedir = async (metodo, ruta, cuerpo) => {
  const opciones = { method: metodo, headers: {} };
  if (cuerpo !== undefined) {
    opciones.headers["Content-Type"] = "application/json";
    opciones.body = JSON.stringify(cuerpo);
  }
  const respuesta = await fetch(BASE + ruta, opciones);
  let datos = null;
  try {
    datos = await respuesta.json();
  } catch {
    datos = null;
  }
  return { estado: respuesta.status, datos };
};

const comprobar = async (descripcion, metodo, ruta, cuerpo, esperado, extra) => {
  const { estado, datos } = await pedir(metodo, ruta, cuerpo);
  let detalle = "";
  let ok = estado === esperado;

  if (!ok) {
    detalle = `esperaba ${esperado}, recibió ${estado}${datos && datos.mensaje ? ` (${datos.mensaje})` : ""}`;
  } else if (typeof extra === "function") {
    const problema = extra(datos);
    if (problema) {
      ok = false;
      detalle = problema;
    }
  }

  resultados.push({ grupo: grupoActual, descripcion, metodo, ruta, recibido: estado, ok, detalle });
  return datos;
};

const informe = () => {
  const ancho = Math.max(...resultados.map((r) => r.descripcion.length), 11);
  let impreso = "";
  for (const r of resultados) {
    if (r.grupo !== impreso) {
      impreso = r.grupo;
      console.log("");
      console.log("== " + impreso + " " + "=".repeat(Math.max(3, 56 - impreso.length)));
    }
    console.log(
      `  ${r.ok ? "OK  " : "FALLA"} ${(r.metodo + " " + r.ruta).padEnd(30)} ${String(r.recibido).padEnd(4)} ${r.descripcion.padEnd(ancho)}${r.detalle ? "  <-- " + r.detalle : ""}`
    );
  }
  const fallos = resultados.filter((r) => !r.ok);
  console.log("");
  console.log(
    `Total: ${resultados.length} pruebas | Correctas: ${resultados.length - fallos.length} | Fallidas: ${fallos.length}`
  );
  process.exit(fallos.length > 0 ? 1 : 0);
};

const principal = async () => {
  // ========================================
  // Consultas
  // ========================================
  grupo("Consultas");

  await comprobar("Lista todas", "GET", "/api/boletas", undefined, 200, (d) =>
    Array.isArray(d) && d.length === 7 ? null : "no devolvió las 7 boletas"
  );
  await comprobar("Obtiene por id", "GET", "/api/boletas/1", undefined, 200, (d) =>
    d.codigo === "BOL-2026-0001" ? null : "boleta inesperada"
  );
  await comprobar("Id inexistente", "GET", "/api/boletas/999", undefined, 404);
  await comprobar(
    "Boletas de un asistente",
    "GET",
    "/api/boletas/asistente/1",
    undefined,
    200,
    (d) =>
      Array.isArray(d) && d.length === 2 && d.every((b) => b.asistenteId === 1)
        ? null
        : "no devolvió las 2 boletas del asistente 1"
  );
  await comprobar(
    "Asistente inexistente",
    "GET",
    "/api/boletas/asistente/999",
    undefined,
    404,
    (d) => (d.mensaje === "Asistente no encontrado" ? null : "mensaje inesperado")
  );
  await comprobar(
    "Boletas de una función",
    "GET",
    "/api/boletas/funcion/1",
    undefined,
    200,
    (d) => (Array.isArray(d) && d.length === 3 ? null : "no devolvió las 3 boletas")
  );
  await comprobar(
    "Función inexistente",
    "GET",
    "/api/boletas/funcion/999",
    undefined,
    404,
    (d) => (d.mensaje === "Función no encontrada" ? null : "mensaje inesperado")
  );

  // ========================================
  // Campos calculados por el servidor
  // ========================================
  grupo("Campos calculados");

  const creada = await comprobar(
    "Crea sin descuento: precio = tarifa",
    "POST",
    "/api/boletas",
    { asistenteId: 2, funcionId: 1, localidadId: 1, fila: 3, numero: 1 },
    201,
    (d) => {
      const b = d.boleta;
      return b.precio === 75000 &&
        b.tipoDescuento === "ninguno" &&
        b.estado === "reservada" &&
        b.codigo === "BOL-2026-0008"
        ? null
        : `boleta inesperada: ${JSON.stringify(b)}`;
    }
  );
  const idReservada = creada.boleta.id;

  const intruso = await comprobar(
    "El cliente NO puede fijar precio, codigo ni estado",
    "POST",
    "/api/boletas",
    {
      asistenteId: 2,
      funcionId: 1,
      localidadId: 2,
      fila: 5,
      numero: 5,
      precio: 1,
      codigo: "BOL-HACKEADO",
      estado: "usada",
      id: 9999
    },
    201,
    (d) => {
      const b = d.boleta;
      return b.precio === 55000 &&
        b.codigo === "BOL-2026-0009" &&
        b.estado === "reservada" &&
        b.id !== 9999
        ? null
        : `el cliente logró fijar algún campo: ${JSON.stringify(b)}`;
    }
  );
  const idParaModificar = intruso.boleta.id;

  await comprobar(
    "Descuento estudiante: 20% sobre 75000",
    "POST",
    "/api/boletas",
    {
      asistenteId: 3,
      funcionId: 1,
      localidadId: 1,
      fila: 1,
      numero: 1,
      tipoDescuento: "estudiante"
    },
    201,
    (d) => (d.boleta.precio === 60000 ? null : `precio ${d.boleta.precio}, esperado 60000`)
  );
  await comprobar(
    "Descuento adultoMayor: 30% sobre 38000",
    "POST",
    "/api/boletas",
    {
      asistenteId: 4,
      funcionId: 1,
      localidadId: 3,
      fila: 2,
      numero: 10,
      tipoDescuento: "adultoMayor"
    },
    201,
    (d) => (d.boleta.precio === 26600 ? null : `precio ${d.boleta.precio}, esperado 26600`)
  );
  await comprobar(
    "Descuento infantil: 50% sobre 18000 (función 4)",
    "POST",
    "/api/boletas",
    {
      asistenteId: 5,
      funcionId: 4,
      localidadId: 2,
      fila: 7,
      numero: 7,
      tipoDescuento: "infantil"
    },
    201,
    (d) => (d.boleta.precio === 9000 ? null : `precio ${d.boleta.precio}, esperado 9000`)
  );

  // ========================================
  // Reglas de relación
  // ========================================
  grupo("Reglas de relación");

  await comprobar(
    "Asistente inexistente",
    "POST",
    "/api/boletas",
    { asistenteId: 999, funcionId: 1, localidadId: 1, fila: 4, numero: 1 },
    400,
    (d) => (d.mensaje === "El asistente indicado no existe" ? null : `mensaje: ${d.mensaje}`)
  );
  await comprobar(
    "Función inexistente",
    "POST",
    "/api/boletas",
    { asistenteId: 1, funcionId: 999, localidadId: 1, fila: 4, numero: 1 },
    400,
    (d) => (d.mensaje === "La función indicada no existe" ? null : `mensaje: ${d.mensaje}`)
  );
  await comprobar(
    "Función programada, no en venta",
    "POST",
    "/api/boletas",
    { asistenteId: 1, funcionId: 3, localidadId: 1, fila: 4, numero: 1 },
    409,
    (d) =>
      d.mensaje.includes("programada") ? null : `el mensaje no dice el estado: ${d.mensaje}`
  );
  await comprobar(
    "Función finalizada, no en venta",
    "POST",
    "/api/boletas",
    { asistenteId: 1, funcionId: 6, localidadId: 1, fila: 4, numero: 1 },
    409,
    (d) => (d.mensaje.includes("finalizada") ? null : `mensaje: ${d.mensaje}`)
  );
  await comprobar(
    "Localidad inexistente",
    "POST",
    "/api/boletas",
    { asistenteId: 1, funcionId: 1, localidadId: 99, fila: 1, numero: 1 },
    400
  );
  await comprobar(
    "Fila fuera del aforo de la localidad",
    "POST",
    "/api/boletas",
    { asistenteId: 1, funcionId: 1, localidadId: 1, fila: 6, numero: 1 },
    409,
    (d) =>
      d.mensaje === "La butaca no existe en esta localidad" ? null : `mensaje: ${d.mensaje}`
  );
  await comprobar(
    "Número fuera del aforo de la localidad",
    "POST",
    "/api/boletas",
    { asistenteId: 1, funcionId: 1, localidadId: 1, fila: 1, numero: 21 },
    409
  );
  await comprobar(
    "Descuento no habilitado en esa función",
    "POST",
    "/api/boletas",
    {
      asistenteId: 1,
      funcionId: 1,
      localidadId: 1,
      fila: 4,
      numero: 2,
      tipoDescuento: "infantil"
    },
    409,
    (d) =>
      d.mensaje === "El descuento infantil no está habilitado para esta función"
        ? null
        : `mensaje: ${d.mensaje}`
  );

  // Localidad nueva: activa pero sin tarifa en la función 1.
  await comprobar(
    "Crea una localidad sin tarifa en la función 1",
    "POST",
    "/api/localidades",
    { codigo: "TER-TUL", nombre: "Tertulia", orden: 9, filas: 3, butacasPorFila: 5 },
    201
  );
  await comprobar(
    "Localidad sin tarifa en esa función",
    "POST",
    "/api/boletas",
    { asistenteId: 1, funcionId: 1, localidadId: 4, fila: 1, numero: 1 },
    409,
    (d) =>
      d.mensaje === "La localidad no tiene tarifa asignada en esta función"
        ? null
        : `mensaje: ${d.mensaje}`
  );
  await comprobar(
    "Desactiva el Balcón",
    "PATCH",
    "/api/localidades/3/estado",
    { activa: false },
    200
  );
  await comprobar(
    "Localidad inactiva",
    "POST",
    "/api/boletas",
    { asistenteId: 1, funcionId: 1, localidadId: 3, fila: 3, numero: 3 },
    409,
    (d) => (d.mensaje.includes("no está activa") ? null : `mensaje: ${d.mensaje}`)
  );
  await comprobar(
    "Reactiva el Balcón",
    "PATCH",
    "/api/localidades/3/estado",
    { activa: true },
    200
  );

  // ========================================
  // Butaca ocupada
  // ========================================
  grupo("Butaca ocupada");

  await comprobar(
    "Butaca ya vendida en esa función",
    "POST",
    "/api/boletas",
    { asistenteId: 1, funcionId: 1, localidadId: 1, fila: 2, numero: 7 },
    409,
    (d) =>
      d.mensaje === "La butaca ya está ocupada en esta función"
        ? null
        : `mensaje: ${d.mensaje}`
  );
  await comprobar(
    "La misma butaca en otra función sí se puede",
    "POST",
    "/api/boletas",
    { asistenteId: 1, funcionId: 4, localidadId: 1, fila: 2, numero: 7 },
    201
  );
  await comprobar(
    "Una butaca liberada por cancelación se puede revender",
    "POST",
    "/api/boletas",
    { asistenteId: 3, funcionId: 4, localidadId: 1, fila: 1, numero: 15 },
    409,
    (d) =>
      d.mensaje === "La butaca ya está ocupada en esta función"
        ? null
        : `mensaje: ${d.mensaje}`
  );

  // ========================================
  // Validación de entrada
  // ========================================
  grupo("Validación de entrada");

  await comprobar(
    "Tipo de descuento fuera de la lista blanca",
    "POST",
    "/api/boletas",
    {
      asistenteId: 1,
      funcionId: 1,
      localidadId: 1,
      fila: 4,
      numero: 3,
      tipoDescuento: "jubilado"
    },
    400
  );
  await comprobar(
    "Fila en cero",
    "POST",
    "/api/boletas",
    { asistenteId: 1, funcionId: 1, localidadId: 1, fila: 0, numero: 3 },
    400
  );
  await comprobar(
    "Falta el funcionId",
    "POST",
    "/api/boletas",
    { asistenteId: 1, localidadId: 1, fila: 4, numero: 3 },
    400
  );

  // ========================================
  // Actualización
  // ========================================
  grupo("Actualización");

  await comprobar(
    "PUT recalcula el precio al cambiar de localidad",
    "PUT",
    `/api/boletas/${idParaModificar}`,
    { asistenteId: 2, funcionId: 1, localidadId: 3, fila: 3, numero: 3 },
    200,
    (d) => {
      const b = d.boleta;
      return b.precio === 38000 &&
        b.codigo === "BOL-2026-0009" &&
        b.estado === "reservada"
        ? null
        : `no recalculó o no conservó codigo/estado: ${JSON.stringify(b)}`;
    }
  );
  await comprobar(
    "PUT con descuento recalcula sobre la nueva tarifa",
    "PUT",
    `/api/boletas/${idParaModificar}`,
    {
      asistenteId: 2,
      funcionId: 1,
      localidadId: 3,
      fila: 3,
      numero: 3,
      tipoDescuento: "estudiante"
    },
    200,
    (d) => (d.boleta.precio === 30400 ? null : `precio ${d.boleta.precio}, esperado 30400`)
  );
  await comprobar(
    "PUT ignora un precio enviado por el cliente",
    "PUT",
    `/api/boletas/${idParaModificar}`,
    {
      asistenteId: 2,
      funcionId: 1,
      localidadId: 3,
      fila: 3,
      numero: 3,
      precio: 1
    },
    200,
    (d) => (d.boleta.precio === 38000 ? null : `precio ${d.boleta.precio}, esperado 38000`)
  );
  await comprobar(
    "PATCH solo del descuento recalcula el precio",
    "PATCH",
    `/api/boletas/${idParaModificar}`,
    { tipoDescuento: "adultoMayor" },
    200,
    (d) =>
      d.boleta.precio === 26600 && d.boleta.localidadId === 3
        ? null
        : `precio ${d.boleta.precio}, esperado 26600`
  );
  await comprobar(
    "PATCH con cuerpo vacío",
    "PATCH",
    `/api/boletas/${idParaModificar}`,
    {},
    400,
    (d) =>
      d.mensaje === "Debe enviar al menos un campo para actualizar"
        ? null
        : "mensaje inesperado"
  );
  await comprobar(
    "PATCH hacia una butaca ocupada",
    "PATCH",
    `/api/boletas/${idParaModificar}`,
    { fila: 1, numero: 5 },
    409,
    (d) =>
      d.mensaje === "La butaca ya está ocupada en esta función"
        ? null
        : `mensaje: ${d.mensaje}`
  );
  await comprobar(
    "PUT sobre su propia butaca no choca consigo misma",
    "PUT",
    `/api/boletas/${idParaModificar}`,
    { asistenteId: 2, funcionId: 1, localidadId: 3, fila: 3, numero: 3 },
    200
  );
  await comprobar(
    "No se modifica una boleta pagada",
    "PUT",
    "/api/boletas/1",
    { asistenteId: 1, funcionId: 1, localidadId: 1, fila: 4, numero: 4 },
    409,
    (d) =>
      d.mensaje === "No se puede modificar una boleta en estado pagada"
        ? null
        : `mensaje: ${d.mensaje}`
  );
  await comprobar(
    "No se modifica una boleta cancelada",
    "PATCH",
    "/api/boletas/7",
    { fila: 2 },
    409
  );

  // ========================================
  // Máquina de estados
  // ========================================
  grupo("Máquina de estados");

  await comprobar(
    "reservada -> usada (no permitida)",
    "PATCH",
    `/api/boletas/${idReservada}/estado`,
    { estado: "usada" },
    409,
    (d) =>
      d.mensaje === "No se permite cambiar una boleta de reservada a usada"
        ? null
        : `mensaje: ${d.mensaje}`
  );
  await comprobar(
    "reservada -> pagada",
    "PATCH",
    `/api/boletas/${idReservada}/estado`,
    { estado: "pagada" },
    200,
    (d) => (d.boleta.estado === "pagada" ? null : "no cambió el estado")
  );
  await comprobar(
    "pagada -> reservada (no permitida)",
    "PATCH",
    `/api/boletas/${idReservada}/estado`,
    { estado: "reservada" },
    409
  );
  await comprobar(
    "pagada -> usada con la función solo en venta",
    "PATCH",
    `/api/boletas/${idReservada}/estado`,
    { estado: "usada" },
    409,
    (d) =>
      d.mensaje.includes("en_curso") ? null : `mensaje inesperado: ${d.mensaje}`
  );
  await comprobar(
    "La función 1 entra en curso",
    "PATCH",
    "/api/funciones/1/estado",
    { estado: "en_curso" },
    200
  );
  await comprobar(
    "pagada -> usada con la función en curso",
    "PATCH",
    `/api/boletas/${idReservada}/estado`,
    { estado: "usada" },
    200,
    (d) => (d.boleta.estado === "usada" ? null : "no cambió el estado")
  );
  await comprobar(
    "Una boleta usada no se vuelve a marcar como usada",
    "PATCH",
    `/api/boletas/${idReservada}/estado`,
    { estado: "usada" },
    409,
    (d) =>
      d.mensaje === "No se permite cambiar una boleta de usada a usada"
        ? null
        : `mensaje: ${d.mensaje}`
  );
  await comprobar(
    "usada -> cancelada (terminal)",
    "PATCH",
    `/api/boletas/${idReservada}/estado`,
    { estado: "cancelada" },
    409
  );
  await comprobar(
    "Estado fuera de la lista blanca",
    "PATCH",
    "/api/boletas/2/estado",
    { estado: "regalada" },
    400
  );
  await comprobar(
    "Estado de boleta inexistente",
    "PATCH",
    "/api/boletas/999/estado",
    { estado: "cancelada" },
    404
  );

  // ========================================
  // Eliminación
  // ========================================
  grupo("Eliminación");

  await comprobar(
    "No elimina una boleta usada",
    "DELETE",
    `/api/boletas/${idReservada}`,
    undefined,
    409,
    (d) =>
      d.mensaje === "No se puede eliminar una boleta en estado usada"
        ? null
        : `mensaje: ${d.mensaje}`
  );
  await comprobar("No elimina una boleta pagada", "DELETE", "/api/boletas/1", undefined, 409);
  await comprobar("Elimina una boleta cancelada", "DELETE", "/api/boletas/7", undefined, 200);
  await comprobar(
    "Elimina una boleta reservada",
    "DELETE",
    `/api/boletas/${idParaModificar}`,
    undefined,
    200
  );
  await comprobar("Elimina dos veces", "DELETE", `/api/boletas/${idParaModificar}`, undefined, 404);

  informe();
};

principal().catch((error) => {
  console.error("Error ejecutando las pruebas:", error);
  process.exit(1);
});
