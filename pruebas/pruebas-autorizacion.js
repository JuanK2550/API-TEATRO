// ========================================
// Configuración
// La API Key la pone sesion.js; el token lo elige cada petición
// ========================================
// Esta batería existe para probar quién puede hacer qué, así que no fija un
// token global: cada comprobación dice con qué identidad va, y sin token
// significa sin token de verdad.
const {
  entrarComoAdministrador,
  usarToken,
  pedirSinCredenciales
} = require("./sesion");

// Batería de autorización: la API Key dice qué aplicación entra, el JWT dice
// quién es la persona y el rol dice qué le corresponde hacer.
const BASE = "http://localhost:3000";

const resultados = [];
let grupoActual = "";

const grupo = (nombre) => {
  grupoActual = nombre;
};

const pedir = async (metodo, ruta, cuerpo, token) => {
  const opciones = { method: metodo, headers: {} };
  if (cuerpo !== undefined) {
    opciones.headers["Content-Type"] = "application/json";
    opciones.body = JSON.stringify(cuerpo);
  }
  if (token) {
    opciones.headers.Authorization = `Bearer ${token}`;
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

// comprobar(descripcion, metodo, ruta, cuerpo, token, estadoEsperado, extra)
const comprobar = async (
  descripcion,
  metodo,
  ruta,
  cuerpo,
  token,
  estadoEsperado,
  extra
) => {
  const { estado, datos } = await pedir(metodo, ruta, cuerpo, token);
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

// Una comprobación que no es una petición: afirma algo sobre lo ya obtenido.
const afirmar = (descripcion, problema) => {
  resultados.push({
    grupo: grupoActual,
    descripcion,
    metodo: "--",
    ruta: "",
    esperado: "sí",
    recibido: problema ? "no" : "sí",
    ok: !problema,
    detalle: problema || ""
  });
};

const MENSAJE_403 = "No tiene permisos para realizar esta operación";

// El rol viaja en la carga del JWT; aquí se lee sin verificar la firma,
// que es trabajo del servidor.
const rolDelToken = (token) => {
  try {
    return JSON.parse(Buffer.from(token.split(".")[1], "base64").toString()).rol;
  } catch {
    return null;
  }
};

const EVENTO_DE_PRUEBA = {
  titulo: "Prueba de autorización",
  tipo: "obra",
  descripcion: "Evento que crea y borra la batería de autorización",
  duracionMinutos: 90,
  clasificacionEdad: "G"
};

const principal = async () => {
  const tokenAdministrador = await entrarComoAdministrador();
  usarToken(null);

  // Una cuenta de asistente recién creada, para tener el rol más bajo.
  const marca = Date.now();
  const correoAsistente = `autorizacion${marca}@teatro.com`;
  await pedir("POST", "/api/auth/registro", {
    nombre: "Cuenta de autorización",
    email: correoAsistente,
    password: "Clave-Larga-Autorizacion-2026"
  });
  const entrada = await pedir("POST", "/api/auth/login", {
    email: correoAsistente,
    password: "Clave-Larga-Autorizacion-2026"
  });
  const tokenAsistente = entrada.datos && entrada.datos.token;

  // ========================================
  // Identidades
  // ========================================
  grupo("Identidades");

  afirmar(
    "El administrador inicial del .env puede entrar",
    tokenAdministrador ? null : "no se obtuvo token de administrador"
  );
  afirmar(
    "Su token lleva el rol administrador",
    rolDelToken(tokenAdministrador) === "administrador"
      ? null
      : `el rol del token es ${rolDelToken(tokenAdministrador)}`
  );
  afirmar(
    "Una cuenta recién registrada lleva el rol asistente",
    rolDelToken(tokenAsistente) === "asistente"
      ? null
      : `el rol del token es ${rolDelToken(tokenAsistente)}`
  );

  // ========================================
  // La puerta: API Key y token
  // ========================================
  grupo("La puerta");

  const sinClave = await pedirSinCredenciales(`${BASE}/api/eventos`);
  afirmar(
    "GET /api/eventos sin API Key responde 401",
    sinClave.status === 401 ? null : `respondió ${sinClave.status}`
  );

  await comprobar(
    "La cartelera es pública: no hace falta token",
    "GET",
    "/api/eventos",
    undefined,
    null,
    200,
    (d) => (Array.isArray(d) ? null : "no devolvió un array")
  );

  await comprobar(
    "Escribir sin token es 401, no 403",
    "POST",
    "/api/eventos",
    EVENTO_DE_PRUEBA,
    null,
    401
  );

  await comprobar(
    "Un token con la firma roto es 401",
    "POST",
    "/api/eventos",
    EVENTO_DE_PRUEBA,
    "abc.def.ghi",
    401
  );

  await comprobar(
    "El 401 de la cadena llega antes que el control de rol",
    "DELETE",
    "/api/boletas/1",
    undefined,
    null,
    401,
    (d) =>
      d && typeof d.mensaje === "string" ? null : "el 401 no trae mensaje"
  );

  // ========================================
  // El catálogo es del administrador
  // ========================================
  grupo("Catálogo");

  await comprobar(
    "Un asistente no crea eventos",
    "POST",
    "/api/eventos",
    EVENTO_DE_PRUEBA,
    tokenAsistente,
    403,
    (d) =>
      d && d.mensaje === MENSAJE_403
        ? null
        : `el mensaje del 403 es "${d && d.mensaje}"`
  );

  const creado = await comprobar(
    "El administrador sí crea eventos",
    "POST",
    "/api/eventos",
    EVENTO_DE_PRUEBA,
    tokenAdministrador,
    201
  );

  await comprobar(
    "Un asistente no cambia el estado de una función",
    "PATCH",
    "/api/funciones/1/estado",
    { estado: "cancelada" },
    tokenAsistente,
    403
  );

  await comprobar(
    "Cambiar el estado de una función sin token es 401",
    "PATCH",
    "/api/funciones/1/estado",
    { estado: "cancelada" },
    null,
    401
  );

  const estadoAdministrador = await pedir(
    "PATCH",
    "/api/funciones/1/estado",
    { estado: "en_venta" },
    tokenAdministrador
  );
  afirmar(
    "El administrador pasa el control de rol del estado de una función",
    estadoAdministrador.estado !== 401 && estadoAdministrador.estado !== 403
      ? null
      : `el control de rol lo rechazó con ${estadoAdministrador.estado}`
  );

  // ========================================
  // Los datos personales no son públicos
  // ========================================
  grupo("Datos personales");

  await comprobar(
    "Un asistente no lista a los demás asistentes",
    "GET",
    "/api/asistentes",
    undefined,
    tokenAsistente,
    403
  );

  await comprobar(
    "El administrador sí los lista",
    "GET",
    "/api/asistentes",
    undefined,
    tokenAdministrador,
    200,
    (d) => (Array.isArray(d) ? null : "no devolvió un array")
  );

  await comprobar(
    "Un asistente no lista todas las boletas",
    "GET",
    "/api/boletas",
    undefined,
    tokenAsistente,
    403
  );

  await comprobar(
    "El administrador sí las lista",
    "GET",
    "/api/boletas",
    undefined,
    tokenAdministrador,
    200,
    (d) => (Array.isArray(d) ? null : "no devolvió un array")
  );

  // ========================================
  // Lo propio es del asistente
  // ========================================
  grupo("Rutas propias");

  // 404 y no 403: el permiso está concedido, lo que falta es el registro.
  await comprobar(
    "El asistente entra a /mio aunque todavía no haya comprado",
    "GET",
    "/api/asistentes/mio",
    undefined,
    tokenAsistente,
    404
  );

  await comprobar(
    "El administrador no usa las rutas propias de un asistente",
    "GET",
    "/api/asistentes/mio",
    undefined,
    tokenAdministrador,
    403
  );

  await comprobar(
    "El asistente consulta sus propias boletas",
    "GET",
    "/api/boletas/mias",
    undefined,
    tokenAsistente,
    200,
    (d) => (Array.isArray(d) ? null : "no devolvió un array")
  );

  // ========================================
  // Borrado del evento de prueba
  // ========================================
  grupo("Borrado");

  const idCreado = creado && creado.evento && creado.evento.id;

  await comprobar(
    "Un asistente no borra el evento de prueba",
    "DELETE",
    `/api/eventos/${idCreado}`,
    undefined,
    tokenAsistente,
    403
  );

  await comprobar(
    "El administrador sí lo borra",
    "DELETE",
    `/api/eventos/${idCreado}`,
    undefined,
    tokenAdministrador,
    200
  );

  // ========================================
  // Informe
  // ========================================
  const anchoDesc = Math.max(...resultados.map((r) => r.descripcion.length));
  let grupoImpreso = "";

  for (const r of resultados) {
    if (r.grupo !== grupoImpreso) {
      grupoImpreso = r.grupo;
      console.log("");
      console.log(
        "== " + grupoImpreso + " " + "=".repeat(60 - grupoImpreso.length)
      );
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
