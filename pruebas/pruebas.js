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

// Batería de pruebas de los tres recursos simples contra el servidor en marcha.
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

// comprobar(descripcion, metodo, ruta, cuerpo, estadoEsperado, verificacionExtra)
const comprobar = async (
  descripcion,
  metodo,
  ruta,
  cuerpo,
  estadoEsperado,
  extra
) => {
  const { estado, datos } = await pedir(metodo, ruta, cuerpo);
  let detalle = "";
  let ok = estado === estadoEsperado;

  if (!ok) {
    detalle = `esperaba ${estadoEsperado}, recibió ${estado}`;
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
    esperado: estadoEsperado,
    recibido: estado,
    ok,
    detalle
  });

  return datos;
};

const principal = async () => {
  // ========================================
  // Asistentes
  // ========================================
  grupo("Asistentes");

  await comprobar("Lista todos", "GET", "/api/asistentes", undefined, 200, (d) =>
    Array.isArray(d) && d.length === 5 ? null : "no devolvió los 5 asistentes"
  );
  await comprobar("Obtiene por id", "GET", "/api/asistentes/1", undefined, 200, (d) =>
    d.id === 1 ? null : "id inesperado"
  );
  await comprobar("Id inexistente", "GET", "/api/asistentes/999", undefined, 404, (d) =>
    d.mensaje === "Asistente no encontrado" ? null : "mensaje inesperado"
  );
  await comprobar("Id no numérico", "GET", "/api/asistentes/abc", undefined, 400, (d) =>
    d.mensaje === "Datos de entrada inválidos" ? null : "mensaje inesperado"
  );

  const creado = await comprobar(
    "Crea uno válido y normaliza el email",
    "POST",
    "/api/asistentes",
    {
      nombre: "Diana Marcela Ávila Cely",
      documento: "1053998877",
      email: "DIANA.AVILA@Correo.COM",
      telefono: "3153344556",
      fechaNacimiento: "1992-06-11"
    },
    201,
    (d) =>
      d.asistente &&
      d.asistente.email === "diana.avila@correo.com" &&
      d.mensaje === "Asistente creado correctamente"
        ? null
        : "no normalizó el email o falta la clave asistente"
  );
  const nuevoId = creado.asistente.id;

  await comprobar(
    "Documento duplicado",
    "POST",
    "/api/asistentes",
    {
      nombre: "Otro Nombre Distinto",
      documento: "1053998877",
      email: "otro@correo.com",
      telefono: "3001112233",
      fechaNacimiento: "1990-01-01"
    },
    409,
    (d) => (d.mensaje.includes("documento") ? null : "mensaje inesperado")
  );
  await comprobar(
    "Email con formato inválido",
    "POST",
    "/api/asistentes",
    {
      nombre: "Prueba Email Malo",
      documento: "5555555",
      email: "esto-no-es-email",
      telefono: "3001112233",
      fechaNacimiento: "1990-01-01"
    },
    400
  );
  await comprobar(
    "Fecha de nacimiento futura",
    "POST",
    "/api/asistentes",
    {
      nombre: "Prueba Fecha Futura",
      documento: "6666666",
      email: "futuro@correo.com",
      telefono: "3001112233",
      fechaNacimiento: "2099-01-01"
    },
    400
  );
  await comprobar(
    "Fecha de nacimiento inexistente (30 de febrero)",
    "POST",
    "/api/asistentes",
    {
      nombre: "Prueba Fecha Irreal",
      documento: "7777777",
      email: "irreal@correo.com",
      telefono: "3001112233",
      fechaNacimiento: "2020-02-30"
    },
    400
  );
  await comprobar(
    "Mass Assignment: descarta campos no declarados",
    "POST",
    "/api/asistentes",
    {
      nombre: "Intruso Mass Assignment",
      documento: "8888888",
      email: "intruso@correo.com",
      telefono: "3001112233",
      fechaNacimiento: "1985-04-04",
      id: 9999,
      rol: "administrador"
    },
    201,
    (d) =>
      d.asistente.id !== 9999 && d.asistente.rol === undefined
        ? null
        : "aceptó un campo no declarado"
  );

  await comprobar(
    "Actualización total",
    "PUT",
    `/api/asistentes/${nuevoId}`,
    {
      nombre: "Diana Marcela Ávila Cely",
      documento: "1053998877",
      email: "diana.nueva@correo.com",
      telefono: "3159999999",
      fechaNacimiento: "1992-06-11"
    },
    200,
    (d) =>
      d.asistente.id === nuevoId && d.asistente.telefono === "3159999999"
        ? null
        : "no conservó el id o no actualizó"
  );
  await comprobar(
    "Actualización total de id inexistente",
    "PUT",
    "/api/asistentes/999",
    {
      nombre: "No Existe Nadie",
      documento: "1231231",
      email: "noexiste@correo.com",
      telefono: "3001112233",
      fechaNacimiento: "1990-01-01"
    },
    404
  );
  await comprobar(
    "Actualización total con documento de otro",
    "PUT",
    `/api/asistentes/${nuevoId}`,
    {
      nombre: "Diana Marcela Ávila Cely",
      documento: "1049632178",
      email: "diana.nueva@correo.com",
      telefono: "3159999999",
      fechaNacimiento: "1992-06-11"
    },
    409
  );
  await comprobar(
    "Actualización parcial conserva el resto",
    "PATCH",
    `/api/asistentes/${nuevoId}`,
    { telefono: "3170000000" },
    200,
    (d) =>
      d.asistente.telefono === "3170000000" &&
      d.asistente.nombre === "Diana Marcela Ávila Cely"
        ? null
        : "no conservó los campos no enviados"
  );
  await comprobar(
    "Actualización parcial con cuerpo vacío",
    "PATCH",
    `/api/asistentes/${nuevoId}`,
    {},
    400,
    (d) =>
      d.mensaje === "Debe enviar al menos un campo para actualizar"
        ? null
        : "mensaje inesperado"
  );
  await comprobar(
    "Actualización parcial de id inexistente",
    "PATCH",
    "/api/asistentes/999",
    { telefono: "3170000000" },
    404
  );
  await comprobar(
    "Elimina",
    "DELETE",
    `/api/asistentes/${nuevoId}`,
    undefined,
    200,
    (d) =>
      d.mensaje === "Asistente eliminado correctamente" ? null : "mensaje inesperado"
  );
  await comprobar(
    "Elimina dos veces",
    "DELETE",
    `/api/asistentes/${nuevoId}`,
    undefined,
    404
  );

  // ========================================
  // Eventos
  // ========================================
  grupo("Eventos");

  await comprobar("Lista todos", "GET", "/api/eventos", undefined, 200, (d) =>
    Array.isArray(d) && d.length === 5 ? null : "no devolvió los 5 eventos"
  );
  await comprobar("Obtiene por id", "GET", "/api/eventos/1", undefined, 200, (d) =>
    d.id === 1 ? null : "id inesperado"
  );
  await comprobar("Id inexistente", "GET", "/api/eventos/999", undefined, 404);

  const eventoCreado = await comprobar(
    "Crea uno válido y nace activo",
    "POST",
    "/api/eventos",
    {
      titulo: "Danza Folclórica de Boyacá",
      tipo: "obra",
      descripcion: "Muestra de danzas tradicionales del departamento de Boyacá.",
      duracionMinutos: 90,
      clasificacionEdad: "G"
    },
    201,
    (d) => (d.evento.activo === true ? null : "no nació activo")
  );
  const eventoId = eventoCreado.evento.id;

  await comprobar(
    "Mass Assignment: ignora activo enviado por el cliente",
    "POST",
    "/api/eventos",
    {
      titulo: "Evento Que Intenta Nacer Inactivo",
      tipo: "cine",
      descripcion: "Descripción suficientemente larga para pasar la validación.",
      duracionMinutos: 100,
      clasificacionEdad: "+12",
      activo: false
    },
    201,
    (d) => (d.evento.activo === true ? null : "el cliente logró fijar activo")
  );
  await comprobar(
    "Tipo fuera de la lista blanca",
    "POST",
    "/api/eventos",
    {
      titulo: "Tipo Inválido",
      tipo: "circo",
      descripcion: "Descripción suficientemente larga para pasar la validación.",
      duracionMinutos: 100,
      clasificacionEdad: "G"
    },
    400
  );
  await comprobar(
    "Clasificación de edad fuera de la lista blanca",
    "POST",
    "/api/eventos",
    {
      titulo: "Clasificación Inválida",
      tipo: "obra",
      descripcion: "Descripción suficientemente larga para pasar la validación.",
      duracionMinutos: 100,
      clasificacionEdad: "+21"
    },
    400
  );
  await comprobar(
    "Duración por debajo del mínimo",
    "POST",
    "/api/eventos",
    {
      titulo: "Duración Corta",
      tipo: "obra",
      descripcion: "Descripción suficientemente larga para pasar la validación.",
      duracionMinutos: 5,
      clasificacionEdad: "G"
    },
    400
  );
  await comprobar(
    "Título demasiado corto",
    "POST",
    "/api/eventos",
    {
      titulo: "AB",
      tipo: "obra",
      descripcion: "Descripción suficientemente larga para pasar la validación.",
      duracionMinutos: 100,
      clasificacionEdad: "G"
    },
    400
  );
  await comprobar(
    "Actualización total conserva activo",
    "PUT",
    `/api/eventos/${eventoId}`,
    {
      titulo: "Danza Folclórica de Boyacá (versión ampliada)",
      tipo: "obra",
      descripcion: "Muestra ampliada de danzas tradicionales del departamento.",
      duracionMinutos: 120,
      clasificacionEdad: "G"
    },
    200,
    (d) =>
      d.evento.activo === true && d.evento.duracionMinutos === 120
        ? null
        : "no conservó activo o no actualizó"
  );
  await comprobar(
    "Actualización parcial",
    "PATCH",
    `/api/eventos/${eventoId}`,
    { duracionMinutos: 95 },
    200,
    (d) =>
      d.evento.duracionMinutos === 95 && d.evento.tipo === "obra"
        ? null
        : "no conservó los campos no enviados"
  );
  await comprobar(
    "Actualización parcial con cuerpo vacío",
    "PATCH",
    `/api/eventos/${eventoId}`,
    {},
    400,
    (d) =>
      d.mensaje === "Debe enviar al menos un campo para actualizar"
        ? null
        : "mensaje inesperado"
  );
  await comprobar(
    "Mass Assignment: PATCH con solo activo no lo cambia",
    "PATCH",
    `/api/eventos/${eventoId}`,
    { activo: false },
    400,
    (d) =>
      d.mensaje === "Debe enviar al menos un campo para actualizar"
        ? null
        : "activo llegó al service"
  );
  await comprobar(
    "Desactiva con el endpoint de estado",
    "PATCH",
    `/api/eventos/${eventoId}/estado`,
    { activo: false },
    200,
    (d) => (d.evento.activo === false ? null : "no desactivó")
  );
  await comprobar(
    "Reactiva con el endpoint de estado",
    "PATCH",
    `/api/eventos/${eventoId}/estado`,
    { activo: true },
    200,
    (d) => (d.evento.activo === true ? null : "no reactivó")
  );
  await comprobar(
    "Estado con valor no booleano",
    "PATCH",
    `/api/eventos/${eventoId}/estado`,
    { activo: "quizás" },
    400
  );
  await comprobar(
    "Estado de id inexistente",
    "PATCH",
    "/api/eventos/999/estado",
    { activo: false },
    404
  );
  await comprobar("Elimina", "DELETE", `/api/eventos/${eventoId}`, undefined, 200);
  await comprobar(
    "Elimina dos veces",
    "DELETE",
    `/api/eventos/${eventoId}`,
    undefined,
    404
  );

  // ========================================
  // Localidades
  // ========================================
  grupo("Localidades");

  await comprobar("Lista todas", "GET", "/api/localidades", undefined, 200, (d) =>
    Array.isArray(d) && d.length === 3 ? null : "no devolvió las 3 localidades"
  );
  await comprobar("Obtiene por id", "GET", "/api/localidades/1", undefined, 200, (d) =>
    d.codigo === "PLA-PREF" ? null : "código inesperado"
  );
  await comprobar("Id inexistente", "GET", "/api/localidades/999", undefined, 404);

  const localidadCreada = await comprobar(
    "Crea una válida y calcula la capacidad",
    "POST",
    "/api/localidades",
    {
      codigo: "PAL-LAT",
      nombre: "Palcos Laterales",
      orden: 4,
      filas: 4,
      butacasPorFila: 6
    },
    201,
    (d) =>
      d.localidad.capacidad === 24 && d.localidad.activa === true
        ? null
        : "capacidad mal calculada o no nació activa"
  );
  const localidadId = localidadCreada.localidad.id;

  await comprobar(
    "Normaliza el código a mayúsculas",
    "POST",
    "/api/localidades",
    {
      codigo: "gal-sup",
      nombre: "Galería Superior",
      orden: 5,
      filas: 3,
      butacasPorFila: 10
    },
    201,
    (d) => (d.localidad.codigo === "GAL-SUP" ? null : "no normalizó el código")
  );
  await comprobar(
    "Mass Assignment: ignora capacidad y activa del cliente",
    "POST",
    "/api/localidades",
    {
      codigo: "TRA-MOY",
      nombre: "Tramoya",
      orden: 6,
      filas: 2,
      butacasPorFila: 5,
      capacidad: 99999,
      activa: false
    },
    201,
    (d) =>
      d.localidad.capacidad === 10 && d.localidad.activa === true
        ? null
        : "el cliente logró fijar capacidad o activa"
  );
  await comprobar(
    "Código duplicado",
    "POST",
    "/api/localidades",
    {
      codigo: "PLA-GEN",
      nombre: "Intento Duplicado",
      orden: 7,
      filas: 2,
      butacasPorFila: 2
    },
    409,
    (d) => (d.mensaje.includes("código") ? null : "mensaje inesperado")
  );
  await comprobar(
    "Orden duplicado",
    "POST",
    "/api/localidades",
    {
      codigo: "NUE-VO",
      nombre: "Intento Orden Repetido",
      orden: 1,
      filas: 2,
      butacasPorFila: 2
    },
    409,
    (d) => (d.mensaje.includes("orden") ? null : "mensaje inesperado")
  );
  await comprobar(
    "Filas en cero",
    "POST",
    "/api/localidades",
    {
      codigo: "CER-O",
      nombre: "Sin Filas",
      orden: 8,
      filas: 0,
      butacasPorFila: 10
    },
    400
  );
  await comprobar(
    "Actualización total recalcula la capacidad",
    "PUT",
    `/api/localidades/${localidadId}`,
    {
      codigo: "PAL-LAT",
      nombre: "Palcos Laterales Ampliados",
      orden: 4,
      filas: 5,
      butacasPorFila: 8
    },
    200,
    (d) =>
      d.localidad.capacidad === 40 && d.localidad.activa === true
        ? null
        : "no recalculó la capacidad o perdió activa"
  );
  await comprobar(
    "Actualización total con código de otra",
    "PUT",
    `/api/localidades/${localidadId}`,
    {
      codigo: "BAL",
      nombre: "Palcos Laterales Ampliados",
      orden: 4,
      filas: 5,
      butacasPorFila: 8
    },
    409
  );
  await comprobar(
    "Actualización total con orden de otra",
    "PUT",
    `/api/localidades/${localidadId}`,
    {
      codigo: "PAL-LAT",
      nombre: "Palcos Laterales Ampliados",
      orden: 2,
      filas: 5,
      butacasPorFila: 8
    },
    409
  );
  await comprobar(
    "Actualización parcial recalcula la capacidad",
    "PATCH",
    `/api/localidades/${localidadId}`,
    { filas: 10 },
    200,
    (d) =>
      d.localidad.capacidad === 80 && d.localidad.butacasPorFila === 8
        ? null
        : "no recalculó la capacidad con el aforo resultante"
  );
  await comprobar(
    "Actualización parcial con cuerpo vacío",
    "PATCH",
    `/api/localidades/${localidadId}`,
    {},
    400,
    (d) =>
      d.mensaje === "Debe enviar al menos un campo para actualizar"
        ? null
        : "mensaje inesperado"
  );
  await comprobar(
    "Desactiva con el endpoint de estado",
    "PATCH",
    `/api/localidades/${localidadId}/estado`,
    { activa: false },
    200,
    (d) => (d.localidad.activa === false ? null : "no desactivó")
  );
  await comprobar(
    "Estado sin el campo activa",
    "PATCH",
    `/api/localidades/${localidadId}/estado`,
    {},
    400
  );
  await comprobar(
    "Elimina",
    "DELETE",
    `/api/localidades/${localidadId}`,
    undefined,
    200
  );
  await comprobar(
    "Elimina dos veces",
    "DELETE",
    `/api/localidades/${localidadId}`,
    undefined,
    404
  );

  // ========================================
  // Rutas generales
  // ========================================
  grupo("Generales");

  await comprobar("Raíz responde", "GET", "/", undefined, 200, (d) =>
    d.mensaje === "API Teatro funcionando" ? null : "mensaje inesperado"
  );
  await comprobar("Ruta inexistente", "GET", "/api/no-existe", undefined, 404, (d) =>
    d.mensaje === "Ruta no encontrada" ? null : "mensaje inesperado"
  );

  // ========================================
  // Informe
  // ========================================
  const anchoDesc = Math.max(
    ...resultados.map((r) => r.descripcion.length),
    11
  );
  let grupoImpreso = "";
  for (const r of resultados) {
    if (r.grupo !== grupoImpreso) {
      grupoImpreso = r.grupo;
      console.log("");
      console.log("== " + grupoImpreso + " " + "=".repeat(60 - grupoImpreso.length));
    }
    const marca = r.ok ? "OK  " : "FALLA";
    const ruta = (r.metodo + " " + r.ruta).padEnd(34);
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
