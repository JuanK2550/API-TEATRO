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
