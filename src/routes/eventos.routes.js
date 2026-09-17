// ========================================
// Importaciones
// ========================================
const express = require("express");

const eventosController = require("../controllers/eventos.controller");
const { validar } = require("../middlewares/validar.middleware");
const {
  validarIdEvento,
  validarCreacionEvento,
  validarActualizacionEvento,
  validarEventoParcial,
  validarEstadoEvento
} = require("../middlewares/eventos.validator");

const router = express.Router();

// ========================================
// Esquemas de documentación
// ========================================
/**
 * @openapi
 * components:
 *   schemas:
 *     Evento:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         titulo:
 *           type: string
 *           example: La Casa de Bernarda Alba
 *         tipo:
 *           type: string
 *           enum: [obra, concierto, cine, institucional]
 *           example: obra
 *         descripcion:
 *           type: string
 *           example: Montaje de la obra de Federico García Lorca.
 *         duracionMinutos:
 *           type: integer
 *           example: 110
 *         clasificacionEdad:
 *           type: string
 *           enum: ["G", "+7", "+12", "+15", "+18"]
 *           example: "+12"
 *         activo:
 *           type: boolean
 *           description: Solo se modifica con PATCH /api/eventos/{id}/estado
 *           example: true
 *     EventoEntrada:
 *       type: object
 *       required: [titulo, tipo, descripcion, duracionMinutos, clasificacionEdad]
 *       description: El campo activo no se acepta; todo evento se crea activo.
 *       properties:
 *         titulo:
 *           type: string
 *           minLength: 3
 *           maxLength: 150
 *           example: La Casa de Bernarda Alba
 *         tipo:
 *           type: string
 *           enum: [obra, concierto, cine, institucional]
 *           example: obra
 *         descripcion:
 *           type: string
 *           minLength: 10
 *           maxLength: 500
 *           example: Montaje de la obra de Federico García Lorca.
 *         duracionMinutos:
 *           type: integer
 *           minimum: 10
 *           maximum: 600
 *           example: 110
 *         clasificacionEdad:
 *           type: string
 *           enum: ["G", "+7", "+12", "+15", "+18"]
 *           example: "+12"
 *     EventoParcial:
 *       type: object
 *       description: Al menos un campo. Los no enviados conservan su valor.
 *       properties:
 *         titulo:
 *           type: string
 *         tipo:
 *           type: string
 *           enum: [obra, concierto, cine, institucional]
 *         descripcion:
 *           type: string
 *         duracionMinutos:
 *           type: integer
 *         clasificacionEdad:
 *           type: string
 *           enum: ["G", "+7", "+12", "+15", "+18"]
 *     EstadoEventoEntrada:
 *       type: object
 *       required: [activo]
 *       properties:
 *         activo:
 *           type: boolean
 *           example: false
 *     RespuestaEvento:
 *       type: object
 *       properties:
 *         mensaje:
 *           type: string
 *           example: Evento creado correctamente
 *         evento:
 *           $ref: "#/components/schemas/Evento"
 */

// ========================================
// GET /api/eventos
// ========================================
/**
 * @openapi
 * /api/eventos:
 *   get:
 *     tags: [Eventos]
 *     summary: Lista todos los eventos
 *     responses:
 *       200:
 *         description: Listado de eventos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: "#/components/schemas/Evento"
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
router.get("/", eventosController.obtenerEventos);

// ========================================
// GET /api/eventos/:id
// ========================================
/**
 * @openapi
 * /api/eventos/{id}:
 *   get:
 *     tags: [Eventos]
 *     summary: Obtiene un evento por su id
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *     responses:
 *       200:
 *         description: Evento encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Evento"
 *       400:
 *         description: Id inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorValidacion"
 *       404:
 *         description: Evento no encontrado
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
router.get("/:id", validarIdEvento, validar, eventosController.obtenerEventoPorId);

// ========================================
// POST /api/eventos
// ========================================
/**
 * @openapi
 * /api/eventos:
 *   post:
 *     tags: [Eventos]
 *     summary: Crea un evento
 *     description: El evento se crea siempre con activo en true.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/EventoEntrada"
 *     responses:
 *       201:
 *         description: Evento creado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/RespuestaEvento"
 *       400:
 *         description: Datos de entrada inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorValidacion"
 *       500:
 *         description: Error interno del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 */
router.post("/", validarCreacionEvento, validar, eventosController.crearEvento);

// ========================================
// PUT /api/eventos/:id
// ========================================
/**
 * @openapi
 * /api/eventos/{id}:
 *   put:
 *     tags: [Eventos]
 *     summary: Reemplaza por completo un evento
 *     description: El campo activo conserva su valor actual.
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
 *             $ref: "#/components/schemas/EventoEntrada"
 *     responses:
 *       200:
 *         description: Evento actualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/RespuestaEvento"
 *       400:
 *         description: Datos de entrada inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorValidacion"
 *       404:
 *         description: Evento no encontrado
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
router.put(
  "/:id",
  validarIdEvento,
  validarActualizacionEvento,
  validar,
  eventosController.actualizarEvento
);

// ========================================
// PATCH /api/eventos/:id
// ========================================
/**
 * @openapi
 * /api/eventos/{id}:
 *   patch:
 *     tags: [Eventos]
 *     summary: Actualiza parcialmente un evento
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
 *             $ref: "#/components/schemas/EventoParcial"
 *     responses:
 *       200:
 *         description: Evento actualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/RespuestaEvento"
 *       400:
 *         description: Datos inválidos o cuerpo sin campos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorValidacion"
 *       404:
 *         description: Evento no encontrado
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
router.patch(
  "/:id",
  validarIdEvento,
  validarEventoParcial,
  validar,
  eventosController.actualizarEventoParcial
);

// ========================================
// PATCH /api/eventos/:id/estado
// ========================================
/**
 * @openapi
 * /api/eventos/{id}/estado:
 *   patch:
 *     tags: [Eventos]
 *     summary: Activa o desactiva un evento
 *     description: Único endpoint que modifica el campo activo.
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
 *             $ref: "#/components/schemas/EstadoEventoEntrada"
 *     responses:
 *       200:
 *         description: Estado del evento actualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/RespuestaEvento"
 *       400:
 *         description: Datos de entrada inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorValidacion"
 *       404:
 *         description: Evento no encontrado
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
router.patch(
  "/:id/estado",
  validarIdEvento,
  validarEstadoEvento,
  validar,
  eventosController.cambiarEstadoEvento
);

// ========================================
// DELETE /api/eventos/:id
// ========================================
/**
 * @openapi
 * /api/eventos/{id}:
 *   delete:
 *     tags: [Eventos]
 *     summary: Elimina un evento
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *     responses:
 *       200:
 *         description: Evento eliminado
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
 *         description: Evento no encontrado
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
router.delete("/:id", validarIdEvento, validar, eventosController.eliminarEvento);

// ========================================
// Exportaciones
// ========================================
module.exports = router;
