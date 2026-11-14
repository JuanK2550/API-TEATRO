// ========================================
// Variables de entorno
// ========================================
require("dotenv").config();

// ========================================
// Importaciones
// ========================================
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const {
  rutaNoEncontrada,
  manejarError
} = require("./middlewares/errores.middleware");

const validarApiKey = require("./middlewares/apiKey.middleware");
const { rechazarCaracterNulo } = require("./middlewares/entrada.middleware");

const asistentesRoutes = require("./routes/asistentes.routes");
const eventosRoutes = require("./routes/eventos.routes");
const localidadesRoutes = require("./routes/localidades.routes");
const funcionesRoutes = require("./routes/funciones.routes");
const boletasRoutes = require("./routes/boletas.routes");
const seguridadRoutes = require("./routes/seguridad.routes");
const authRoutes = require("./routes/auth.routes");
const usuariosRoutes = require("./routes/usuarios.routes");
const estadisticasRoutes = require("./routes/estadisticas.routes");

const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./docs/swagger");


// ========================================
// Configuración base
// El máximo de peticiones se ajusta con RATE_LIMIT_MAX
// ========================================
const app = express();
const PUERTO = process.env.PORT || 3000;
// ALLOWED_ORIGIN admite varios orígenes separados por comas. La interfaz es el
// panel en React (teatro-frontend), que corre en otro origen: en desarrollo,
// http://localhost:5173. Lo que no se nombra aquí, no entra.
const ORIGENES_PERMITIDOS = (process.env.ALLOWED_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origen) => origen.trim())
  .filter(Boolean);
const MAXIMO_PETICIONES = Number(process.env.RATE_LIMIT_MAX) || 100;

app.disable("x-powered-by");

// ========================================
// Middlewares de seguridad
// Cabeceras de helmet y CORS restringido a los orígenes declarados
// ========================================
app.use(helmet());

app.use(
  cors({
    // Sin cabecera Origin la petición no viene de un navegador —curl, Postman,
    // las propias pruebas— y CORS no pinta nada ahí: no es una protección del
    // servidor, es una regla que el navegador aplica en nombre del usuario.
    // Un origen ajeno recibe la respuesta sin Access-Control-Allow-Origin y su
    // navegador no la deja leer. No es un error del servidor: rechazarlo con
    // un Error lo convertía en un 500 y en una línea de console.error.
    origin: (origen, continuar) =>
      continuar(null, !origen || ORIGENES_PERMITIDOS.includes(origen)),
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"]
  })
);

// ========================================
// Middlewares de parseo
// ========================================
app.use(express.json({ limit: "10kb" }));
app.use(rechazarCaracterNulo);

// ========================================
// Límite de peticiones
// 100 peticiones por IP cada 15 minutos, solo sobre /api
// ========================================
const limitador = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: MAXIMO_PETICIONES,
  standardHeaders: true,
  legacyHeaders: false,
  message: { mensaje: "Demasiadas peticiones, intente de nuevo más tarde" }
});

app.use("/api", limitador);

// ========================================
// Quién exige API Key y quién no
// ========================================
// Hasta el bloque 11 la exigía todo /api, y por eso la interfaz de entonces
// recibía la clave desde el servidor. Una clave servida a un navegador no es
// un secreto: cualquiera la lee en el inspector. Lo que de verdad identifica
// a la persona es el JWT, y lo que protege las lecturas públicas es que no
// haya nada privado en ellas.
//
// Así que la API Key se queda donde sí significa algo: en las integraciones
// que no tienen sesión y no son un navegador.

// Recursos cuyo router ya decide qué es público y qué exige JWT.
const RECURSOS = new Set([
  "/asistentes",
  "/boletas",
  "/eventos",
  "/funciones",
  "/localidades",
  "/usuarios",
  "/estadisticas"
]);

// Rutas de autenticación que se resuelven con JWT, sin API Key.
const AUTH_CON_SESION = new Set([
  "/auth/perfil",
  "/auth/cambiar-password",
  "/auth/recuperacion",
  "/auth/codigos-recuperacion"
]);

// Públicas: quien entra o se registra todavía no tiene nada, y quien restablece
// perdió el acceso. Las dos últimas las protege el propio secreto de un solo uso.
const AUTH_PUBLICAS = new Set([
  "/auth/login",
  "/auth/registro",
  "/auth/restablecer-password",
  "/auth/restablecer-con-codigo"
]);

app.use("/api", (req, res, next) => {
  if (req.method === "POST" && AUTH_PUBLICAS.has(req.path)) return next();

  const recurso = "/" + req.path.split("/")[1];
  if (RECURSOS.has(recurso)) return next();

  const rutaAuth = "/" + req.path.split("/").slice(1, 3).join("/");
  if (AUTH_CON_SESION.has(rutaAuth)) return next();

  // Lo que queda es /seguridad/cliente: una integración sin sesión.
  return validarApiKey(req, res, next);
});

// ========================================
// Ruta raíz
// ========================================
app.get("/", (req, res) => {
  res.status(200).json({ mensaje: "API Teatro funcionando" });
});

// ========================================
// Routers de los recursos
// ========================================
app.use("/api/asistentes", asistentesRoutes);
app.use("/api/eventos", eventosRoutes);
app.use("/api/localidades", localidadesRoutes);
app.use("/api/funciones", funcionesRoutes);
app.use("/api/boletas", boletasRoutes);
app.use("/api/seguridad", seguridadRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/usuarios", usuariosRoutes);
app.use("/api/estadisticas", estadisticasRoutes);

// ========================================
// Documentación
// Interfaz navegable y el spec en crudo
// ========================================
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get("/openapi.json", (req, res) => {
  res.status(200).json(swaggerSpec);
});

// ========================================
// Manejo de errores
// Siempre los últimos middlewares registrados
// ========================================
app.use(rutaNoEncontrada);
app.use(manejarError);

// ========================================
// Arranque del servidor
// Solo abre el puerto: no crea ni toca ninguna cuenta
// ========================================
app.listen(PUERTO, () => {
  console.log(`Servidor escuchando en http://localhost:${PUERTO}`);
  console.log(`Swagger UI: http://localhost:${PUERTO}/api-docs`);
  console.log(`OpenAPI JSON: http://localhost:${PUERTO}/openapi.json`);
});

module.exports = app;
