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

const asistentesRoutes = require("./routes/asistentes.routes");
const eventosRoutes = require("./routes/eventos.routes");
const localidadesRoutes = require("./routes/localidades.routes");
const funcionesRoutes = require("./routes/funciones.routes");
const boletasRoutes = require("./routes/boletas.routes");
const seguridadRoutes = require("./routes/seguridad.routes");
const authRoutes = require("./routes/auth.routes");

const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./docs/swagger");

const path = require("path");

// ========================================
// Configuración base
// El máximo de peticiones se ajusta con RATE_LIMIT_MAX
// ========================================
const app = express();
const PUERTO = process.env.PORT || 3000;
const ORIGEN_PERMITIDO = process.env.ALLOWED_ORIGIN || "http://localhost:3000";
const MAXIMO_PETICIONES = Number(process.env.RATE_LIMIT_MAX) || 100;

app.disable("x-powered-by");

// ========================================
// Middlewares de seguridad
// Cabeceras de helmet y CORS restringido a un único origen
// ========================================
app.use(helmet());

app.use(
  cors({
    origin: ORIGEN_PERMITIDO,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"]
  })
);

// ========================================
// Middlewares de parseo
// ========================================
app.use(express.json({ limit: "10kb" }));

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
// Autenticación mediante API Key
// Toda petición a /api exige la cabecera X-API-Key
// ========================================
app.use("/api", validarApiKey);

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

// ========================================
// Sala: el frontend público
// Se sirve desde el mismo servidor, así que comparte origen con /api
// ========================================
// Política de contenido propia, más estricta que la del resto del servidor.
// El helmet() global deja style-src con 'unsafe-inline', que es su valor por
// defecto y que /api-docs necesita porque Swagger UI escribe estilos en línea.
// La Sala no escribe ninguno: no tiene atributos style en el marcado ni bloques
// <style>, así que aquí style-src puede ser 'self' a secas. Esta cabecera se
// fija antes de servir nada de /sala y reemplaza a la global solo en estas
// peticiones.
app.use(
  "/sala",
  helmet.contentSecurityPolicy({
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      scriptSrcAttr: ["'none'"],
      // Sin 'unsafe-inline': la Sala no tiene ni un estilo en línea.
      styleSrc: ["'self'"],
      // Las tipografías y las fotografías están dentro del proyecto: no hace
      // falta permitir https: ni data:.
      fontSrc: ["'self'"],
      imgSrc: ["'self'"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'self'"]
    }
  })
);

// La API Key del cliente "Aplicación Web" se entrega al navegador en tiempo de
// ejecución, leída del .env. Nunca se escribe en un archivo del repositorio.
// En un navegador esa clave no es secreta: identifica a la aplicación, no la
// protege. Lo que protege es el JWT, el límite de peticiones y poder revocar
// este cliente desde src/data/apiKeys.js.
app.get("/sala/config.js", (req, res) => {
  const configuracion = {
    api: "/api",
    apiKey: process.env.API_KEY_WEB || ""
  };

  // Sin caché: la clave puede rotar y no debe quedarse guardada en el navegador
  // ni en ningún intermediario.
  res.type("application/javascript");
  res.set("Cache-Control", "no-store");
  res.send(`window.TEATRO_CONFIG = ${JSON.stringify(configuracion)};\n`);
});

app.use("/sala", express.static(path.join(__dirname, "..", "frontend")));

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
// ========================================
app.listen(PUERTO, () => {
  console.log(`Servidor escuchando en http://localhost:${PUERTO}`);
});

module.exports = app;
