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
const SIN_ASISTENTE = "El usuario no tiene un asistente asociado";

// El rol viaja en la carga del JWT; aquí se lee sin verificar la firma,
// que es trabajo del servidor.
const rolDelToken = (token) => {
  try {
    return JSON.parse(Buffer.from(token.split(".")[1], "base64").toString()).rol;
  } catch {
    return null;
  }
};

// El id de la cuenta sale del claim sub, que es donde lo pone generarToken.
const idDelToken = (token) => {
  try {
    return JSON.parse(Buffer.from(token.split(".")[1], "base64").toString()).sub;
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

  // Desde el bloque 6C una cuenta sin datos de asistente no recibe una lista
  // vacía sino un 403: la ruta pide una condición que esa cuenta no cumple.
  // El caso con perfil y respuesta 200 lo cubren A y B más abajo.
  await comprobar(
    "Una cuenta de asistente sin perfil no llega a sus boletas",
    "GET",
    "/api/boletas/mias",
    undefined,
    tokenAsistente,
    403,
    (d) =>
      d && d.mensaje === SIN_ASISTENTE ? null : `el mensaje es "${d && d.mensaje}"`
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
  // Dos asistentes con boletas propias
  // ========================================
  // Es el montaje del IDOR: A y B compran, y después cada uno intenta leer y
  // tocar lo del otro. Sin esto no hay nada que probar.
  grupo("Montaje de A y B");

  const cuentaDeAsistente = async (etiqueta) => {
    const correo = `${etiqueta}${marca}@teatro.com`;
    const clave = `Clave-Larga-${etiqueta}-2026`;
    await pedir("POST", "/api/auth/registro", {
      nombre: `Asistente ${etiqueta}`,
      email: correo,
      password: clave
    });
    const entrada = await pedir("POST", "/api/auth/login", {
      email: correo,
      password: clave
    });
    return { correo, token: entrada.datos && entrada.datos.token };
  };

  const cuentaA = await cuentaDeAsistente("asistenteA");
  const cuentaB = await cuentaDeAsistente("asistenteB");

  // La función 1 tiene que estar en venta para poder comprar.
  await pedir(
    "PATCH",
    "/api/funciones/1/estado",
    { estado: "en_venta" },
    tokenAdministrador
  );

  const serie = `${marca}`.slice(-9);

  const perfilDe = async (cuenta, etiqueta, documento) => {
    const r = await pedir(
      "POST",
      "/api/asistentes/mio",
      {
        nombre: `Asistente ${etiqueta}`,
        documento,
        email: cuenta.correo,
        telefono: "3124567890",
        fechaNacimiento: "1995-03-14"
      },
      cuenta.token
    );
    return r.datos && r.datos.asistente;
  };

  const perfilA = await perfilDe(cuentaA, "A", serie + "1");
  const perfilB = await perfilDe(cuentaB, "B", serie + "2");

  afirmar(
    "A y B tienen perfiles de asistente distintos",
    perfilA && perfilB && perfilA.id !== perfilB.id
      ? null
      : "no se crearon los dos perfiles"
  );

  // Las dos compras mandan el asistenteId de A a propósito: la de B tiene que
  // acabar a nombre de B igualmente.
  const comprar = async (cuenta, fila, numero) => {
    const r = await pedir(
      "POST",
      "/api/boletas",
      {
        asistenteId: perfilA ? perfilA.id : 1,
        funcionId: 1,
        localidadId: 1,
        fila,
        numero,
        tipoDescuento: "ninguno"
      },
      cuenta.token
    );
    return r.datos && r.datos.boleta;
  };

  // La butaca sale de la marca de tiempo: así dos pasadas seguidas contra el
  // mismo servidor no se pelean por la misma silla.
  const butaca = (marca % 19) + 1;
  const boletaA = await comprar(cuentaA, 3, butaca);
  const boletaB = await comprar(cuentaB, 3, butaca + 1);

  afirmar(
    "Comprar a nombre de otro acaba a nombre propio: el asistenteId del cuerpo se ignora",
    boletaB && perfilB && boletaB.asistenteId === perfilB.id
      ? null
      : `la boleta de B salió a nombre del asistente ${boletaB && boletaB.asistenteId}, y B es el ${perfilB && perfilB.id}`
  );

  afirmar(
    "La boleta de A sí es de A",
    boletaA && perfilA && boletaA.asistenteId === perfilA.id
      ? null
      : "la boleta de A no quedó a su nombre"
  );

  // ========================================
  // IDOR por asistenteId
  // ========================================
  grupo("IDOR por asistenteId");

  await comprobar(
    "A lee sus propias boletas por su asistenteId",
    "GET",
    `/api/boletas/asistente/${perfilA && perfilA.id}`,
    undefined,
    cuentaA.token,
    200,
    (d) =>
      Array.isArray(d) && d.length > 0 && d.every((b) => b.asistenteId === perfilA.id)
        ? null
        : "devolvió boletas que no son de A"
  );

  await comprobar(
    "A NO lee las de B cambiando el número",
    "GET",
    `/api/boletas/asistente/${perfilB && perfilB.id}`,
    undefined,
    cuentaA.token,
    403
  );

  await comprobar(
    "B tampoco lee las de A",
    "GET",
    `/api/boletas/asistente/${perfilA && perfilA.id}`,
    undefined,
    cuentaB.token,
    403
  );

  await comprobar(
    "El administrador lee las de cualquiera",
    "GET",
    `/api/boletas/asistente/${perfilB && perfilB.id}`,
    undefined,
    tokenAdministrador,
    200
  );

  await comprobar(
    "La taquilla también: atiende a quien tiene delante",
    "GET",
    `/api/boletas/asistente/${perfilA && perfilA.id}`,
    undefined,
    tokenTaquilla,
    200
  );

  await comprobar(
    "Un asistente sin perfil recibe 403, no la lista de otro",
    "GET",
    `/api/boletas/asistente/${perfilA && perfilA.id}`,
    undefined,
    tokenAsistente,
    403,
    (d) =>
      d && d.mensaje === SIN_ASISTENTE ? null : `el mensaje es "${d && d.mensaje}"`
  );

  // 403 y no 404: si el código dependiera de que el id exista, la diferencia
  // entre las dos respuestas diría cuántos asistentes hay registrados.
  await comprobar(
    "Un asistenteId inexistente también es 403 para un asistente",
    "GET",
    "/api/boletas/asistente/9999",
    undefined,
    cuentaA.token,
    403
  );

  // ========================================
  // IDOR por id de boleta
  // ========================================
  grupo("IDOR por id de boleta");

  await comprobar(
    "A lee su propia boleta",
    "GET",
    `/api/boletas/${boletaA && boletaA.id}`,
    undefined,
    cuentaA.token,
    200,
    (d) => (d && d.id === boletaA.id ? null : "devolvió otra boleta")
  );

  await comprobar(
    "A NO lee la boleta de B",
    "GET",
    `/api/boletas/${boletaB && boletaB.id}`,
    undefined,
    cuentaA.token,
    403
  );

  await comprobar(
    "B NO lee la boleta de A",
    "GET",
    `/api/boletas/${boletaA && boletaA.id}`,
    undefined,
    cuentaB.token,
    403
  );

  await comprobar(
    "El administrador lee cualquier boleta",
    "GET",
    `/api/boletas/${boletaB && boletaB.id}`,
    undefined,
    tokenAdministrador,
    200
  );

  await comprobar(
    "La taquilla lee cualquier boleta",
    "GET",
    `/api/boletas/${boletaA && boletaA.id}`,
    undefined,
    tokenTaquilla,
    200
  );

  await comprobar(
    "Una boleta inexistente es 404",
    "GET",
    "/api/boletas/9999",
    undefined,
    tokenAdministrador,
    404
  );

  // ========================================
  // Listado completo de la boletería
  // ========================================
  grupo("Listado completo");

  await comprobar(
    "A no lista toda la boletería",
    "GET",
    "/api/boletas",
    undefined,
    cuentaA.token,
    403
  );

  await comprobar(
    "La taquilla tampoco: para eso están las consultas por asistente y por función",
    "GET",
    "/api/boletas",
    undefined,
    tokenTaquilla,
    403
  );

  await comprobar(
    "El administrador sí",
    "GET",
    "/api/boletas",
    undefined,
    tokenAdministrador,
    200
  );

  // ========================================
  // Las boletas de cada cual
  // ========================================
  grupo("Las boletas de cada cual");

  await comprobar(
    "A ve en /mias solo sus boletas",
    "GET",
    "/api/boletas/mias",
    undefined,
    cuentaA.token,
    200,
    (d) =>
      Array.isArray(d) && d.length > 0 && d.every((b) => b.asistenteId === perfilA.id)
        ? null
        : "devolvió boletas que no son de A"
  );

  await comprobar(
    "B ve en /mias solo las suyas",
    "GET",
    "/api/boletas/mias",
    undefined,
    cuentaB.token,
    200,
    (d) =>
      Array.isArray(d) && d.length > 0 && d.every((b) => b.asistenteId === perfilB.id)
        ? null
        : "devolvió boletas que no son de B"
  );

  await comprobar(
    "Un asistente sin perfil recibe 403 en /mias",
    "GET",
    "/api/boletas/mias",
    undefined,
    tokenAsistente,
    403,
    (d) =>
      d && d.mensaje === SIN_ASISTENTE ? null : `el mensaje es "${d && d.mensaje}"`
  );

  await comprobar(
    "El administrador no tiene /mias",
    "GET",
    "/api/boletas/mias",
    undefined,
    tokenAdministrador,
    403
  );

  await comprobar(
    "La taquilla tampoco",
    "GET",
    "/api/boletas/mias",
    undefined,
    tokenTaquilla,
    403
  );

  // ========================================
  // Estado de una boleta
  // ========================================
  grupo("Estado de una boleta");

  await comprobar(
    "A no toca el estado de la boleta de B",
    "PATCH",
    `/api/boletas/${boletaB && boletaB.id}/estado`,
    { estado: "cancelada" },
    cuentaA.token,
    403
  );

  await comprobar(
    "A no marca su propia boleta como usada: eso se hace en la puerta",
    "PATCH",
    `/api/boletas/${boletaA && boletaA.id}/estado`,
    { estado: "usada" },
    cuentaA.token,
    403,
    (d) =>
      d && /usada/.test(d.mensaje || "") ? null : `el mensaje es "${d && d.mensaje}"`
  );

  await comprobar(
    "A sí paga su propia boleta",
    "PATCH",
    `/api/boletas/${boletaA && boletaA.id}/estado`,
    { estado: "pagada" },
    cuentaA.token,
    200,
    (d) => (d && d.boleta && d.boleta.estado === "pagada" ? null : "no quedó pagada")
  );

  await comprobar(
    "Y la cancela",
    "PATCH",
    `/api/boletas/${boletaA && boletaA.id}/estado`,
    { estado: "cancelada" },
    cuentaA.token,
    200,
    (d) =>
      d && d.boleta && d.boleta.estado === "cancelada" ? null : "no quedó cancelada"
  );

  // El permiso no deroga la máquina de estados: cancelada es terminal, así que
  // ni su dueño la revive.
  await comprobar(
    "Una transición imposible es 409, aunque la boleta sea suya",
    "PATCH",
    `/api/boletas/${boletaA && boletaA.id}/estado`,
    { estado: "pagada" },
    cuentaA.token,
    409
  );

  // La taquilla pasa el control de rol y choca con la validación en la puerta:
  // 409 y no 403, que es la prueba de que son dos controles distintos.
  await comprobar(
    "La taquilla sí puede pedir usada, y entonces decide la máquina de estados",
    "PATCH",
    `/api/boletas/${boletaB && boletaB.id}/estado`,
    { estado: "usada" },
    tokenTaquilla,
    409
  );

  await comprobar(
    "Cambiar el estado de una boleta inexistente es 404",
    "PATCH",
    "/api/boletas/9999/estado",
    { estado: "cancelada" },
    tokenAdministrador,
    404
  );

  // ========================================
  // El perfil propio
  // ========================================
  grupo("Perfil propio");

  await comprobar(
    "A cambia su teléfono sin que haya ningún id en la dirección",
    "PATCH",
    "/api/asistentes/mio",
    { telefono: "3209876543" },
    cuentaA.token,
    200,
    (d) =>
      d && d.asistente && d.asistente.telefono === "3209876543"
        ? null
        : "no se guardó el teléfono"
  );

  await comprobar(
    "Al editarse, A conserva su vínculo con la cuenta",
    "GET",
    "/api/asistentes/mio",
    undefined,
    cuentaA.token,
    200,
    (d) =>
      d && d.id === perfilA.id && d.usuarioId !== null
        ? null
        : "perdió el usuarioId al editarse"
  );

  await comprobar(
    "A no se reasigna a otra cuenta por su propio perfil",
    "PATCH",
    "/api/asistentes/mio",
    { usuarioId: 1 },
    cuentaA.token,
    403
  );

  await comprobar(
    "Un PATCH propio sin ningún campo es 400",
    "PATCH",
    "/api/asistentes/mio",
    {},
    cuentaA.token,
    400
  );

  await comprobar(
    "El administrador no usa el perfil propio",
    "PATCH",
    "/api/asistentes/mio",
    { telefono: "3209876543" },
    tokenAdministrador,
    403
  );

  // ========================================
  // Asociación con una cuenta
  // ========================================
  grupo("Asociación con una cuenta");

  const suelto = await comprobar(
    "El administrador crea un asistente sin cuenta",
    "POST",
    "/api/asistentes",
    {
      nombre: "Asistente de mostrador",
      documento: serie + "3",
      email: `mostrador${marca}@correo.com`,
      telefono: "3124567890",
      fechaNacimiento: "1990-05-20"
    },
    tokenAdministrador,
    201,
    (d) =>
      d && d.asistente && d.asistente.usuarioId === null
        ? null
        : "nació con un vínculo que nadie pidió"
  );
  const idSuelto = suelto && suelto.asistente && suelto.asistente.id;

  await comprobar(
    "Un usuarioId que no existe es 400",
    "PATCH",
    `/api/asistentes/${idSuelto}`,
    { usuarioId: 99999 },
    tokenAdministrador,
    400,
    (d) =>
      d && d.mensaje === "El usuario asociado no existe"
        ? null
        : `el mensaje es "${d && d.mensaje}"`
  );

  await comprobar(
    "Asociar una cuenta que no es de asistente es 409",
    "PATCH",
    `/api/asistentes/${idSuelto}`,
    { usuarioId: 1 },
    tokenAdministrador,
    409
  );

  await comprobar(
    "Asociar una cuenta que ya tiene asistente es 409",
    "PATCH",
    `/api/asistentes/${idSuelto}`,
    { usuarioId: perfilA && perfilA.usuarioId },
    tokenAdministrador,
    409,
    (d) =>
      d && d.mensaje === "Ese usuario ya está asociado a otro asistente"
        ? null
        : `el mensaje es "${d && d.mensaje}"`
  );

  // La cuenta del grupo "Identidades" es la única de asistente sin perfil.
  const usuarioLibre = Number(idDelToken(tokenAsistente));

  await comprobar(
    "La taquilla no asocia un asistente a una cuenta",
    "PATCH",
    `/api/asistentes/${idSuelto}`,
    { usuarioId: usuarioLibre },
    tokenTaquilla,
    403,
    // Aquí el 403 lo pone autorizarRoles, porque PATCH /:id es solo del
    // administrador: la taquilla no llega al controlador. El mensaje propio
    // de la asociación se comprueba en el POST, donde la taquilla sí entra.
    (d) => (d && d.mensaje === MENSAJE_403 ? null : `el mensaje es "${d && d.mensaje}"`)
  );

  await comprobar(
    "La taquilla tampoco al crear el asistente",
    "POST",
    "/api/asistentes",
    {
      nombre: "Asistente con cuenta",
      documento: serie + "4",
      email: `concuenta${marca}@correo.com`,
      telefono: "3124567890",
      fechaNacimiento: "1990-05-20",
      usuarioId: usuarioLibre
    },
    tokenTaquilla,
    403,
    (d) =>
      d &&
      d.mensaje === "Solo un administrador puede asociar un asistente a una cuenta"
        ? null
        : `el mensaje es "${d && d.mensaje}"`
  );

  await comprobar(
    "El administrador sí asocia",
    "PATCH",
    `/api/asistentes/${idSuelto}`,
    { usuarioId: usuarioLibre },
    tokenAdministrador,
    200,
    (d) =>
      d && d.asistente && d.asistente.usuarioId === usuarioLibre
        ? null
        : "no se guardó el vínculo"
  );

  await comprobar(
    "Y desde ese momento esa cuenta ve ese perfil en /mio",
    "GET",
    "/api/asistentes/mio",
    undefined,
    tokenAsistente,
    200,
    (d) => (d && d.id === idSuelto ? null : "/mio devolvió otro perfil")
  );

  // ========================================
  // La puerta del 6C
  // ========================================
  grupo("La puerta del 6C");

  await comprobar(
    "Leer una boleta sin JWT es 401",
    "GET",
    `/api/boletas/${boletaA && boletaA.id}`,
    undefined,
    null,
    401
  );

  await comprobar(
    "Las boletas de un asistente sin JWT son 401",
    "GET",
    `/api/boletas/asistente/${perfilA && perfilA.id}`,
    undefined,
    null,
    401
  );

  const boletaSinClave = await pedirSinCredenciales(
    `${BASE}/api/boletas/${boletaA && boletaA.id}`
  );
  afirmar(
    "Leer una boleta sin X-API-Key es 401",
    boletaSinClave.status === 401 ? null : `respondió ${boletaSinClave.status}`
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
