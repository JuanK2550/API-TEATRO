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

// Casos 1 a 16: validación de entrada, Mass Assignment, precios y localidades.
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
  return { estado: respuesta.status, datos, cabeceras: respuesta.headers };
};

// Petición auxiliar que no se registra como caso.
const preparar = async (metodo, ruta, cuerpo) => pedir(metodo, ruta, cuerpo);

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
  // ---------- 1 a 7: validación y entrada ----------
  await caso(
    1,
    "Asistente con todos los campos correctos",
    "POST",
    "/api/asistentes",
    {
      nombre: "Paula Andrea Sánchez Torres",
      documento: "1098765432",
      email: "paula.sanchez@correo.com",
      telefono: "3145566778",
      fechaNacimiento: "1997-04-23"
    },
    201
  );
  await caso(
    2,
    "Asistente sin nombre",
    "POST",
    "/api/asistentes",
    {
      documento: "1011223344",
      email: "sinnombre@correo.com",
      telefono: "3001234567",
      fechaNacimiento: "1990-01-01"
    },
    400,
    (d) => {
      const campos = (d.errores || []).map((e) => e.campo);
      return campos.includes("nombre")
        ? { nota: `detalla el campo: ${JSON.stringify(d.errores.find((e) => e.campo === "nombre"))}` }
        : `no detalla el campo nombre: ${JSON.stringify(d)}`;
    }
  );
  await caso(3, "Boleta inexistente", "GET", "/api/boletas/9999", undefined, 404);
  await caso(4, "Id de boleta no numérico", "GET", "/api/boletas/abc", undefined, 400, (d) =>
    d.mensaje === "Datos de entrada inválidos" ? null : `mensaje inesperado: ${d.mensaje}`
  );
  await caso(
    5,
    "Boleta sin funcionId",
    "POST",
    "/api/boletas",
    { asistenteId: 1, localidadId: 1, fila: 1, numero: 2 },
    400,
    (d) =>
      (d.errores || []).some((e) => e.campo === "funcionId")
        ? null
        : "no detalla el campo funcionId"
  );
  await caso(
    6,
    "duracionMinutos como texto",
    "POST",
    "/api/eventos",
    {
      titulo: "Evento con duración textual",
      tipo: "obra",
      descripcion: "Descripción suficientemente larga para pasar la validación.",
      duracionMinutos: "noventa",
      clasificacionEdad: "G"
    },
    400,
    (d) =>
      (d.errores || []).some((e) => e.campo === "duracionMinutos")
        ? null
        : "no detalla el campo duracionMinutos"
  );
  await caso(
    7,
    "clasificacionEdad fuera de la lista blanca",
    "POST",
    "/api/eventos",
    {
      titulo: "Evento con clasificación inventada",
      tipo: "obra",
      descripcion: "Descripción suficientemente larga para pasar la validación.",
      duracionMinutos: 90,
      clasificacionEdad: "+99"
    },
    400,
    (d) =>
      (d.errores || []).some((e) => e.campo === "clasificacionEdad")
        ? null
        : "no detalla el campo clasificacionEdad"
  );

  // ---------- 8 a 11: Mass Assignment ----------
  // Función 1 en venta: tarifa de Platea Preferencial 75000.
  await caso(
    8,
    "Boleta enviando precio: 1",
    "POST",
    "/api/boletas",
    { asistenteId: 1, funcionId: 1, localidadId: 1, fila: 3, numero: 1, precio: 1 },
    201,
    (d) =>
      d.boleta.precio === 75000
        ? { nota: `precio guardado ${d.boleta.precio}, el enviado era 1` }
        : `el servidor aceptó el precio del cliente: ${d.boleta.precio}`
  );
  await caso(
    9,
    "Boleta enviando estado: pagada",
    "POST",
    "/api/boletas",
    { asistenteId: 1, funcionId: 1, localidadId: 1, fila: 3, numero: 2, estado: "pagada" },
    201,
    (d) =>
      d.boleta.estado === "reservada"
        ? { nota: "estado guardado: reservada, no el enviado" }
        : `el servidor aceptó el estado del cliente: ${d.boleta.estado}`
  );
  await caso(
    10,
    "Boleta enviando codigo: HACK",
    "POST",
    "/api/boletas",
    { asistenteId: 1, funcionId: 1, localidadId: 1, fila: 3, numero: 3, codigo: "HACK" },
    201,
    (d) =>
      /^BOL-\d{4}-\d{4}$/.test(d.boleta.codigo)
        ? { nota: `código generado por el servidor: ${d.boleta.codigo}` }
        : `el servidor aceptó el código del cliente: ${d.boleta.codigo}`
  );
  await caso(
    11,
    "Función enviando estado: en_venta",
    "POST",
    "/api/funciones",
    {
      eventoId: 1,
      fecha: "2026-11-05",
      hora: "19:00",
      tarifas: [
        { localidadId: 1, precio: 90000 },
        { localidadId: 2, precio: 70000 },
        { localidadId: 3, precio: 50000 }
      ],
      estado: "en_venta"
    },
    201,
    (d) =>
      d.funcion.estado === "programada"
        ? { nota: "estado guardado: programada, no el enviado" }
        : `el servidor aceptó el estado del cliente: ${d.funcion.estado}`
  );

  // ---------- 12: comparar precios por cercanía ----------
  const preferencial = await pedir("POST", "/api/boletas", {
    asistenteId: 2,
    funcionId: 1,
    localidadId: 1,
    fila: 4,
    numero: 1
  });
  const balcon = await pedir("POST", "/api/boletas", {
    asistenteId: 2,
    funcionId: 1,
    localidadId: 3,
    fila: 4,
    numero: 4
  });
  const precioPref = preferencial.datos.boleta.precio;
  const precioBal = balcon.datos.boleta.precio;
  casos.push({
    numero: 12,
    descripcion: "Platea Preferencial más cara que Balcón en la misma función",
    peticion: "POST /api/boletas x2 (localidad 1 y localidad 3, función 1)",
    esperado: 201,
    obtenido: balcon.estado,
    ok: balcon.estado === 201 && precioPref > precioBal,
    nota: `preferencial ${precioPref} > balcón ${precioBal}`
  });

  // ---------- 13: precios incoherentes ----------
  await caso(
    13,
    "Función con el Balcón más caro que la Platea Preferencial",
    "POST",
    "/api/funciones",
    {
      eventoId: 1,
      fecha: "2026-11-06",
      hora: "19:00",
      tarifas: [
        { localidadId: 1, precio: 30000 },
        { localidadId: 2, precio: 50000 },
        { localidadId: 3, precio: 80000 }
      ]
    },
    409,
    (d) => (d.mensaje.includes("debe ser mayor") ? null : `mensaje inesperado: ${d.mensaje}`)
  );

  // ---------- 15 y 16: descuentos ----------
  // Función nueva sin ningún descuento habilitado, puesta en venta.
  const sinDescuentos = await preparar("POST", "/api/funciones", {
    eventoId: 1,
    fecha: "2026-11-10",
    hora: "19:00",
    tarifas: [
      { localidadId: 1, precio: 90000 },
      { localidadId: 2, precio: 70000 },
      { localidadId: 3, precio: 50000 }
    ],
    descuentosHabilitados: []
  });
  const idSinDescuentos = sinDescuentos.datos.funcion.id;
  await preparar("PATCH", `/api/funciones/${idSinDescuentos}/estado`, { estado: "en_venta" });

  await caso(
    15,
    "Descuento estudiante en una función que no lo habilita",
    "POST",
    "/api/boletas",
    {
      asistenteId: 3,
      funcionId: idSinDescuentos,
      localidadId: 1,
      fila: 1,
      numero: 1,
      tipoDescuento: "estudiante"
    },
    409,
    (d) =>
      d.mensaje === "El descuento estudiante no está habilitado para esta función"
        ? null
        : `mensaje inesperado: ${d.mensaje}`
  );
  await caso(
    16,
    "Descuento estudiante en una función que sí lo habilita",
    "POST",
    "/api/boletas",
    {
      asistenteId: 3,
      funcionId: 1,
      localidadId: 1,
      fila: 5,
      numero: 1,
      tipoDescuento: "estudiante"
    },
    201,
    (d) =>
      d.boleta.precio === 60000
        ? { nota: "precio 60000, el 80% de la tarifa 75000" }
        : `precio ${d.boleta.precio}, esperado 60000 (80% de 75000)`
  );

  // ---------- 14: en_venta sin tarifa para una localidad activa ----------
  // Se crea una localidad nueva y activa; la función 3, programada, no tiene
  // tarifa para ella, así que ya no puede ponerse en venta.
  await preparar("POST", "/api/localidades", {
    codigo: "TER-TUL",
    nombre: "Tertulia",
    orden: 9,
    filas: 3,
    butacasPorFila: 5
  });
  await caso(
    14,
    "Poner en venta una función sin tarifa para una localidad activa",
    "PATCH",
    "/api/funciones/3/estado",
    { estado: "en_venta" },
    409,
    (d) =>
      d.mensaje.includes("Faltan tarifas para las localidades")
        ? null
        : `mensaje inesperado: ${d.mensaje}`
  );

  // ---------- Informe ----------
  casos.sort((a, b) => a.numero - b.numero);
  console.log(JSON.stringify(casos));
};

principal().catch((error) => {
  console.error("ERROR:", error);
  process.exit(1);
});
