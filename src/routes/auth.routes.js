// ========================================
// Importaciones
// ========================================
const express = require("express");
const { rateLimit } = require("express-rate-limit");

const authController = require("../controllers/auth.controller");
const autenticarJWT = require("../middlewares/auth.middleware");
const { validar } = require("../middlewares/validar.middleware");
const autorizarRoles = require("../middlewares/roles.middleware");
const {
  validarRegistro,
  validarLogin,
  validarCambioPassword,
  validarGenerarRecuperacion,
  validarRestablecimiento,
  validarGenerarCodigos,
  validarRestablecerConCodigo
} = require("../middlewares/auth.validator");

const router = express.Router();

// ========================================
// Límite de las operaciones de recuperación
// ========================================
// Más estrecho que el general de la API: estas rutas aceptan un token o un
// código de un solo uso, y probar muchos seguidos es la única forma de
// atacarlos. Diez intentos por ventana dejan sitio para equivocarse y ninguno
// para tantear.
// El máximo se puede subir por entorno, igual que RATE_LIMIT_MAX: una batería
// de pruebas supera los diez intentos enseguida. El valor de servicio es 10, y
// cerrar la terminal lo restablece.
const MAXIMO_RECUPERACION = Number(process.env.RATE_LIMIT_RECUPERACION_MAX) || 10;

// Login y registro son públicos desde el bloque 11: no hay API Key que frene
// a quien los golpee en serie, así que el límite deja de ser un adorno y pasa
// a ser la única barrera contra probar contraseñas o crear cuentas en masa.
const MAXIMO_ACCESO = Number(process.env.RATE_LIMIT_ACCESO_MAX) || 10;

const limiteAcceso = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: MAXIMO_ACCESO,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { mensaje: "Demasiados intentos. Intente más tarde." }
});

const limiteRecuperacion = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: MAXIMO_RECUPERACION,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { mensaje: "Demasiados intentos. Intente más tarde." }
});

// ========================================
// Esquemas de documentación
// ========================================
/**
 * @openapi
 * components:
 *   schemas:
 *     RegistroUsuario:
 *       type: object
 *       description: >
 *         Datos que acepta el registro. El rol no aparece porque lo asigna el
 *         servidor: todo usuario nuevo nace como asistente.
 *       required: [nombre, email, password]
 *       properties:
 *         nombre:
 *           type: string
 *           minLength: 3
 *           maxLength: 100
 *           example: Asistente Teatro
 *         email:
 *           type: string
 *           format: email
 *           example: asistente@teatro.com
 *         password:
 *           type: string
 *           format: password
 *           minLength: 10
 *           maxLength: 72
 *           example: ClaveSegura2026!
 *     LoginUsuario:
 *       type: object
 *       required: [email, password]
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: asistente@teatro.com
 *         password:
 *           type: string
 *           format: password
 *           example: ClaveSegura2026!
 *     UsuarioPublico:
 *       type: object
 *       description: Datos del usuario que sí salen de la API. Nunca incluye la contraseña ni su hash.
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         nombre:
 *           type: string
 *           example: Asistente Teatro
 *         email:
 *           type: string
 *           format: email
 *           example: asistente@teatro.com
 *         rol:
 *           type: string
 *           description: Lo asigna el servidor. El registro público siempre crea asistentes.
 *           enum: [administrador, taquilla, asistente]
 *           example: asistente
 *         activo:
 *           type: boolean
 *           example: true
 *     RespuestaUsuario:
 *       type: object
 *       properties:
 *         mensaje:
 *           type: string
 *           example: Usuario registrado correctamente
 *         usuario:
 *           $ref: "#/components/schemas/UsuarioPublico"
 *     RespuestaLogin:
 *       type: object
 *       description: >
 *         Respuesta del login. El token es un JWT firmado con HS256 que caduca
 *         según JWT_EXPIRES_IN. Su contenido se puede leer: la firma impide
 *         modificarlo, no lo oculta.
 *       properties:
 *         mensaje:
 *           type: string
 *           example: Autenticación correcta
 *         usuario:
 *           $ref: "#/components/schemas/UsuarioPublico"
 *         token:
 *           type: string
 *           description: JWT con los claims sub, email, rol, iat y exp.
 *           example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.<payload>.<firma>
 */

// ========================================
// POST /api/auth/registro
// ========================================
/**
 * @openapi
 * /api/auth/registro:
 *   post:
 *     tags: [Autenticación]
 *     summary: Registra un usuario
 *     security: []
 *     description: >
 *       Crea un usuario guardando su contraseña con bcrypt. **El rol lo asigna
 *       el servidor y el cliente no puede definirlo**: todo registro nace con
 *       el rol asistente y la cuenta activa. Si la petición envía un campo rol,
 *       se ignora. La respuesta nunca incluye la contraseña ni su hash.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/RegistroUsuario"
 *     responses:
 *       201:
 *         description: Usuario registrado correctamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/RespuestaUsuario"
 *       400:
 *         description: Datos de entrada inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorValidacion"
 *       409:
 *         description: El correo electrónico ya está registrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       429:
 *         description: Demasiadas peticiones
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 */
router.post(
  "/registro",
  limiteAcceso,
  validarRegistro,
  validar,
  authController.registrar
);

// ========================================
// POST /api/auth/login
// ========================================
/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags: [Autenticación]
 *     summary: Inicia sesión
 *     security: []
 *     description: >
 *       Comprueba el correo y la contraseña contra el hash guardado. Si son
 *       correctas devuelve un JWT en el campo token, que identifica a la
 *       persona en las siguientes peticiones.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/LoginUsuario"
 *     responses:
 *       200:
 *         description: Credenciales correctas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/RespuestaLogin"
 *       400:
 *         description: Datos de entrada inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorValidacion"
 *       401:
 *         description: Credenciales inválidas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       403:
 *         description: Usuario deshabilitado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       429:
 *         description: Demasiadas peticiones
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 */
router.post(
  "/login",
  limiteAcceso,
  validarLogin,
  validar,
  authController.login
);

// ========================================
// GET /api/auth/perfil
// Basta el JWT; el cliente solo aparece si la petición trae clave
// ========================================
/**
 * @openapi
 * /api/auth/perfil:
 *   get:
 *     tags: [Autenticación]
 *     summary: Devuelve quién está autenticado
 *     description: >
 *       Lee el JWT de la cabecera Authorization y devuelve la persona que lo
 *       presentó. Si la petición trae además una API Key válida, incluye el
 *       cliente dueño de esa clave en clienteApi.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Usuario autenticado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 mensaje:
 *                   type: string
 *                   example: Usuario autenticado mediante JWT
 *                 usuario:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     email:
 *                       type: string
 *                       format: email
 *                       example: asistente@teatro.com
 *                     rol:
 *                       type: string
 *                       enum: [administrador, taquilla, asistente]
 *                       example: asistente
 *                 clienteApi:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     nombre:
 *                       type: string
 *                       example: Postman Laboratorio
 *       401:
 *         description: Falta el token, tiene mal formato, está expirado, es inválido o fue revocado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       429:
 *         description: Demasiadas peticiones
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 */
router.get("/perfil", autenticarJWT, (req, res) => {
  res.status(200).json({
    mensaje: "Usuario autenticado mediante JWT",
    usuario: req.usuario,
    clienteApi: req.clienteApi
  });
});

// ========================================
// PATCH /api/auth/cambiar-password
// ========================================
/**
 * @openapi
 * /api/auth/cambiar-password:
 *   patch:
 *     tags: [Autenticación]
 *     summary: Cambiar la propia contraseña
 *     description: >
 *       Exige la contraseña actual además del token. Al completarse, la versión
 *       de sesión sube y todos los tokens emitidos antes dejan de ser válidos:
 *       hay que iniciar sesión otra vez.
 *     security: [{ BearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [passwordActual, passwordNueva, confirmarPassword]
 *             properties:
 *               passwordActual:
 *                 type: string
 *               passwordNueva:
 *                 type: string
 *                 minLength: 12
 *                 maxLength: 72
 *                 description: Debe incluir mayúscula, minúscula y número
 *               confirmarPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Contraseña actualizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Mensaje"
 *       400:
 *         description: Datos inválidos, o la nueva contraseña es igual a la actual
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorValidacion"
 *       401:
 *         description: Sin token, sesión revocada, o contraseña actual incorrecta
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       409:
 *         description: La contraseña cambió durante la operación
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 */
router.patch(
  "/cambiar-password",
  autenticarJWT,
  limiteRecuperacion,
  validarCambioPassword,
  validar,
  authController.cambiarPassword
);

// ========================================
// POST /api/auth/recuperacion/:usuarioId
// ========================================
/**
 * @openapi
 * /api/auth/recuperacion/{usuarioId}:
 *   post:
 *     tags: [Autenticación]
 *     summary: Emitir un token de recuperación para otra cuenta
 *     description: >
 *       Solo el administrador. Devuelve el token una única vez y deja
 *       constancia de quién lo autorizó. Vence a los 15 minutos y anula
 *       cualquier token anterior de esa cuenta.
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: usuarioId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *     responses:
 *       201:
 *         description: Token emitido
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 mensaje:
 *                   type: string
 *                 token:
 *                   type: string
 *                   description: 64 caracteres hexadecimales. No se vuelve a mostrar
 *                 expiraEn:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Id inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorValidacion"
 *       401:
 *         description: Sin token o sesión revocada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       403:
 *         description: El rol autenticado no es administrador
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       404:
 *         description: La cuenta no existe o está deshabilitada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 */
router.post(
  "/recuperacion/:usuarioId",
  autenticarJWT,
  autorizarRoles("administrador"),
  limiteRecuperacion,
  validarGenerarRecuperacion,
  validar,
  authController.generarRecuperacion
);

// ========================================
// POST /api/auth/restablecer-password
// No exige sesión: quien la perdió no puede iniciarla
// ========================================
/**
 * @openapi
 * /api/auth/restablecer-password:
 *   post:
 *     tags: [Autenticación]
 *     summary: Restablecer la contraseña con un token de recuperación
 *     description: >
 *       No necesita credenciales, por definición: quien lo usa perdió el
 *       acceso. Lo protege el propio token, de 256 bits y un solo uso, y un
 *       límite de diez intentos por ventana. Consume el token, sube la versión
 *       de sesión y anula los códigos de respaldo que hubiera sin usar.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, passwordNueva, confirmarPassword]
 *             properties:
 *               token:
 *                 type: string
 *                 pattern: "^[a-f0-9]{64}$"
 *               passwordNueva:
 *                 type: string
 *                 minLength: 12
 *                 maxLength: 72
 *               confirmarPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Contraseña restablecida
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Mensaje"
 *       400:
 *         description: Token inválido, usado o expirado; o contraseña repetida
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 */
router.post(
  "/restablecer-password",
  limiteRecuperacion,
  validarRestablecimiento,
  validar,
  authController.restablecerPassword
);

// ========================================
// POST /api/auth/codigos-recuperacion
// ========================================
/**
 * @openapi
 * /api/auth/codigos-recuperacion:
 *   post:
 *     tags: [Autenticación]
 *     summary: Generar ocho códigos de respaldo
 *     description: >
 *       Pide la contraseña actual además del token: es una reautenticación.
 *       Los códigos se muestran una sola vez; la base guarda solo sus hashes.
 *     security: [{ BearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [passwordActual]
 *             properties:
 *               passwordActual:
 *                 type: string
 *     responses:
 *       201:
 *         description: Códigos generados
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 mensaje:
 *                   type: string
 *                 codigos:
 *                   type: array
 *                   items:
 *                     type: string
 *       401:
 *         description: Sin token, sesión revocada, o contraseña actual incorrecta
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 */
router.post(
  "/codigos-recuperacion",
  autenticarJWT,
  limiteRecuperacion,
  validarGenerarCodigos,
  validar,
  authController.generarCodigos
);

// ========================================
// GET /api/auth/codigos-recuperacion/estado
// ========================================
/**
 * @openapi
 * /api/auth/codigos-recuperacion/estado:
 *   get:
 *     tags: [Autenticación]
 *     summary: Cuántos códigos de respaldo quedan sin usar
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Cantidad disponible
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 disponibles:
 *                   type: integer
 *       401:
 *         description: Sin token o sesión revocada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 */
router.get(
  "/codigos-recuperacion/estado",
  autenticarJWT,
  authController.estadoCodigos
);

// ========================================
// POST /api/auth/codigos-recuperacion/regenerar
// Mismo controlador: regenerar es volver a generar
// ========================================
/**
 * @openapi
 * /api/auth/codigos-recuperacion/regenerar:
 *   post:
 *     tags: [Autenticación]
 *     summary: Sustituir el lote de códigos de respaldo
 *     description: Los códigos anteriores quedan invalidados.
 *     security: [{ BearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [passwordActual]
 *             properties:
 *               passwordActual:
 *                 type: string
 *     responses:
 *       201:
 *         description: Códigos regenerados
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Mensaje"
 *       401:
 *         description: Sin token, sesión revocada, o contraseña actual incorrecta
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 */
router.post(
  "/codigos-recuperacion/regenerar",
  autenticarJWT,
  limiteRecuperacion,
  validarGenerarCodigos,
  validar,
  authController.generarCodigos
);

// ========================================
// POST /api/auth/restablecer-con-codigo
// ========================================
/**
 * @openapi
 * /api/auth/restablecer-con-codigo:
 *   post:
 *     tags: [Autenticación]
 *     summary: Restablecer la contraseña con un código de respaldo
 *     description: >
 *       Tampoco necesita credenciales. Lo protege el propio código, de 128 bits
 *       y un solo uso, ligado además al correo de la cuenta, y un límite de diez
 *       intentos por ventana. Gasta solo el código usado y deja los demás en
 *       pie; anula los tokens administrativos pendientes de esa cuenta.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, codigo, passwordNueva, confirmarPassword]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               codigo:
 *                 type: string
 *               passwordNueva:
 *                 type: string
 *                 minLength: 12
 *                 maxLength: 72
 *               confirmarPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Contraseña restablecida
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Mensaje"
 *       400:
 *         description: Código o cuenta inválidos, o contraseña repetida
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 */
router.post(
  "/restablecer-con-codigo",
  limiteRecuperacion,
  validarRestablecerConCodigo,
  validar,
  authController.restablecerConCodigo
);

// ========================================
// Exportaciones
// ========================================
module.exports = router;
