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

// Batería de pruebas del recurso funciones contra el servidor en marcha.
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

  resultados.push({
    grupo: grupoActual,
    descripcion,
    metodo,
    ruta,
    recibido: estado,
    ok,
    detalle
  });
  return datos;
};

// Tarifas coherentes: platea preferencial (orden 1) > platea general (2) > balcón (3).
const tarifasValidas = [
  { localidadId: 1, precio: 80000 },
  { localidadId: 2, precio: 60000 },
  { localidadId: 3, precio: 40000 }
];

const principal = async () => {
  // ========================================
  // Consultas
  // ========================================
  grupo("Consultas");

  await comprobar("Lista todas", "GET", "/api/funciones", undefined, 200, (d) =>
    Array.isArray(d) && d.length === 7 ? null : "no devolvió las 7 funciones"
  );
  await comprobar("Obtiene por id", "GET", "/api/funciones/1", undefined, 200, (d) =>
    d.id === 1 && d.estado === "en_venta" ? null : "función inesperada"
  );
  await comprobar("Id inexistente", "GET", "/api/funciones/999", undefined, 404);
  await comprobar(
    "Funciones de un evento",
    "GET",
    "/api/funciones/evento/1",
    undefined,
    200,
    (d) =>
      Array.isArray(d) && d.length === 3 && d.every((f) => f.eventoId === 1)
        ? null
        : "no devolvió las 3 funciones del evento 1"
  );
  await comprobar(
    "Funciones de un evento inexistente",
    "GET",
    "/api/funciones/evento/999",
    undefined,
    404,
    (d) => (d.mensaje === "Evento no encontrado" ? null : "mensaje inesperado")
  );
  await comprobar(
    "Tarifas ordenadas por cercanía",
    "GET",
    "/api/funciones/1/tarifas",
    undefined,
    200,
    (d) => {
      if (!Array.isArray(d.tarifas) || d.tarifas.length !== 3) {
        return "no devolvió las 3 tarifas";
      }
      const ordenes = d.tarifas.map((t) => t.orden);
      const ordenado = ordenes.every((o, i) => i === 0 || ordenes[i - 1] < o);
      const enriquecido = d.tarifas[0].codigo === "PLA-PREF";
      const descuentos = Array.isArray(d.descuentosHabilitados);
      return ordenado && enriquecido && descuentos
        ? null
        : "no vienen ordenadas, enriquecidas o sin descuentos";
    }
  );
  await comprobar(
    "Tarifas de función inexistente",
    "GET",
    "/api/funciones/999/tarifas",
    undefined,
    404
  );

  // ========================================
  // Creación
  // ========================================
  grupo("Creación");

  const creada = await comprobar(
    "Función válida nace programada",
    "POST",
    "/api/funciones",
    {
      eventoId: 1,
      fecha: "2026-11-20",
      hora: "19:00",
      tarifas: tarifasValidas,
      descuentosHabilitados: ["estudiante"]
    },
    201,
    (d) =>
      d.funcion.estado === "programada" && d.funcion.tarifas.length === 3
        ? null
        : "no nació programada o perdió tarifas"
  );
  const funcionId = creada.funcion.id;

  await comprobar(
    "Mass Assignment: ignora el estado enviado por el cliente",
    "POST",
    "/api/funciones",
    {
      eventoId: 2,
      fecha: "2026-11-21",
      hora: "19:00",
      tarifas: tarifasValidas,
      estado: "en_venta"
    },
    201,
    (d) => (d.funcion.estado === "programada" ? null : "el cliente fijó el estado")
  );
  await comprobar(
    "Mass Assignment: descarta campos extra dentro de las tarifas",
    "POST",
    "/api/funciones",
    {
      eventoId: 2,
      fecha: "2026-11-22",
      hora: "19:00",
      tarifas: [
        { localidadId: 1, precio: 80000, comision: 5000 },
        { localidadId: 2, precio: 60000 },
        { localidadId: 3, precio: 40000 }
      ]
    },
    201,
    (d) =>
      d.funcion.tarifas[0].comision === undefined
        ? null
        : "guardó un campo extra dentro de la tarifa"
  );

  await comprobar(
    "Choque de fecha y hora (sala única)",
    "POST",
    "/api/funciones",
    {
      eventoId: 1,
      fecha: "2027-02-18",
      hora: "19:00",
      tarifas: tarifasValidas
    },
    409,
    (d) =>
      d.mensaje === "Ya existe una función programada en esa fecha y hora"
        ? null
        : `mensaje inesperado: ${d.mensaje}`
  );
  await comprobar(
    "Fecha en el pasado",
    "POST",
    "/api/funciones",
    {
      eventoId: 1,
      fecha: "2026-01-10",
      hora: "19:00",
      tarifas: tarifasValidas
    },
    409,
    (d) => (d.mensaje.includes("pasado") ? null : `mensaje inesperado: ${d.mensaje}`)
  );
  await comprobar(
    "Evento inexistente",
    "POST",
    "/api/funciones",
    {
      eventoId: 999,
      fecha: "2026-11-25",
      hora: "19:00",
      tarifas: tarifasValidas
    },
    400,
    (d) =>
      d.mensaje === "El evento indicado no existe"
        ? null
        : `mensaje inesperado: ${d.mensaje}`
  );
  await comprobar(
    "Evento inactivo",
    "POST",
    "/api/funciones",
    {
      eventoId: 5,
      fecha: "2026-11-25",
      hora: "19:00",
      tarifas: tarifasValidas
    },
    409,
    (d) =>
      d.mensaje === "No se pueden programar funciones de un evento inactivo"
        ? null
        : `mensaje inesperado: ${d.mensaje}`
  );
  await comprobar(
    "Falta la tarifa de una localidad activa",
    "POST",
    "/api/funciones",
    {
      eventoId: 1,
      fecha: "2026-11-25",
      hora: "19:00",
      tarifas: [
        { localidadId: 1, precio: 80000 },
        { localidadId: 2, precio: 60000 }
      ]
    },
    409,
    (d) =>
      d.mensaje === "Faltan tarifas para las localidades: Balcón"
        ? null
        : `mensaje inesperado: ${d.mensaje}`
  );
  await comprobar(
    "Balcón más caro que Platea Preferencial",
    "POST",
    "/api/funciones",
    {
      eventoId: 1,
      fecha: "2026-11-25",
      hora: "19:00",
      tarifas: [
        { localidadId: 1, precio: 50000 },
        { localidadId: 2, precio: 60000 },
        { localidadId: 3, precio: 90000 }
      ]
    },
    409,
    (d) =>
      d.mensaje ===
      "El precio de Platea Preferencial debe ser mayor que el de Platea General por estar más cerca del escenario"
        ? null
        : `mensaje inesperado: ${d.mensaje}`
  );
  await comprobar(
    "Precios iguales entre localidades",
    "POST",
    "/api/funciones",
    {
      eventoId: 1,
      fecha: "2026-11-25",
      hora: "19:00",
      tarifas: [
        { localidadId: 1, precio: 60000 },
        { localidadId: 2, precio: 60000 },
        { localidadId: 3, precio: 40000 }
      ]
    },
    409,
    (d) =>
      d.mensaje.includes("debe ser mayor")
        ? null
        : `mensaje inesperado: ${d.mensaje}`
  );
  await comprobar(
    "Dos tarifas para la misma localidad",
    "POST",
    "/api/funciones",
    {
      eventoId: 1,
      fecha: "2026-11-25",
      hora: "19:00",
      tarifas: [
        { localidadId: 1, precio: 80000 },
        { localidadId: 1, precio: 70000 },
        { localidadId: 2, precio: 60000 },
        { localidadId: 3, precio: 40000 }
      ]
    },
    409,
    (d) =>
      d.mensaje === "No puede haber dos tarifas para la misma localidad"
        ? null
        : `mensaje inesperado: ${d.mensaje}`
  );
  await comprobar(
    "Localidad inexistente en una tarifa",
    "POST",
    "/api/funciones",
    {
      eventoId: 1,
      fecha: "2026-11-25",
      hora: "19:00",
      tarifas: [...tarifasValidas, { localidadId: 99, precio: 10000 }]
    },
    400,
    (d) =>
      d.mensaje === "La localidad con id 99 no existe"
        ? null
        : `mensaje inesperado: ${d.mensaje}`
  );

  // ========================================
  // Validación de entrada
  // ========================================
  grupo("Validación de entrada");

  await comprobar(
    "Hora fuera de rango",
    "POST",
    "/api/funciones",
    { eventoId: 1, fecha: "2026-11-25", hora: "25:00", tarifas: tarifasValidas },
    400
  );
  await comprobar(
    "Fecha inexistente (30 de febrero)",
    "POST",
    "/api/funciones",
    { eventoId: 1, fecha: "2026-02-30", hora: "19:00", tarifas: tarifasValidas },
    400
  );
  await comprobar(
    "Array de tarifas vacío",
    "POST",
    "/api/funciones",
    { eventoId: 1, fecha: "2026-11-25", hora: "19:00", tarifas: [] },
    400
  );
  await comprobar(
    "Precio no entero positivo",
    "POST",
    "/api/funciones",
    {
      eventoId: 1,
      fecha: "2026-11-25",
      hora: "19:00",
      tarifas: [
        { localidadId: 1, precio: 0 },
        { localidadId: 2, precio: 60000 },
        { localidadId: 3, precio: 40000 }
      ]
    },
    400
  );
  await comprobar(
    "Descuento fuera de la lista blanca",
    "POST",
    "/api/funciones",
    {
      eventoId: 1,
      fecha: "2026-11-25",
      hora: "19:00",
      tarifas: tarifasValidas,
      descuentosHabilitados: ["gratis"]
    },
    400
  );
  await comprobar(
    "Descuentos duplicados",
    "POST",
    "/api/funciones",
    {
      eventoId: 1,
      fecha: "2026-11-25",
      hora: "19:00",
      tarifas: tarifasValidas,
      descuentosHabilitados: ["estudiante", "estudiante"]
    },
    400
  );

  // ========================================
  // Máquina de estados
  // ========================================
  grupo("Máquina de estados");

  await comprobar(
    "programada -> finalizada (no permitida)",
    "PATCH",
    `/api/funciones/${funcionId}/estado`,
    { estado: "finalizada" },
    409,
    (d) =>
      d.mensaje === "No se permite cambiar una función de programada a finalizada"
        ? null
        : `mensaje inesperado: ${d.mensaje}`
  );
  await comprobar(
    "programada -> en_venta",
    "PATCH",
    `/api/funciones/${funcionId}/estado`,
    { estado: "en_venta" },
    200,
    (d) => (d.funcion.estado === "en_venta" ? null : "no cambió el estado")
  );
  await comprobar(
    "en_venta -> agotada",
    "PATCH",
    `/api/funciones/${funcionId}/estado`,
    { estado: "agotada" },
    200
  );
  await comprobar(
    "agotada -> programada (no permitida)",
    "PATCH",
    `/api/funciones/${funcionId}/estado`,
    { estado: "programada" },
    409
  );
  await comprobar(
    "agotada -> en_curso",
    "PATCH",
    `/api/funciones/${funcionId}/estado`,
    { estado: "en_curso" },
    200
  );
  await comprobar(
    "en_curso -> cancelada (no permitida)",
    "PATCH",
    `/api/funciones/${funcionId}/estado`,
    { estado: "cancelada" },
    409
  );
  await comprobar(
    "No se modifica una función en curso (PUT)",
    "PUT",
    `/api/funciones/${funcionId}`,
    {
      eventoId: 1,
      fecha: "2026-11-20",
      hora: "20:00",
      tarifas: tarifasValidas
    },
    409,
    (d) =>
      d.mensaje === "No se puede modificar una función en estado en_curso"
        ? null
        : `mensaje inesperado: ${d.mensaje}`
  );
  await comprobar(
    "No se modifica una función en curso (PATCH)",
    "PATCH",
    `/api/funciones/${funcionId}`,
    { hora: "20:00" },
    409
  );
  await comprobar(
    "en_curso -> finalizada",
    "PATCH",
    `/api/funciones/${funcionId}/estado`,
    { estado: "finalizada" },
    200
  );
  await comprobar(
    "finalizada es terminal",
    "PATCH",
    `/api/funciones/${funcionId}/estado`,
    { estado: "en_venta" },
    409
  );
  await comprobar(
    "Estado fuera de la lista blanca",
    "PATCH",
    "/api/funciones/2/estado",
    { estado: "inventado" },
    400
  );
  await comprobar(
    "Estado de función inexistente",
    "PATCH",
    "/api/funciones/999/estado",
    { estado: "cancelada" },
    404
  );

  // ========================================
  // Actualización
  // ========================================
  grupo("Actualización");

  await comprobar(
    "PUT conservando su propia franja horaria",
    "PUT",
    "/api/funciones/2",
    {
      eventoId: 1,
      fecha: "2027-02-19",
      hora: "19:00",
      tarifas: tarifasValidas,
      descuentosHabilitados: ["estudiante", "adultoMayor"]
    },
    200,
    (d) =>
      d.funcion.estado === "agotada" && d.funcion.tarifas[0].precio === 80000
        ? null
        : "no conservó el estado o no actualizó las tarifas"
  );
  await comprobar(
    "PUT hacia la franja de otra función",
    "PUT",
    "/api/funciones/2",
    {
      eventoId: 1,
      fecha: "2027-02-18",
      hora: "19:00",
      tarifas: tarifasValidas
    },
    409,
    (d) =>
      d.mensaje === "Ya existe una función programada en esa fecha y hora"
        ? null
        : `mensaje inesperado: ${d.mensaje}`
  );
  await comprobar(
    "PATCH parcial conserva el resto",
    "PATCH",
    "/api/funciones/2",
    { hora: "21:00" },
    200,
    (d) =>
      d.funcion.hora === "21:00" && d.funcion.fecha === "2027-02-19"
        ? null
        : "no conservó los campos no enviados"
  );
  await comprobar(
    "PATCH con cuerpo vacío",
    "PATCH",
    "/api/funciones/2",
    {},
    400,
    (d) =>
      d.mensaje === "Debe enviar al menos un campo para actualizar"
        ? null
        : "mensaje inesperado"
  );
  await comprobar(
    "PATCH que rompe la coherencia de precios",
    "PATCH",
    "/api/funciones/2",
    {
      tarifas: [
        { localidadId: 1, precio: 10000 },
        { localidadId: 2, precio: 60000 },
        { localidadId: 3, precio: 40000 }
      ]
    },
    409,
    (d) =>
      d.mensaje.includes("debe ser mayor")
        ? null
        : `mensaje inesperado: ${d.mensaje}`
  );
  await comprobar(
    "No se modifica una función cancelada",
    "PUT",
    "/api/funciones/7",
    {
      eventoId: 5,
      fecha: "2026-12-01",
      hora: "20:00",
      tarifas: tarifasValidas
    },
    409,
    (d) =>
      d.mensaje === "No se puede modificar una función en estado cancelada"
        ? null
        : `mensaje inesperado: ${d.mensaje}`
  );
  await comprobar(
    "No se modifica una función finalizada",
    "PATCH",
    "/api/funciones/6",
    { hora: "22:00" },
    409
  );

  // ========================================
  // Paso a en_venta con tarifas inválidas
  // ========================================
  grupo("En venta con tarifas rotas");

  const paraVenta = await comprobar(
    "Crea una función para la prueba",
    "POST",
    "/api/funciones",
    {
      eventoId: 1,
      fecha: "2026-12-05",
      hora: "19:00",
      tarifas: tarifasValidas
    },
    201
  );
  const idParaVenta = paraVenta.funcion.id;

  await comprobar(
    "Desactiva el Balcón",
    "PATCH",
    "/api/localidades/3/estado",
    { activa: false },
    200
  );
  await comprobar(
    "No se pone en venta con una localidad inactiva",
    "PATCH",
    `/api/funciones/${idParaVenta}/estado`,
    { estado: "en_venta" },
    409,
    (d) =>
      d.mensaje.includes("No se puede poner la función en venta")
        ? null
        : `mensaje inesperado: ${d.mensaje}`
  );
  await comprobar(
    "Reactiva el Balcón",
    "PATCH",
    "/api/localidades/3/estado",
    { activa: true },
    200
  );
  await comprobar(
    "Ahora sí se pone en venta",
    "PATCH",
    `/api/funciones/${idParaVenta}/estado`,
    { estado: "en_venta" },
    200
  );

  // ========================================
  // Eliminación
  // ========================================
  grupo("Eliminación");

  await comprobar(
    "No elimina una función con boletas vendidas",
    "DELETE",
    "/api/funciones/1",
    undefined,
    409,
    (d) =>
      d.mensaje === "No se puede eliminar la función porque tiene boletas asociadas"
        ? null
        : `mensaje inesperado: ${d.mensaje}`
  );
  await comprobar(
    "Elimina una función sin boletas",
    "DELETE",
    "/api/funciones/3",
    undefined,
    200
  );
  await comprobar(
    "Elimina dos veces",
    "DELETE",
    "/api/funciones/3",
    undefined,
    404
  );

  // ========================================
  // Informe
  // ========================================
  const anchoDesc = Math.max(...resultados.map((r) => r.descripcion.length), 11);
  let grupoImpreso = "";
  for (const r of resultados) {
    if (r.grupo !== grupoImpreso) {
      grupoImpreso = r.grupo;
      console.log("");
      console.log("== " + grupoImpreso + " " + "=".repeat(Math.max(3, 58 - grupoImpreso.length)));
    }
    const marca = r.ok ? "OK  " : "FALLA";
    const ruta = (r.metodo + " " + r.ruta).padEnd(32);
    console.log(
      `  ${marca} ${ruta} ${String(r.recibido).padEnd(4)} ${r.descripcion.padEnd(anchoDesc)}${r.detalle ? "  <-- " + r.detalle : ""}`
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
