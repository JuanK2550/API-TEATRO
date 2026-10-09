// ========================================
// Configuración
// La API Key la pone sesion.js; el token lo elige cada petición
// ========================================
// Esta batería cambia de identidad a propósito, así que no fija un token
// global: cada llamada dice con cuál va, y sin token significa sin token.
const { entrarComoAdministrador, usarToken } = require("./sesion");

// Batería del asistente ligado a la cuenta: quien ya compró no vuelve a
// escribir su documento, y nadie lee las boletas de otra persona.
const BASE = "http://localhost:3000";

const resultados = [];
let grupoActual = "";
const grupo = (nombre) => {
  grupoActual = nombre;
};

// El token de la petición: null para probar el acceso sin credenciales.
let tokenActual = null;

const pedir = async (metodo, ruta, cuerpo, token = tokenActual) => {
  const opciones = { method: metodo, headers: {} };
  if (cuerpo !== undefined) {
    opciones.headers["Content-Type"] = "application/json";
    opciones.body = JSON.stringify(cuerpo);
  }
  if (token) opciones.headers.Authorization = `Bearer ${token}`;

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
    detalle = `esperaba ${esperado}, recibió ${estado}${
      datos && datos.mensaje ? ` (${datos.mensaje})` : ""
    }`;
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

// ========================================
// Cuentas de prueba
// Los usuarios viven en memoria: cada corrida crea las suyas
// ========================================
const sello = Date.now();

const crearCuenta = async (etiqueta) => {
  const email = `${etiqueta}${sello}@teatro.com`;
  await pedir("POST", "/api/auth/registro", {
    nombre: `Cuenta ${etiqueta}`,
    email,
    password: "ClaveSegura2026!"
  }, null);
  const { datos } = await pedir("POST", "/api/auth/login", {
    email,
    password: "ClaveSegura2026!"
  }, null);
  return { token: datos.token, usuario: datos.usuario };
};

const datosDe = (etiqueta, documento) => ({
  nombre: `Persona ${etiqueta}`,
  documento,
  email: `persona${documento}@teatro.com`,
  telefono: "3145566778",
  fechaNacimiento: "1994-07-19"
});

const principal = async () => {
  // Las tres últimas comprobaciones tocan rutas que ahora son de
  // administrador; el resto va con el token de cada cuenta.
  const tokenAdministrador = await entrarComoAdministrador();
  usarToken(null);

  const primera = await crearCuenta("primera");
  const segunda = await crearCuenta("segunda");
  const tercera = await crearCuenta("tercera");
  const documentoA = String(sello).slice(-9) + "1";
  const documentoB = String(sello).slice(-9) + "2";

  // ========================================
  // Sin token
  // ========================================
  grupo("Sin token");
  tokenActual = null;

  await comprobar(
    "Mi asistente exige token",
    "GET",
    "/api/asistentes/mio",
    undefined,
    401,
    (d) =>
      d.mensaje === "Token de autenticación requerido"
        ? null
        : "mensaje inesperado"
  );
  await comprobar(
    "Crear mi asistente exige token",
    "POST",
    "/api/asistentes/mio",
    datosDe("sin token", documentoA),
    401
  );
  await comprobar("Mis boletas exige token", "GET", "/api/boletas/mias", undefined, 401);

  tokenActual = "no.es.un.token";
  await comprobar(
    "Token inventado",
    "GET",
    "/api/asistentes/mio",
    undefined,
    401,
    (d) => (d.mensaje === "Token inválido" ? null : "mensaje inesperado")
  );

  // ========================================
  // Cuenta sin datos de asistente
  // ========================================
  grupo("Cuenta nueva");
  tokenActual = primera.token;

  await comprobar(
    "Todavía no tiene asistente",
    "GET",
    "/api/asistentes/mio",
    undefined,
    404,
    (d) =>
      d.mensaje === "Tu cuenta todavía no tiene datos de asistente"
        ? null
        : "mensaje inesperado"
  );
  // Desde el 6C una cuenta sin datos de asistente no recibe una lista vacía
  // sino un 403: la ruta pide una condición que esa cuenta todavía no cumple.
  await comprobar(
    "Sin asistente, no llega a sus boletas",
    "GET",
    "/api/boletas/mias",
    undefined,
    403,
    (d) =>
      d.mensaje === "El usuario no tiene un asistente asociado"
        ? null
        : "mensaje inesperado"
  );

  // ========================================
  // Ligar los datos a la cuenta
  // ========================================
  grupo("Vínculo con la cuenta");

  const creado = await comprobar(
    "Crea el asistente y lo liga al usuario del token",
    "POST",
    "/api/asistentes/mio",
    datosDe("primera", documentoA),
    201,
    (d) =>
      d.asistente.usuarioId === primera.usuario.id
        ? null
        : `usuarioId ${d.asistente.usuarioId}, esperaba ${primera.usuario.id}`
  );

  await comprobar(
    "Ahora sí lo encuentra por el token",
    "GET",
    "/api/asistentes/mio",
    undefined,
    200,
    (d) =>
      d.id === creado.asistente.id && d.documento === documentoA
        ? null
        : "devolvió otro asistente"
  );

  await comprobar(
    "Una cuenta no puede tener dos asistentes",
    "POST",
    "/api/asistentes/mio",
    datosDe("primera otra vez", documentoB),
    409,
    (d) =>
      d.mensaje === "Tu cuenta ya tiene datos de asistente"
        ? null
        : "mensaje inesperado"
  );

  // ========================================
  // Mass Assignment
  // usuarioId lo pone el servidor, no el cuerpo
  // ========================================
  grupo("Mass Assignment");
  tokenActual = segunda.token;

  // Desde el 6C el usuarioId sí está declarado en el validador, así que ya no
  // se descarta en silencio: llega al controlador y se rechaza con 403. El
  // campo id sigue sin declararse y lo descarta matchedData.
  await comprobar(
    "Rechaza el usuarioId enviado por el cliente",
    "POST",
    "/api/asistentes/mio",
    { ...datosDe("segunda", documentoB), usuarioId: 9999 },
    403,
    (d) =>
      d.mensaje === "Solo un administrador puede asociar un asistente a una cuenta"
        ? null
        : "mensaje inesperado"
  );

  await comprobar(
    "Descarta el id enviado y liga el asistente al usuario del token",
    "POST",
    "/api/asistentes/mio",
    { ...datosDe("segunda", documentoB), id: 777 },
    201,
    (d) => {
      if (d.asistente.usuarioId !== segunda.usuario.id) {
        return `usuarioId ${d.asistente.usuarioId}, esperaba ${segunda.usuario.id}`;
      }
      return d.asistente.id !== 777 ? null : "aceptó el id enviado";
    }
  );

  // ========================================
  // Aislamiento entre cuentas
  // ========================================
  grupo("Aislamiento");

  // Una cuenta limpia que intenta apropiarse del documento de otra persona.
  tokenActual = tercera.token;
  await comprobar(
    "No se puede reclamar el documento de otra persona",
    "POST",
    "/api/asistentes/mio",
    datosDe("tercera", documentoA),
    409,
    (d) =>
      d.mensaje === "Ese documento ya está registrado en el teatro"
        ? null
        : "mensaje inesperado"
  );
  await comprobar(
    "Y tras el rechazo su cuenta sigue sin asistente",
    "GET",
    "/api/asistentes/mio",
    undefined,
    404
  );

  // La primera cuenta compra una boleta; la segunda no debe verla.
  tokenActual = primera.token;

  // La butaca sale de la ocupación real, para que la batería se pueda repetir
  // sobre el mismo servidor sin chocar con lo que compró la corrida anterior.
  const { datos: ocupadas } = await pedir("GET", "/api/funciones/1/ocupacion");
  const tomadas = new Set(
    ocupadas.map((b) => `${b.localidadId}-${b.fila}-${b.numero}`)
  );
  let butacaLibre = null;
  for (let fila = 1; fila <= 5 && !butacaLibre; fila += 1) {
    for (let numero = 1; numero <= 20 && !butacaLibre; numero += 1) {
      if (!tomadas.has(`1-${fila}-${numero}`)) butacaLibre = { fila, numero };
    }
  }

  const boleta = await comprobar(
    "La primera cuenta compra una boleta",
    "POST",
    "/api/boletas",
    {
      asistenteId: creado.asistente.id,
      funcionId: 1,
      localidadId: 1,
      fila: butacaLibre.fila,
      numero: butacaLibre.numero
    },
    201
  );

  await comprobar(
    "Sus boletas incluyen la recién comprada",
    "GET",
    "/api/boletas/mias",
    undefined,
    200,
    (d) =>
      d.length === 1 && d[0].codigo === boleta.boleta.codigo
        ? null
        : `devolvió ${d.length} boletas`
  );

  tokenActual = segunda.token;
  await comprobar(
    "La otra cuenta no ve esa boleta",
    "GET",
    "/api/boletas/mias",
    undefined,
    200,
    (d) => (Array.isArray(d) && d.length === 0 ? null : "vio boletas ajenas")
  );

  // ========================================
  // El vínculo sobrevive a las actualizaciones
  // ========================================
  grupo("Actualizaciones");
  // El asistente vuelve a editarse a sí mismo, ahora por PATCH /mio: sin id en
  // la dirección, con la identidad resuelta desde el token. PUT y PATCH por id
  // siguen siendo del administrador.
  tokenActual = primera.token;

  await comprobar(
    "El asistente edita su propio perfil y conserva el usuarioId",
    "PATCH",
    "/api/asistentes/mio",
    { telefono: "3005556677" },
    200,
    (d) =>
      d.asistente.telefono === "3005556677" &&
      d.asistente.usuarioId === primera.usuario.id
        ? null
        : "el PATCH propio perdió el teléfono o el vínculo"
  );

  await comprobar(
    "Por su propio perfil no puede reasignarse a otra cuenta",
    "PATCH",
    "/api/asistentes/mio",
    { usuarioId: segunda.usuario.id },
    403
  );

  await comprobar(
    "Y sigue sin poder editar a otra persona por su id",
    "PATCH",
    `/api/asistentes/${creado.asistente.id}`,
    { telefono: "3001112233" },
    403
  );

  tokenActual = tokenAdministrador;

  await comprobar(
    "El PUT conserva el usuarioId",
    "PUT",
    `/api/asistentes/${creado.asistente.id}`,
    datosDe("primera editada", documentoA),
    200,
    (d) =>
      d.asistente.usuarioId === primera.usuario.id
        ? null
        : "el PUT borró el vínculo con la cuenta"
  );

  await comprobar(
    "El PATCH conserva el usuarioId",
    "PATCH",
    `/api/asistentes/${creado.asistente.id}`,
    { telefono: "3001112233" },
    200,
    (d) =>
      d.asistente.usuarioId === primera.usuario.id
        ? null
        : "el PATCH borró el vínculo con la cuenta"
  );

  await comprobar(
    "Los asistentes de la semilla no pertenecen a ninguna cuenta",
    "GET",
    "/api/asistentes/1",
    undefined,
    200,
    (d) => (d.usuarioId === null ? null : "el asistente 1 tiene usuarioId")
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
      console.log(
        "== " + grupoImpreso + " " + "=".repeat(Math.max(3, 58 - grupoImpreso.length))
      );
    }
    const marca = r.ok ? "OK  " : "FALLA";
    const ruta = (r.metodo + " " + r.ruta).padEnd(34);
    console.log(
      `  ${marca} ${ruta} ${String(r.recibido).padEnd(4)} ${r.descripcion.padEnd(
        anchoDesc
      )}${r.detalle ? "  <-- " + r.detalle : ""}`
    );
  }

  const fallos = resultados.filter((r) => !r.ok);
  console.log("");
  console.log(
    `Total: ${resultados.length} pruebas | Correctas: ${
      resultados.length - fallos.length
    } | Fallidas: ${fallos.length}`
  );
  process.exit(fallos.length > 0 ? 1 : 0);
};

principal().catch((error) => {
  console.error("Error ejecutando las pruebas:", error);
  process.exit(1);
});
