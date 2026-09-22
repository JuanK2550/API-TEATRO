// ========================================
// Configuración
// Carga el .env del proyecto y añade la X-API-Key a cada petición
// ========================================
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const CLAVE_API = process.env.API_KEY_POSTMAN;
const fetchSinClave = globalThis.fetch;
globalThis.fetch = (url, opciones = {}) =>
  fetchSinClave(url, {
    ...opciones,
    headers: { ...(opciones.headers || {}), "X-API-Key": CLAVE_API }
  });

// Casos 17 a 31: concurrencia y aforo, agenda de la sala, máquina de estados
// e integridad referencial.
const BASE = "http://localhost:3000";
const casos = [];

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

const preparar = pedir;

const caso = async (numero, descripcion, metodo, ruta, cuerpo, esperado, extra) => {
  const { estado, datos } = await pedir(metodo, ruta, cuerpo);
  let nota = "";
  let ok = estado === esperado;

  if (ok && typeof extra === "function") {
    const resultado = extra(datos);
    if (typeof resultado === "string") {
      // Una cadena siempre significa incumplimiento.
      ok = false;
      nota = resultado;
    } else if (resultado && resultado.nota) {
      // Un objeto { nota } es una comprobación superada con detalle.
      nota = resultado.nota;
    } else {
      nota = "verificado el cuerpo";
    }
  }

  casos.push({
    numero,
    descripcion,
    peticion: `${metodo} ${ruta}` + (cuerpo !== undefined ? ` ${JSON.stringify(cuerpo)}` : ""),
    esperado,
    obtenido: estado,
    ok,
    nota: nota || (datos && datos.mensaje ? datos.mensaje : "")
  });
  return datos;
};

const principal = async () => {
  // ---------- 17 y 18: butaca ocupada y liberada ----------
  const primera = await caso(
    17,
    "Primera boleta de una butaca libre",
    "POST",
    "/api/boletas",
    { asistenteId: 1, funcionId: 1, localidadId: 1, fila: 3, numero: 1 },
    201
  );
  await caso(
    17,
    "Segunda boleta de la misma butaca",
    "POST",
    "/api/boletas",
    { asistenteId: 2, funcionId: 1, localidadId: 1, fila: 3, numero: 1 },
    409,
    (d) =>
      d.mensaje === "La butaca ya está ocupada en esta función"
        ? null
        : `mensaje inesperado: ${d.mensaje}`
  );
  await preparar("PATCH", `/api/boletas/${primera.boleta.id}/estado`, {
    estado: "cancelada"
  });
  await caso(
    18,
    "La misma butaca tras cancelar la primera boleta",
    "POST",
    "/api/boletas",
    { asistenteId: 2, funcionId: 1, localidadId: 1, fila: 3, numero: 1 },
    201,
    (d) =>
      d.boleta.estado === "reservada"
        ? { nota: "la cancelación liberó la butaca" }
        : `estado inesperado: ${d.boleta.estado}`
  );

  // ---------- 19: aforo ----------
  // El aforo solo se alcanza si la capacidad se reduce después de vender,
  // porque la unicidad de butaca ya impide vender más boletas que butacas.
  const localidad = await preparar("POST", "/api/localidades", {
    codigo: "TER-TUL",
    nombre: "Tertulia",
    orden: 9,
    filas: 2,
    butacasPorFila: 2
  });
  const localidadId = localidad.datos.localidad.id;

  const funcionAforo = await preparar("POST", "/api/funciones", {
    eventoId: 1,
    fecha: "2026-12-20",
    hora: "19:00",
    tarifas: [
      { localidadId: 1, precio: 100000 },
      { localidadId: 2, precio: 80000 },
      { localidadId: 3, precio: 60000 },
      { localidadId, precio: 40000 }
    ]
  });
  const funcionAforoId = funcionAforo.datos.funcion.id;
  await preparar("PATCH", `/api/funciones/${funcionAforoId}/estado`, { estado: "en_venta" });
  await preparar("POST", "/api/boletas", {
    asistenteId: 1,
    funcionId: funcionAforoId,
    localidadId,
    fila: 1,
    numero: 1
  });
  await preparar("POST", "/api/boletas", {
    asistenteId: 2,
    funcionId: funcionAforoId,
    localidadId,
    fila: 1,
    numero: 2
  });
  await preparar("PATCH", `/api/localidades/${localidadId}`, { butacasPorFila: 1 });

  await caso(
    19,
    "Butaca libre pero aforo de la localidad alcanzado",
    "POST",
    "/api/boletas",
    { asistenteId: 3, funcionId: funcionAforoId, localidadId, fila: 2, numero: 1 },
    409,
    (d) =>
      d.mensaje === "Se alcanzó el aforo de la localidad para esta función"
        ? null
        : `mensaje inesperado: ${d.mensaje}`
  );

  // ---------- 20: límite de 6 boletas por asistente ----------
  // Se crea un asistente nuevo para partir de cero: los de los datos semilla
  // ya tienen boletas en la función 1 y falsearían el conteo.
  const nuevoAsistente = await preparar("POST", "/api/asistentes", {
    nombre: "Comprador Compulsivo Prueba",
    documento: "9988776655",
    email: "compulsivo@correo.com",
    telefono: "3009998877",
    fechaNacimiento: "1990-06-15"
  });
  const asistenteLimite = nuevoAsistente.datos.asistente.id;

  for (let numero = 1; numero <= 6; numero += 1) {
    const r = await preparar("POST", "/api/boletas", {
      asistenteId: asistenteLimite,
      funcionId: 1,
      localidadId: 2,
      fila: 6,
      numero
    });
    if (r.estado !== 201) {
      casos.push({
        numero: 20,
        descripcion: `Preparación: boleta ${numero} de 6 del asistente nuevo`,
        peticion: "POST /api/boletas",
        esperado: 201,
        obtenido: r.estado,
        ok: false,
        nota: r.datos && r.datos.mensaje
      });
    }
  }
  await caso(
    20,
    "Séptima boleta del mismo asistente en la misma función",
    "POST",
    "/api/boletas",
    { asistenteId: asistenteLimite, funcionId: 1, localidadId: 2, fila: 6, numero: 7 },
    409,
    (d) =>
      d.mensaje === "Se superó el límite de 6 boletas por asistente en una función"
        ? null
        : `mensaje inesperado: ${d.mensaje}`
  );

  // ---------- 21 a 23: agenda de la sala ----------
  await preparar("POST", "/api/funciones", {
    eventoId: 1,
    fecha: "2026-11-15",
    hora: "20:00",
    tarifas: [
      { localidadId: 1, precio: 100000 },
      { localidadId: 2, precio: 80000 },
      { localidadId: 3, precio: 60000 },
      { localidadId, precio: 40000 }
    ]
  });
  await caso(
    21,
    "Segunda función en la misma fecha y hora",
    "POST",
    "/api/funciones",
    {
      eventoId: 2,
      fecha: "2026-11-15",
      hora: "20:00",
      tarifas: [
        { localidadId: 1, precio: 100000 },
        { localidadId: 2, precio: 80000 },
        { localidadId: 3, precio: 60000 },
        { localidadId, precio: 40000 }
      ]
    },
    409,
    (d) =>
      d.mensaje === "Ya existe una función programada en esa fecha y hora"
        ? null
        : `mensaje inesperado: ${d.mensaje}`
  );
  await caso(
    22,
    "Función con fecha en el pasado",
    "POST",
    "/api/funciones",
    {
      eventoId: 1,
      fecha: "2025-03-01",
      hora: "19:00",
      tarifas: [
        { localidadId: 1, precio: 100000 },
        { localidadId: 2, precio: 80000 },
        { localidadId: 3, precio: 60000 },
        { localidadId, precio: 40000 }
      ]
    },
    409,
    (d) => (d.mensaje.includes("pasado") ? null : `mensaje inesperado: ${d.mensaje}`)
  );
  await caso(
    23,
    "Función de un evento inactivo",
    "POST",
    "/api/funciones",
    {
      eventoId: 5,
      fecha: "2026-11-16",
      hora: "20:00",
      tarifas: [
        { localidadId: 1, precio: 100000 },
        { localidadId: 2, precio: 80000 },
        { localidadId: 3, precio: 60000 },
        { localidadId, precio: 40000 }
      ]
    },
    409,
    (d) =>
      d.mensaje === "No se pueden programar funciones de un evento inactivo"
        ? null
        : `mensaje inesperado: ${d.mensaje}`
  );

  // ---------- 24 a 29: máquina de estados ----------
  const paraEstados = await preparar("POST", "/api/boletas", {
    asistenteId: 5,
    funcionId: 1,
    localidadId: 1,
    fila: 5,
    numero: 20
  });
  const boletaId = paraEstados.datos.boleta.id;

  await caso(
    24,
    "Boleta reservada a pagada",
    "PATCH",
    `/api/boletas/${boletaId}/estado`,
    { estado: "pagada" },
    200,
    (d) => (d.boleta.estado === "pagada" ? null : "no cambió el estado")
  );
  await caso(
    25,
    "Boleta pagada a usada con la función solo en venta",
    "PATCH",
    `/api/boletas/${boletaId}/estado`,
    { estado: "usada" },
    409,
    (d) => (d.mensaje.includes("en_curso") ? null : `mensaje inesperado: ${d.mensaje}`)
  );
  await preparar("PATCH", "/api/funciones/1/estado", { estado: "en_curso" });
  await caso(
    26,
    "Boleta pagada a usada con la función en curso",
    "PATCH",
    `/api/boletas/${boletaId}/estado`,
    { estado: "usada" },
    200,
    (d) => (d.boleta.estado === "usada" ? null : "no cambió el estado")
  );
  await caso(
    27,
    "Marcar como usada una boleta ya usada",
    "PATCH",
    `/api/boletas/${boletaId}/estado`,
    { estado: "usada" },
    409,
    (d) =>
      d.mensaje === "No se permite cambiar una boleta de usada a usada"
        ? null
        : `mensaje inesperado: ${d.mensaje}`
  );
  await caso(
    28,
    "Boleta usada a cancelada",
    "PATCH",
    `/api/boletas/${boletaId}/estado`,
    { estado: "cancelada" },
    409,
    (d) =>
      d.mensaje === "No se permite cambiar una boleta de usada a cancelada"
        ? null
        : `mensaje inesperado: ${d.mensaje}`
  );
  await caso(
    29,
    "Función finalizada a en_venta",
    "PATCH",
    "/api/funciones/6/estado",
    { estado: "en_venta" },
    409,
    (d) =>
      d.mensaje === "No se permite cambiar una función de finalizada a en_venta"
        ? null
        : `mensaje inesperado: ${d.mensaje}`
  );

  // ---------- 30 y 31: integridad ----------
  await caso(
    30,
    "Borrar una función con boletas vendidas",
    "DELETE",
    "/api/funciones/1",
    undefined,
    409,
    (d) =>
      d.mensaje === "No se puede eliminar la función porque tiene boletas asociadas"
        ? null
        : `mensaje inesperado: ${d.mensaje}`
  );
  await caso(
    31,
    "Boleta de una función en estado programada",
    "POST",
    "/api/boletas",
    { asistenteId: 1, funcionId: 5, localidadId: 1, fila: 1, numero: 1 },
    409,
    (d) =>
      d.mensaje === "No se pueden vender boletas de una función en estado programada"
        ? null
        : `mensaje inesperado: ${d.mensaje}`
  );

  casos.sort((a, b) => a.numero - b.numero);
  console.log(JSON.stringify(casos));
};

principal().catch((error) => {
  console.error("ERROR:", error);
  process.exit(1);
});
