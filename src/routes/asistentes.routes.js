// ========================================
// Importaciones
// ========================================
const express = require("express");

const asistentesController = require("../controllers/asistentes.controller");
const autenticarJWT = require("../middlewares/auth.middleware");
const autorizarRoles = require("../middlewares/roles.middleware");
const { validar } = require("../middlewares/validar.middleware");
const {
  validarIdAsistente,
  validarCreacionAsistente,
  validarActualizacionAsistente,
  validarAsistenteParcial
} = require("../middlewares/asistentes.validator");

const router = express.Router();

// ========================================
// Esquemas de documentación
// ========================================
/**
 * @openapi
 * components:
 *   schemas:
 *     Asistente:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         nombre:
 *           type: string
 *           example: Laura Sofía Pineda Rojas
 *         documento:
 *           type: string
 *           example: "1049632178"
 *         email:
 *           type: string
 *           format: email
 *           example: laura.pineda@correo.com
 *         telefono:
 *           type: string
 *           example: "3124567890"
 *         fechaNacimiento:
 *           type: string
 *           format: date
 *           example: "1995-03-14"
 *         usuarioId:
 *           type: integer
 *           nullable: true
 *           description: >
 *             Cuenta a la que pertenecen estos datos. Lo pone el servidor desde
 *             el token; es null cuando los registró la taquilla.
 *           example: 1
 *     AsistenteEntrada:
 *       type: object
 *       required: [nombre, documento, email, telefono, fechaNacimiento]
 *       properties:
 *         nombre:
 *           type: string
 *           minLength: 3
 *           maxLength: 100
 *           example: Laura Sofía Pineda Rojas
 *         documento:
 *           type: string
 *           minLength: 5
 *           maxLength: 20
 *           description: Único entre asistentes
 *           example: "1049632178"
 *         email:
 *           type: string
 *           format: email
 *           description: Se normaliza a minúsculas
 *           example: laura.pineda@correo.com
 *         telefono:
 *           type: string
 *           description: Entre 7 y 15 dígitos
 *           example: "3124567890"
 *         fechaNacimiento:
 *           type: string
 *           format: date
 *           description: Formato YYYY-MM-DD, no puede estar en el futuro
 *           example: "1995-03-14"
 *     AsistenteParcial:
 *       type: object
 *       description: Al menos un campo. Los no enviados conservan su valor.
 *       properties:
 *         nombre:
 *           type: string
 *         documento:
 *           type: string
 *         email:
 *           type: string
 *           format: email
 *         telefono:
 *           type: string
 *         fechaNacimiento:
 *           type: string
 *           format: date
 *     RespuestaAsistente:
 *       type: object
 *       properties:
 *         mensaje:
 *           type: string
 *           example: Asistente creado correctamente
 *         asistente:
 *           $ref: "#/components/schemas/Asistente"
 */

// ========================================
// GET /api/asistentes
// ========================================
/**
 * @openapi
 * /api/asistentes:
 *   get:
 *     tags: [Asistentes]
 *     summary: Lista todos los asistentes
 *     security:
 *       - ApiKeyAuth: []
 *         BearerAuth: []
 *     responses:
 *       200:
 *         description: Listado de asistentes
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: "#/components/schemas/Asistente"
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
 */
router.get(
  "/",
  autenticarJWT,
  autorizarRoles("administrador", "taquilla"),
  asistentesController.obtenerAsistentes
);

// ========================================
// GET /api/asistentes/mio
// Va antes que /:id: si no, "mio" entraría como un id
// ========================================
/**
 * @openapi
 * /api/asistentes/mio:
 *   get:
 *     tags: [Asistentes]
 *     summary: Devuelve los datos de asistente de la cuenta autenticada
 *     description: >
 *       Resuelve el asistente a partir del token, no de un id en la dirección.
 *       Así quien compra por segunda vez no tiene que volver a escribir su
 *       documento, y nadie puede consultar los datos de otra persona.
 *     security:
 *       - ApiKeyAuth: []
 *         BearerAuth: []
 *     responses:
 *       200:
 *         description: Datos de asistente de la cuenta
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Asistente"
 *       401:
 *         description: Falta el token, es inválido o la API Key es incorrecta
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
 *       404:
 *         description: La cuenta todavía no tiene datos de asistente
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
router.get(
  "/mio",
  autenticarJWT,
  autorizarRoles("asistente"),
  asistentesController.obtenerMiAsistente
);

// ========================================
// POST /api/asistentes/mio
// ========================================
/**
 * @openapi
 * /api/asistentes/mio:
 *   post:
 *     tags: [Asistentes]
 *     summary: Liga unos datos de asistente a la cuenta autenticada
 *     description: >
 *       Solo hace falta la primera vez. El vínculo con la cuenta lo pone el
 *       servidor desde el token: usuarioId no se declara en el validador.
 *     security:
 *       - ApiKeyAuth: []
 *         BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/AsistenteEntrada"
 *     responses:
 *       201:
 *         description: Asistente creado y ligado a la cuenta
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/RespuestaAsistente"
 *       400:
 *         description: Datos de entrada inválidos
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
 *         description: API Key deshabilitada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       409:
 *         description: La cuenta ya tiene datos de asistente, o el documento ya está registrado
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
  "/mio",
  autenticarJWT,
  autorizarRoles("asistente"),
  validarCreacionAsistente,
  validar,
  asistentesController.crearMiAsistente
);

// ========================================
// GET /api/asistentes/:id
// ========================================
/**
 * @openapi
 * /api/asistentes/{id}:
 *   get:
 *     tags: [Asistentes]
 *     summary: Obtiene un asistente por su id
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *     security:
 *       - ApiKeyAuth: []
 *         BearerAuth: []
 *     responses:
 *       200:
 *         description: Asistente encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Asistente"
 *       400:
 *         description: Id inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorValidacion"
 *       404:
 *         description: Asistente no encontrado
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
 */
router.get(
  "/:id",
  autenticarJWT,
  autorizarRoles("administrador", "taquilla"),
  validarIdAsistente,
  validar,
  asistentesController.obtenerAsistentePorId
);

// ========================================
// POST /api/asistentes
// ========================================
/**
 * @openapi
 * /api/asistentes:
 *   post:
 *     tags: [Asistentes]
 *     summary: Crea un asistente
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/AsistenteEntrada"
 *     security:
 *       - ApiKeyAuth: []
 *         BearerAuth: []
 *     responses:
 *       201:
 *         description: Asistente creado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/RespuestaAsistente"
 *       400:
 *         description: Datos de entrada inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorValidacion"
 *       409:
 *         description: Ya existe un asistente con ese documento
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
 */
router.post(
  "/",
  autenticarJWT,
  autorizarRoles("administrador", "taquilla"),
  validarCreacionAsistente,
  validar,
  asistentesController.crearAsistente
);

// ========================================
// PUT /api/asistentes/:id
// ========================================
/**
 * @openapi
 * /api/asistentes/{id}:
 *   put:
 *     tags: [Asistentes]
 *     summary: Reemplaza por completo un asistente
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/AsistenteEntrada"
 *     security:
 *       - ApiKeyAuth: []
 *         BearerAuth: []
 *     responses:
 *       200:
 *         description: Asistente actualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/RespuestaAsistente"
 *       400:
 *         description: Datos de entrada inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorValidacion"
 *       404:
 *         description: Asistente no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       409:
 *         description: Ya existe otro asistente con ese documento
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
 */
router.put(
  "/:id",
  autenticarJWT,
  autorizarRoles("administrador"),
  validarIdAsistente,
  validarActualizacionAsistente,
  validar,
  asistentesController.actualizarAsistente
);

// ========================================
// PATCH /api/asistentes/:id
// ========================================
/**
 * @openapi
 * /api/asistentes/{id}:
 *   patch:
 *     tags: [Asistentes]
 *     summary: Actualiza parcialmente un asistente
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/AsistenteParcial"
 *     security:
 *       - ApiKeyAuth: []
 *         BearerAuth: []
 *     responses:
 *       200:
 *         description: Asistente actualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/RespuestaAsistente"
 *       400:
 *         description: Datos inválidos o cuerpo sin campos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorValidacion"
 *       404:
 *         description: Asistente no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       409:
 *         description: Ya existe otro asistente con ese documento
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
 */
router.patch(
  "/:id",
  autenticarJWT,
  autorizarRoles("administrador"),
  validarIdAsistente,
  validarAsistenteParcial,
  validar,
  asistentesController.actualizarAsistenteParcial
);

// ========================================
// DELETE /api/asistentes/:id
// ========================================
/**
 * @openapi
 * /api/asistentes/{id}:
 *   delete:
 *     tags: [Asistentes]
 *     summary: Elimina un asistente
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *     security:
 *       - ApiKeyAuth: []
 *         BearerAuth: []
 *     responses:
 *       200:
 *         description: Asistente eliminado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Mensaje"
 *       400:
 *         description: Id inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorValidacion"
 *       404:
 *         description: Asistente no encontrado
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
 */
router.delete(
  "/:id",
  autenticarJWT,
  autorizarRoles("administrador"),
  validarIdAsistente,
  validar,
  asistentesController.eliminarAsistente
);

// ========================================
// Exportaciones
// ========================================
module.exports = router;
