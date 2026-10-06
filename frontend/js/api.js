// ========================================
// Cliente de la API
// La API Key identifica a la aplicación; el JWT, a la persona
// ========================================
// La clave llega del servidor en /sala/config.js, leída del .env al arrancar.
// Nunca se escribe en el repositorio. En un navegador no es secreta: quien abra
// las herramientas del navegador la ve. Lo que protege de verdad es el JWT, el
// límite de peticiones y poder revocar este cliente desde apiKeys.js.
const config = window.TEATRO_CONFIG || {};
const BASE = config.api || "/api";

// La sesión vive solo en memoria. Por eso la Sala es una sola página con vistas:
// si cada pantalla fuera un HTML aparte, cada salto borraría el token.
const sesion = {
  token: null,
  usuario: null,
  // El asistente que compra también vive solo en memoria: lleva documento,
  // teléfono y fecha de nacimiento, que no tienen por qué quedarse guardados.
  asistente: null
};

const oyentes = new Set();

const avisarCambio = () => oyentes.forEach((f) => f(sesion.usuario));

export const alCambiarSesion = (f) => {
  oyentes.add(f);
  f(sesion.usuario);
};

// ========================================
// Error con el código y el mensaje de la API
// ========================================
export class ErrorApi extends Error {
  constructor(status, cuerpo) {
    super((cuerpo && cuerpo.mensaje) || `La API respondió ${status}`);
    this.name = "ErrorApi";
    this.status = status;
    this.errores = (cuerpo && cuerpo.errores) || [];
    this.tokenExpirado = cuerpo && cuerpo.mensaje === "Token expirado";
  }
}

// ========================================
// Petición
// ========================================
const pedir = async (ruta, opciones = {}) => {
  const cabeceras = {
    "X-API-Key": config.apiKey || "",
    ...(opciones.cuerpo ? { "Content-Type": "application/json" } : {}),
    ...(sesion.token ? { Authorization: `Bearer ${sesion.token}` } : {})
  };

  const respuesta = await fetch(BASE + ruta, {
    method: opciones.metodo || "GET",
    headers: cabeceras,
    body: opciones.cuerpo ? JSON.stringify(opciones.cuerpo) : undefined
  });

  let cuerpo = null;
  try {
    cuerpo = await respuesta.json();
  } catch {
    cuerpo = null;
  }

  if (!respuesta.ok) {
    const error = new ErrorApi(respuesta.status, cuerpo);
    if (error.tokenExpirado) cerrarSesion();
    throw error;
  }

  return cuerpo;
};

// ========================================
// Memoria de la sesión
// Evita repetir peticiones: el límite es de 100 cada 15 minutos
// ========================================
const guardadas = new Map();

const pedirUnaVez = async (clave, cargar) => {
  if (!guardadas.has(clave)) guardadas.set(clave, cargar());
  try {
    return await guardadas.get(clave);
  } catch (error) {
    guardadas.delete(clave);
    throw error;
  }
};

export const olvidarCache = (clave) => {
  if (clave) guardadas.delete(clave);
  else guardadas.clear();
};

// ========================================
// Marca de sesión
// Recuerda que hubo sesión, nunca el token
// ========================================
// Es un "sí" y nada más: sirve para explicar, después de una recarga, por qué
// la Sala pide entrar de nuevo. El token y el asistente nunca se guardan.
const MARCA = "hubo-sesion";

const marcar = (valor) => {
  try {
    if (valor) sessionStorage.setItem(MARCA, "si");
    else sessionStorage.removeItem(MARCA);
  } catch {
    // En modo privado el almacenamiento puede fallar: la Sala sigue igual.
  }
};

export const huboSesion = () => {
  try {
    return sessionStorage.getItem(MARCA) === "si";
  } catch {
    return false;
  }
};

// ========================================
// Sesión
// ========================================
export const registrar = (datos) =>
  pedir("/auth/registro", { metodo: "POST", cuerpo: datos });

export const entrar = async (email, password) => {
  const datos = await pedir("/auth/login", {
    metodo: "POST",
    cuerpo: { email, password }
  });

  sesion.token = datos.token;
  sesion.usuario = datos.usuario;
  marcar(true);
  avisarCambio();

  return datos.usuario;
};

export const cerrarSesion = () => {
  sesion.token = null;
  sesion.usuario = null;
  sesion.asistente = null;
  marcar(false);
  avisarCambio();
};

export const usuarioActual = () => sesion.usuario;

export const asistenteActual = () => sesion.asistente;

// Quién está autenticado, según el servidor
export const perfil = () => pedir("/auth/perfil");

// ========================================
// Recursos
// ========================================
export const eventos = () => pedirUnaVez("eventos", () => pedir("/eventos"));
export const funciones = () => pedirUnaVez("funciones", () => pedir("/funciones"));
export const localidades = () =>
  pedirUnaVez("localidades", () => pedir("/localidades"));

export const evento = async (id) =>
  (await eventos()).find((e) => e.id === Number(id)) || pedir(`/eventos/${id}`);

export const funcion = async (id) =>
  (await funciones()).find((f) => f.id === Number(id)) || pedir(`/funciones/${id}`);

export const funcionesDeEvento = async (eventoId) =>
  (await funciones()).filter((f) => f.eventoId === Number(eventoId));

export const tarifas = (id) =>
  pedirUnaVez(`tarifas-${id}`, () => pedir(`/funciones/${id}/tarifas`));

// La ocupación nunca se guarda en caché: entre que se pinta el plano y se
// confirma, otra persona pudo tomar la butaca.
export const ocupacion = (id) => pedir(`/funciones/${id}/ocupacion`);

// ========================================
// El asistente de la cuenta
// Lo resuelve el servidor desde el token, no un id de la dirección
// ========================================
// Por eso la Sala nunca pregunta si un documento existe: quien ya compró entra
// con su cuenta y el servidor sabe quién es. Devuelve null la primera vez.
export const miAsistente = async () => {
  try {
    const asistente = await pedir("/asistentes/mio");
    sesion.asistente = asistente;
    return asistente;
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
};

export const crearMiAsistente = async (datos) => {
  const respuesta = await pedir("/asistentes/mio", {
    metodo: "POST",
    cuerpo: datos
  });
  sesion.asistente = respuesta.asistente;
  return respuesta.asistente;
};

export const misBoletas = () => pedir("/boletas/mias");

// El cliente nunca manda precio, codigo ni estado: los pone el servidor.
export const venderBoleta = (datos) =>
  pedir("/boletas", { metodo: "POST", cuerpo: datos });

export const boleta = (id) => pedir(`/boletas/${id}`);

export const cambiarEstadoBoleta = (id, estado) =>
  pedir(`/boletas/${id}/estado`, { metodo: "PATCH", cuerpo: { estado } });
