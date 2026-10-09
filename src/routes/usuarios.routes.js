// ========================================
// Importaciones
// ========================================
const express = require("express");

const usuariosController = require("../controllers/usuarios.controller");
const autenticarJWT = require("../middlewares/auth.middleware");
const autorizarRoles = require("../middlewares/roles.middleware");
const { validar } = require("../middlewares/validar.middleware");
const {
  validarCreacionUsuario
} = require("../middlewares/usuarios.validator");

const router = express.Router();

// ========================================
// Esquemas de documentación
// ========================================
/**
 * @openapi
 * components:
 *   schemas:
 *     UsuarioAdministrativoEntrada:
 *       type: object
 *       description: >
 *         Datos que acepta la creación administrativa de usuarios. No incluye
 *         id, activo ni passwordHash: esos los fija el servidor, y si llegan en
 *         el cuerpo se descartan.
 *       required: [nombre, email, password, rol]
 *       properties:
 *         nombre:
 *           type: string
 *           minLength: 3
 *           maxLength: 100
 *           example: Taquilla Teatro
 *         email:
 *           type: string
 *           format: email
 *           example: taquilla@teatro.com
 *         password:
 *           type: string
 *           format: password
 *           minLength: 10
 *           maxLength: 72
 *           example: ClaveSegura2026!
 *         rol:
 *           type: string
 *           description: >
 *             Lista blanca de dos valores. El rol asistente no se puede otorgar
 *             por aquí: se obtiene registrándose en /api/auth/registro.
 *           enum: [taquilla, administrador]
 *           example: taquilla
 */

// ========================================
// POST /api/usuarios
// ========================================
/**
 * @openapi
 * /api/usuarios:
 *   post:
 *     tags: [Usuarios]
 *     summary: Crea un usuario de taquilla o de administración
 *     description: >
 *       Operación reservada al rol **administrador**. Es el único camino por el
 *       que se otorgan los roles taquilla y administrador: el registro público
 *       crea siempre asistentes. El rol llega en el cuerpo pero pasa por una
 *       lista blanca de dos valores, así que cualquier otro, incluidos
 *       `asistente` y `superadmin`, responde 400. El id y el estado activo los
 *       pone el servidor y la respuesta nunca incluye la contraseña ni su hash.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/UsuarioAdministrativoEntrada"
 *     security:
 *       - ApiKeyAuth: []
 *         BearerAuth: []
 *     responses:
 *       201:
 *         description: Usuario creado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/RespuestaUsuario"
 *       400:
 *         description: Datos de entrada inválidos, o un rol fuera de la lista blanca
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorValidacion"
 *       401:
 *         description: Falta el token, es inválido o la API Key es incorrecta
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       403:
 *         description: El rol autenticado no tiene permiso para esta operación
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       409:
 *         description: Ya existe un usuario con ese correo electrónico
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
 *       500:
 *         description: Error interno del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 */
router.post(
  "/",
  autenticarJWT,
  autorizarRoles("administrador"),
  validarCreacionUsuario,
  validar,
  usuariosController.crearUsuario
);

// ========================================
// Exportaciones
// ========================================
module.exports = router;
