// ========================================
// Importaciones
// ========================================
const express = require("express");

const authController = require("../controllers/auth.controller");
const autenticarJWT = require("../middlewares/auth.middleware");
const { validar } = require("../middlewares/validar.middleware");
const {
  validarRegistro,
  validarLogin
} = require("../middlewares/auth.validator");

const router = express.Router();

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
 *       401:
 *         description: API Key ausente o inválida
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       403:
 *         description: API Key deshabilitada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
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
router.post("/registro", validarRegistro, validar, authController.registrar);

// ========================================
// POST /api/auth/login
// ========================================
/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags: [Autenticación]
 *     summary: Inicia sesión
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
 *         description: Credenciales inválidas, o API Key ausente o inválida
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       403:
 *         description: Usuario deshabilitado, o API Key deshabilitada
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
router.post("/login", validarLogin, validar, authController.login);

// ========================================
// GET /api/auth/perfil
// Exige las dos credenciales: API Key del cliente y JWT del usuario
// ========================================
/**
 * @openapi
 * /api/auth/perfil:
 *   get:
 *     tags: [Autenticación]
 *     summary: Devuelve quién está autenticado
 *     description: >
 *       Lee el JWT de la cabecera Authorization y devuelve la persona que lo
 *       presentó, junto al cliente dueño de la API Key. Hacen falta las dos
 *       credenciales a la vez.
 *     security:
 *       - ApiKeyAuth: []
 *         BearerAuth: []
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
 *         description: Falta el token, tiene mal formato, está expirado o es inválido; o la API Key es incorrecta
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       403:
 *         description: API Key deshabilitada
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
// Exportaciones
// ========================================
module.exports = router;
