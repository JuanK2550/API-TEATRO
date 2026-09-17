// ========================================
// Importaciones
// ========================================
const express = require("express");

const localidadesController = require("../controllers/localidades.controller");
const { validar } = require("../middlewares/validar.middleware");
const {
  validarIdLocalidad,
  validarCreacionLocalidad,
  validarActualizacionLocalidad,
  validarLocalidadParcial,
  validarEstadoLocalidad
} = require("../middlewares/localidades.validator");

const router = express.Router();

// ========================================
// Esquemas de documentación
// ========================================
/**
 * @openapi
 * components:
 *   schemas:
 *     Localidad:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         codigo:
 *           type: string
 *           example: PLA-PREF
 *         nombre:
 *           type: string
 *           example: Platea Preferencial
 *         orden:
 *           type: integer
 *           description: Cercanía al escenario. 1 es la más cercana y la más cara.
 *           example: 1
 *         filas:
 *           type: integer
 *           example: 5
 *         butacasPorFila:
 *           type: integer
 *           example: 20
 *         capacidad:
 *           type: integer
 *           description: Calculada por el servidor como filas por butacasPorFila
 *           example: 100
 *         activa:
 *           type: boolean
 *           description: Solo se modifica con PATCH /api/localidades/{id}/estado
 *           example: true
 *     LocalidadEntrada:
 *       type: object
 *       required: [codigo, nombre, orden, filas, butacasPorFila]
 *       description: Los campos capacidad y activa no se aceptan del cliente.
 *       properties:
 *         codigo:
 *           type: string
 *           description: Único entre localidades. Se normaliza a mayúsculas.
 *           example: PLA-PREF
 *         nombre:
 *           type: string
 *           minLength: 3
 *           maxLength: 100
 *           example: Platea Preferencial
 *         orden:
 *           type: integer
 *           minimum: 1
 *           description: Único entre localidades
 *           example: 1
 *         filas:
 *           type: integer
 *           minimum: 1
 *           example: 5
 *         butacasPorFila:
 *           type: integer
 *           minimum: 1
 *           example: 20
 *     LocalidadParcial:
 *       type: object
 *       description: Al menos un campo. Los no enviados conservan su valor.
 *       properties:
 *         codigo:
 *           type: string
 *         nombre:
 *           type: string
 *         orden:
 *           type: integer
 *         filas:
 *           type: integer
 *         butacasPorFila:
 *           type: integer
 *     EstadoLocalidadEntrada:
 *       type: object
 *       required: [activa]
 *       properties:
 *         activa:
 *           type: boolean
 *           example: false
 *     RespuestaLocalidad:
 *       type: object
 *       properties:
 *         mensaje:
 *           type: string
 *           example: Localidad creada correctamente
 *         localidad:
 *           $ref: "#/components/schemas/Localidad"
 */

// ========================================
// GET /api/localidades
// ========================================
/**
 * @openapi
 * /api/localidades:
 *   get:
 *     tags: [Localidades]
 *     summary: Lista todas las localidades
 *     responses:
 *       200:
 *         description: Listado de localidades
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: "#/components/schemas/Localidad"
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
router.get("/", localidadesController.obtenerLocalidades);

// ========================================
// GET /api/localidades/:id
// ========================================
/**
 * @openapi
 * /api/localidades/{id}:
 *   get:
 *     tags: [Localidades]
 *     summary: Obtiene una localidad por su id
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *     responses:
 *       200:
 *         description: Localidad encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Localidad"
 *       400:
 *         description: Id inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorValidacion"
 *       404:
 *         description: Localidad no encontrada
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
  "/:id",
  validarIdLocalidad,
  validar,
  localidadesController.obtenerLocalidadPorId
);

// ========================================
// POST /api/localidades
// ========================================
/**
 * @openapi
 * /api/localidades:
 *   post:
 *     tags: [Localidades]
 *     summary: Crea una localidad
 *     description: La capacidad la calcula el servidor y la localidad nace activa.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/LocalidadEntrada"
 *     responses:
 *       201:
 *         description: Localidad creada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/RespuestaLocalidad"
 *       400:
 *         description: Datos de entrada inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorValidacion"
 *       409:
 *         description: El código o el orden ya están en uso
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
  validarCreacionLocalidad,
  validar,
  localidadesController.crearLocalidad
);

// ========================================
// PUT /api/localidades/:id
// ========================================
/**
 * @openapi
 * /api/localidades/{id}:
 *   put:
 *     tags: [Localidades]
 *     summary: Reemplaza por completo una localidad
 *     description: La capacidad se recalcula y el campo activa conserva su valor.
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
 *             $ref: "#/components/schemas/LocalidadEntrada"
 *     responses:
 *       200:
 *         description: Localidad actualizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/RespuestaLocalidad"
 *       400:
 *         description: Datos de entrada inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorValidacion"
 *       404:
 *         description: Localidad no encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       409:
 *         description: El código o el orden ya están en uso
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
  validarIdLocalidad,
  validarActualizacionLocalidad,
  validar,
  localidadesController.actualizarLocalidad
);

// ========================================
// PATCH /api/localidades/:id
// ========================================
/**
 * @openapi
 * /api/localidades/{id}:
 *   patch:
 *     tags: [Localidades]
 *     summary: Actualiza parcialmente una localidad
 *     description: Si cambian las filas o las butacas, la capacidad se recalcula.
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
 *             $ref: "#/components/schemas/LocalidadParcial"
 *     responses:
 *       200:
 *         description: Localidad actualizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/RespuestaLocalidad"
 *       400:
 *         description: Datos inválidos o cuerpo sin campos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorValidacion"
 *       404:
 *         description: Localidad no encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       409:
 *         description: El código o el orden ya están en uso
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
  validarIdLocalidad,
  validarLocalidadParcial,
  validar,
  localidadesController.actualizarLocalidadParcial
);

// ========================================
// PATCH /api/localidades/:id/estado
// ========================================
/**
 * @openapi
 * /api/localidades/{id}/estado:
 *   patch:
 *     tags: [Localidades]
 *     summary: Activa o desactiva una localidad
 *     description: Único endpoint que modifica el campo activa.
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
 *             $ref: "#/components/schemas/EstadoLocalidadEntrada"
 *     responses:
 *       200:
 *         description: Estado de la localidad actualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/RespuestaLocalidad"
 *       400:
 *         description: Datos de entrada inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorValidacion"
 *       404:
 *         description: Localidad no encontrada
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
  validarIdLocalidad,
  validarEstadoLocalidad,
  validar,
  localidadesController.cambiarEstadoLocalidad
);

// ========================================
// DELETE /api/localidades/:id
// ========================================
/**
 * @openapi
 * /api/localidades/{id}:
 *   delete:
 *     tags: [Localidades]
 *     summary: Elimina una localidad
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *     responses:
 *       200:
 *         description: Localidad eliminada
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
 *         description: Localidad no encontrada
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
router.delete(
  "/:id",
  validarIdLocalidad,
  validar,
  localidadesController.eliminarLocalidad
);

// ========================================
// Exportaciones
// ========================================
module.exports = router;
