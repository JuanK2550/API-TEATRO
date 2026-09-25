// ========================================
// Importaciones
// ========================================
const express = require("express");

const authController = require("../controllers/auth.controller");
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
 *       required: [nombre, email, password, rol]
 *       properties:
 *         nombre:
 *           type: string
 *           minLength: 3
 *           maxLength: 100
 *           example: Administrador Teatro
 *         email:
 *           type: string
 *           format: email
 *           example: admin@teatro.com
 *         password:
 *           type: string
 *           format: password
 *           minLength: 10
 *           maxLength: 72
 *           example: ClaveSegura2026!
 *         rol:
 *           type: string
 *           enum: [administrador, taquilla, asistente]
 *           example: administrador
 *     LoginUsuario:
 *       type: object
 *       required: [email, password]
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: admin@teatro.com
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
 *           example: Administrador Teatro
 *         email:
 *           type: string
 *           format: email
 *           example: admin@teatro.com
 *         rol:
 *           type: string
 *           enum: [administrador, taquilla, asistente]
 *           example: administrador
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
 *       Crea un usuario guardando su contraseña con bcrypt. La cuenta nace
 *       siempre activa y la respuesta nunca incluye la contraseña ni su hash.
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
 *       Comprueba el correo y la contraseña contra el hash guardado. En este
 *       bloque todavía no entrega ningún token.
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
 *               $ref: "#/components/schemas/RespuestaUsuario"
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
// Exportaciones
// ========================================
module.exports = router;
