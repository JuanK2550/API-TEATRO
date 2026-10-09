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
  // Crear usuarios administrativos
  // ========================================
  grupo("Usuarios administrativos");

  const correoTaquilla = `taquilla${marca}@teatro.com`;
  const CLAVE_NUEVA = "Clave-Larga-Taquilla-2026";

  const taquillaCreada = await comprobar(
    "El administrador crea una cuenta de taquilla",
    "POST",
    "/api/usuarios",
    {
      nombre: "Taquilla de prueba",
      email: correoTaquilla,
      password: CLAVE_NUEVA,
      rol: "taquilla"
    },
    tokenAdministrador,
    201,
    (d) => {
      if (!d || !d.usuario) return "la respuesta no trae el usuario";
      if (d.usuario.rol !== "taquilla") return `el rol es ${d.usuario.rol}`;
      if (d.usuario.activo !== true) return "no nació activa";
      if ("passwordHash" in d.usuario) return "la respuesta incluye el passwordHash";
      return null;
    }
  );

  const entradaTaquilla = await comprobar(
    "Esa taquilla puede entrar y su token lleva el rol taquilla",
    "POST",
    "/api/auth/login",
    { email: correoTaquilla, password: CLAVE_NUEVA },
    null,
    200,
    (d) =>
      d && d.token && rolDelToken(d.token) === "taquilla"
        ? null
        : `el rol del token es ${d && d.token && rolDelToken(d.token)}`
  );
  const tokenTaquilla = entradaTaquilla && entradaTaquilla.token;

  await comprobar(
    "El administrador crea otro administrador",
    "POST",
    "/api/usuarios",
    {
      nombre: "Segundo administrador",
      email: `administrador${marca}@teatro.com`,
      password: "Clave-Larga-Administrador-2026",
      rol: "administrador"
    },
    tokenAdministrador,
    201,
    (d) =>
      d && d.usuario && d.usuario.rol === "administrador"
        ? null
        : `el rol es ${d && d.usuario && d.usuario.rol}`
  );

  await comprobar(
    "La taquilla no crea usuarios",
    "POST",
    "/api/usuarios",
    {
      nombre: "Taquilla creada por taquilla",
      email: `nadie${marca}@teatro.com`,
      password: "Clave-Larga-Nadie-2026",
      rol: "taquilla"
    },
    tokenTaquilla,
    403,
    (d) =>
      d && d.mensaje === MENSAJE_403
        ? null
        : `el mensaje del 403 es "${d && d.mensaje}"`
  );

  await comprobar(
    "Un asistente no se asciende a administrador",
    "POST",
    "/api/usuarios",
    {
      nombre: "Asistente ambicioso",
      email: `ambicioso${marca}@teatro.com`,
      password: "Clave-Larga-Ambicioso-2026",
      rol: "administrador"
    },
    tokenAsistente,
    403
  );

  await comprobar(
    "Crear un usuario sin token es 401",
    "POST",
    "/api/usuarios",
    {
      nombre: "Sin credenciales",
      email: `sintoken${marca}@teatro.com`,
      password: "Clave-Larga-Sin-Token-2026",
      rol: "taquilla"
    },
    null,
    401
  );

  // ========================================
  // La lista blanca del rol
  // ========================================
  grupo("Lista blanca del rol");

  for (const rolInvalido of ["superadmin", "asistente", "ADMINISTRADOR", ""]) {
    await comprobar(
      `El rol "${rolInvalido}" se rechaza con 400`,
      "POST",
      "/api/usuarios",
      {
        nombre: "Rol fuera de la lista",
        email: `rol${rolInvalido || "vacio"}${marca}@teatro.com`,
        password: "Clave-Larga-Rol-2026",
        rol: rolInvalido
      },
      tokenAdministrador,
      400
    );
  }

  await comprobar(
    "Sin rol en el cuerpo también es 400",
    "POST",
    "/api/usuarios",
    {
      nombre: "Sin rol",
      email: `sinrol${marca}@teatro.com`,
      password: "Clave-Larga-Sin-Rol-2026"
    },
    tokenAdministrador,
    400
  );

  // ========================================
  // Mass Assignment en la creación de usuarios
  // ========================================
  grupo("Mass Assignment");

  const correoColado = `colado${marca}@teatro.com`;
  const CLAVE_COLADO = "Clave-Larga-Colado-2026";

  const colado = await comprobar(
    "Los campos del servidor se descartan aunque lleguen en el cuerpo",
    "POST",
    "/api/usuarios",
    {
      nombre: "Usuario con campos colados",
      email: correoColado,
      password: CLAVE_COLADO,
      rol: "taquilla",
      id: 9999,
      activo: false,
      passwordHash: "hash-falso",
      esSuperAdmin: true
    },
    tokenAdministrador,
    201,
    (d) => {
      const u = d && d.usuario;
      if (!u) return "la respuesta no trae el usuario";
      if (u.id === 9999) return "el id lo fijó el cliente";
      if (u.activo !== true) return "el cliente consiguió crearlo inactivo";
      if ("passwordHash" in u) return "la respuesta incluye el passwordHash";
      if ("esSuperAdmin" in u) return "el campo inventado llegó a los datos";
      if (u.rol !== "taquilla") return `el rol es ${u.rol}`;
      return null;
    }
  );

  afirmar(
    "El id del usuario colado lo puso el servidor",
    colado && colado.usuario && typeof colado.usuario.id === "number"
      ? null
      : "no se obtuvo un id numérico"
  );

  await comprobar(
    "El hash falso no sustituyó a la contraseña real: el login funciona",
    "POST",
    "/api/auth/login",
    { email: correoColado, password: CLAVE_COLADO },
    null,
    200,
    (d) =>
      d && d.token && rolDelToken(d.token) === "taquilla"
        ? null
        : "no se pudo entrar con la contraseña real"
  );

  await comprobar(
    "El hash falso tampoco sirve como contraseña",
    "POST",
    "/api/auth/login",
    { email: correoColado, password: "hash-falso" },
    null,
    401
  );

  // Si el id 9999 hubiera entrado, el siguiente usuario sería el 10000:
  // los ids se generan como el mayor existente más uno. Es la prueba de caja
  // negra de que el id del cuerpo se descartó de verdad, y no solo que la
  // respuesta no lo mostraba.
  const siguiente = await comprobar(
    "El id colado no desplazó el contador: el siguiente usuario sigue la serie",
    "POST",
    "/api/usuarios",
    {
      nombre: "Usuario siguiente",
      email: `siguiente${marca}@teatro.com`,
      password: "Clave-Larga-Siguiente-2026",
      rol: "taquilla"
    },
    tokenAdministrador,
    201,
    (d) => {
      const esperado = colado && colado.usuario && colado.usuario.id + 1;
      return d && d.usuario && d.usuario.id === esperado
        ? null
        : `esperaba el id ${esperado}, recibió ${d && d.usuario && d.usuario.id}`;
    }
  );

  afirmar(
    "Ese id está muy lejos del 9999 que mandó el cliente",
    siguiente && siguiente.usuario && siguiente.usuario.id < 100
      ? null
      : `el id es ${siguiente && siguiente.usuario && siguiente.usuario.id}`
  );

  // ========================================
  // Unicidad del correo
  // ========================================
  grupo("Unicidad del correo");

  await comprobar(
    "Un correo ya registrado es 409",
    "POST",
    "/api/usuarios",
    {
      nombre: "Taquilla repetida",
      email: correoTaquilla,
      password: "Clave-Larga-Repetida-2026",
      rol: "taquilla"
    },
    tokenAdministrador,
    409
  );

  await comprobar(
    "Da igual si el correo se repite en mayúsculas",
    "POST",
    "/api/usuarios",
    {
      nombre: "Taquilla repetida en mayúsculas",
      email: correoTaquilla.toUpperCase(),
      password: "Clave-Larga-Repetida-2026",
      rol: "taquilla"
    },
    tokenAdministrador,
    409
  );

  afirmar(
    "La cuenta de taquilla original sigue existiendo tras los 409",
    taquillaCreada && taquillaCreada.usuario ? null : "no se creó la taquilla"
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
