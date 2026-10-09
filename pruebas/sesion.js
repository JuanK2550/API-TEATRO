// ========================================
// Sesión compartida por las baterías
// Pone la API Key en cada petición y, cuando hace falta, el token
// ========================================
// Desde el bloque 6 las escrituras exigen un JWT de administrador. Las
// credenciales salen del .env, nunca del código: aquí solo se leen, igual que
// la API Key, y no se imprimen en ninguna salida.
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const BASE = "http://localhost:3000";
const CLAVE_API = process.env.API_KEY_POSTMAN;

// El token que se añadirá a las peticiones que no traigan uno propio.
let tokenActual = null;

const fetchOriginal = globalThis.fetch;

globalThis.fetch = (url, opciones = {}) => {
  const cabeceras = { ...(opciones.headers || {}), "X-API-Key": CLAVE_API };

  // Si quien llama puso su propia Authorization, manda la suya: así una
  // batería puede probar "sin token" o "con el token de otro rol".
  if (tokenActual && !cabeceras.Authorization) {
    cabeceras.Authorization = `Bearer ${tokenActual}`;
  }

  return fetchOriginal(url, { ...opciones, headers: cabeceras });
};

// ========================================
// Entrar como el administrador inicial
// ========================================
const entrarComoAdministrador = async () => {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "Faltan ADMIN_EMAIL o ADMIN_PASSWORD en el .env: las pruebas de escritura necesitan el administrador inicial"
    );
  }

  const respuesta = await fetchOriginal(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "X-API-Key": CLAVE_API, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  if (!respuesta.ok) {
    throw new Error(
      `No se pudo entrar como administrador (${respuesta.status}). Revisa ADMIN_EMAIL y ADMIN_PASSWORD en el .env.`
    );
  }

  const datos = await respuesta.json();
  tokenActual = datos.token;

  return datos.token;
};

// ========================================
// Cambiar de identidad durante una batería
// ========================================
const usarToken = (token) => {
  tokenActual = token || null;
};

const tokenDeAdministrador = () => tokenActual;

// ========================================
// Pedir sin credencial alguna
// Para probar la puerta: ni API Key ni token
// ========================================
const pedirSinCredenciales = (url, opciones = {}) => fetchOriginal(url, opciones);

module.exports = {
  BASE,
  CLAVE_API,
  entrarComoAdministrador,
  usarToken,
  tokenDeAdministrador,
  pedirSinCredenciales
};
