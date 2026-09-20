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

// Límites de venta, reventa tras cancelación y regresión de la fase 4.
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

const principal = async () => {
  // ========================================
  // Límite de boletas por asistente
  // ========================================
  grupo("Límite por asistente");

  // El asistente 2 no tiene ninguna boleta en la función 1. El límite es 6.
  for (let numero = 1; numero <= 6; numero += 1) {
    await comprobar(
      `Boleta ${numero} de 6 del mismo asistente`,
      "POST",
      "/api/boletas",
      { asistenteId: 2, funcionId: 1, localidadId: 1, fila: 4, numero },
      201
    );
  }

  await comprobar(
    "La séptima boleta supera el límite",
    "POST",
    "/api/boletas",
    { asistenteId: 2, funcionId: 1, localidadId: 1, fila: 4, numero: 7 },
    409,
    (d) =>
      d.mensaje === "Se superó el límite de 6 boletas por asistente en una función"
        ? null
        : `mensaje: ${d.mensaje}`
  );
  await comprobar(
    "Otro asistente sí puede comprar en esa función",
    "POST",
    "/api/boletas",
    { asistenteId: 4, funcionId: 1, localidadId: 1, fila: 4, numero: 7 },
    201
  );

  // ========================================
  // Reventa de una butaca cancelada
  // ========================================
  grupo("Reventa tras cancelación");

  const paraCancelar = await comprobar(
    "Vende una butaca",
    "POST",
    "/api/boletas",
    { asistenteId: 5, funcionId: 1, localidadId: 1, fila: 5, numero: 1 },
    201
  );
  await comprobar(
    "La butaca queda ocupada",
    "POST",
    "/api/boletas",
    { asistenteId: 4, funcionId: 1, localidadId: 1, fila: 5, numero: 1 },
    409,
    (d) =>
      d.mensaje === "La butaca ya está ocupada en esta función"
        ? null
        : `mensaje: ${d.mensaje}`
  );
  await comprobar(
    "Cancela la boleta",
    "PATCH",
    `/api/boletas/${paraCancelar.boleta.id}/estado`,
    { estado: "cancelada" },
    200
  );
  await comprobar(
    "La butaca cancelada se puede revender",
    "POST",
    "/api/boletas",
    { asistenteId: 4, funcionId: 1, localidadId: 1, fila: 5, numero: 1 },
    201
  );

  // ========================================
  // Aforo de la localidad
  // ========================================
  grupo("Aforo");

  // El aforo solo es alcanzable si la capacidad se reduce después de vender:
  // mientras capacidad = filas * butacasPorFila, la unicidad de butaca lo
  // impide antes. Se monta ese escenario a propósito.
  const localidad = await comprobar(
    "Crea una localidad de 4 butacas",
    "POST",
    "/api/localidades",
    { codigo: "TER-TUL", nombre: "Tertulia", orden: 9, filas: 2, butacasPorFila: 2 },
    201,
    (d) => (d.localidad.capacidad === 4 ? null : "capacidad mal calculada")
  );
  const localidadId = localidad.localidad.id;

  const funcion = await comprobar(
    "Crea una función con tarifa para las 4 localidades",
    "POST",
    "/api/funciones",
    {
      eventoId: 1,
      fecha: "2026-12-20",
      hora: "19:00",
      tarifas: [
        { localidadId: 1, precio: 100000 },
        { localidadId: 2, precio: 80000 },
        { localidadId: 3, precio: 60000 },
        { localidadId: localidadId, precio: 40000 }
      ]
    },
    201
  );
  const funcionId = funcion.funcion.id;

  await comprobar(
    "La pone en venta",
    "PATCH",
    `/api/funciones/${funcionId}/estado`,
    { estado: "en_venta" },
    200
  );
  await comprobar(
    "Vende la butaca 1",
    "POST",
    "/api/boletas",
    { asistenteId: 1, funcionId, localidadId, fila: 1, numero: 1 },
    201,
    (d) => (d.boleta.precio === 40000 ? null : `precio ${d.boleta.precio}, esperado 40000`)
  );
  await comprobar(
    "Vende la butaca 2",
    "POST",
    "/api/boletas",
    { asistenteId: 2, funcionId, localidadId, fila: 1, numero: 2 },
    201
  );
  await comprobar(
    "Reduce la capacidad de la localidad a 2",
    "PATCH",
    `/api/localidades/${localidadId}`,
    { butacasPorFila: 1 },
    200,
    (d) => (d.localidad.capacidad === 2 ? null : "no recalculó la capacidad")
  );
  await comprobar(
    "Butaca libre pero aforo alcanzado",
    "POST",
    "/api/boletas",
    { asistenteId: 3, funcionId, localidadId, fila: 2, numero: 1 },
    409,
    (d) =>
      d.mensaje === "Se alcanzó el aforo de la localidad para esta función"
        ? null
        : `mensaje: ${d.mensaje}`
  );

  // ========================================
  // Regresión de la fase 4
  // ========================================
  grupo("Regresión: borrado de funciones");

  await comprobar(
    "No borra una función con boletas no canceladas",
    "DELETE",
    "/api/funciones/1",
    undefined,
    409,
    (d) =>
      d.mensaje === "No se puede eliminar la función porque tiene boletas asociadas"
        ? null
        : `mensaje: ${d.mensaje}`
  );
  await comprobar(
    "Sí borra una función sin boletas",
    "DELETE",
    "/api/funciones/3",
    undefined,
    200,
    (d) =>
      d.mensaje === "Función eliminada correctamente" ? null : `mensaje: ${d.mensaje}`
  );
  await comprobar(
    "Tampoco borra una función cuya única boleta está cancelada",
    "DELETE",
    "/api/funciones/7",
    undefined,
    409
  );

  // ========================================
  // Informe
  // ========================================
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

principal().catch((error) => {
  console.error("Error ejecutando las pruebas:", error);
  process.exit(1);
});
