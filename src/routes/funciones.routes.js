// ========================================
// Importaciones
// ========================================
const express = require("express");

const funcionesController = require("../controllers/funciones.controller");
const { validar } = require("../middlewares/validar.middleware");
const {
  validarIdFuncion,
  validarEventoIdFuncion,
  validarCreacionFuncion,
  validarActualizacionFuncion,
  validarFuncionParcial,
  validarEstadoFuncion
} = require("../middlewares/funciones.validator");

const router = express.Router();

// ========================================
// Esquemas de documentación
// ========================================
/**
 * @openapi
 * components:
 *   schemas:
 *     Tarifa:
 *       type: object
 *       required: [localidadId, precio]
 *       properties:
 *         localidadId:
 *           type: integer
 *           minimum: 1
 *           example: 1
 *         precio:
 *           type: integer
 *           minimum: 1
 *           description: Precio en pesos colombianos
 *           example: 75000
 *     TarifaDetallada:
 *       type: object
 *       properties:
 *         localidadId:
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
 *           description: Cercanía al escenario. 1 es la más cercana.
 *           example: 1
 *         activa:
 *           type: boolean
 *           example: true
 *         precio:
 *           type: integer
 *           example: 75000
 *     Funcion:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         eventoId:
 *           type: integer
 *           example: 1
 *         fecha:
 *           type: string
 *           format: date
 *           example: "2027-02-18"
 *         hora:
 *           type: string
 *           example: "19:00"
 *         estado:
 *           type: string
 *           enum: [programada, en_venta, agotada, en_curso, finalizada, cancelada]
 *           description: Solo se modifica con PATCH /api/funciones/{id}/estado
 *           example: en_venta
 *         tarifas:
 *           type: array
 *           items:
 *             $ref: "#/components/schemas/Tarifa"
 *         descuentosHabilitados:
 *           type: array
 *           items:
 *             type: string
 *             enum: [estudiante, infantil, adultoMayor]
 *           example: [estudiante, adultoMayor]
 *     FuncionEntrada:
 *       type: object
 *       required: [eventoId, fecha, hora, tarifas]
 *       description: >
 *         El campo estado no se acepta; toda función se crea programada.
 *         Las tarifas deben cubrir todas las localidades activas y su precio
 *         debe ser mayor cuanto más cerca esté la localidad del escenario.
 *       properties:
 *         eventoId:
 *           type: integer
 *           minimum: 1
 *           example: 1
 *         fecha:
 *           type: string
 *           format: date
 *           description: Formato YYYY-MM-DD, no puede estar en el pasado
 *           example: "2027-03-20"
 *         hora:
 *           type: string
 *           description: Formato HH:MM entre 00:00 y 23:59
 *           example: "19:00"
 *         tarifas:
 *           type: array
 *           minItems: 1
 *           items:
 *             $ref: "#/components/schemas/Tarifa"
 *         descuentosHabilitados:
 *           type: array
 *           description: Opcional y sin duplicados
 *           items:
 *             type: string
 *             enum: [estudiante, infantil, adultoMayor]
 *           example: [estudiante]
 *     FuncionParcial:
 *       type: object
 *       description: Al menos un campo. Los no enviados conservan su valor.
 *       properties:
 *         eventoId:
 *           type: integer
 *         fecha:
 *           type: string
 *           format: date
 *         hora:
 *           type: string
 *         tarifas:
 *           type: array
 *           items:
 *             $ref: "#/components/schemas/Tarifa"
 *         descuentosHabilitados:
 *           type: array
 *           items:
 *             type: string
 *             enum: [estudiante, infantil, adultoMayor]
 *     EstadoFuncion:
 *       type: object
 *       required: [estado]
 *       description: >
 *         Transiciones permitidas: programada a en_venta o cancelada;
 *         en_venta a agotada, en_curso o cancelada; agotada a en_curso o
 *         cancelada; en_curso a finalizada. Los estados finalizada y
 *         cancelada son terminales.
 *       properties:
 *         estado:
 *           type: string
 *           enum: [programada, en_venta, agotada, en_curso, finalizada, cancelada]
 *           example: en_venta
 *     TarifasDeFuncion:
 *       type: object
 *       properties:
 *         funcionId:
 *           type: integer
 *           example: 1
 *         eventoId:
 *           type: integer
 *           example: 1
 *         fecha:
 *           type: string
 *           format: date
 *           example: "2027-02-18"
 *         hora:
 *           type: string
 *           example: "19:00"
 *         estado:
 *           type: string
 *           example: en_venta
 *         tarifas:
 *           type: array
 *           description: Ordenadas por cercanía al escenario
 *           items:
 *             $ref: "#/components/schemas/TarifaDetallada"
 *         descuentosHabilitados:
 *           type: array
 *           items:
 *             type: string
 *     RespuestaFuncion:
 *       type: object
 *       properties:
 *         mensaje:
 *           type: string
 *           example: Función creada correctamente
 *         funcion:
 *           $ref: "#/components/schemas/Funcion"
 */

// ========================================
// GET /api/funciones
// ========================================
/**
 * @openapi
 * /api/funciones:
 *   get:
 *     tags: [Funciones]
 *     summary: Lista todas las funciones
 *     responses:
 *       200:
 *         description: Listado de funciones
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: "#/components/schemas/Funcion"
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
router.get("/", funcionesController.obtenerFunciones);

// ========================================
// GET /api/funciones/evento/:eventoId
// ========================================
/**
 * @openapi
 * /api/funciones/evento/{eventoId}:
 *   get:
 *     tags: [Funciones]
 *     summary: Lista las funciones de un evento
 *     parameters:
 *       - in: path
 *         name: eventoId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *     responses:
 *       200:
 *         description: Funciones del evento
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: "#/components/schemas/Funcion"
 *       400:
 *         description: eventoId inválido
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
router.get(
  "/evento/:eventoId",
  validarEventoIdFuncion,
  validar,
  funcionesController.obtenerFuncionesPorEvento
);

// ========================================
// GET /api/funciones/:id/tarifas
// ========================================
/**
 * @openapi
 * /api/funciones/{id}/tarifas:
 *   get:
 *     tags: [Funciones]
 *     summary: Precios por localidad y descuentos habilitados de una función
 *     description: Las tarifas se devuelven ordenadas por cercanía al escenario.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *     responses:
 *       200:
 *         description: Cuadro de tarifas de la función
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/TarifasDeFuncion"
 *       400:
 *         description: Id inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorValidacion"
 *       404:
 *         description: Función no encontrada
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
  "/:id/tarifas",
  validarIdFuncion,
  validar,
  funcionesController.obtenerTarifasDeFuncion
);

// ========================================
// GET /api/funciones/:id
// ========================================
/**
 * @openapi
 * /api/funciones/{id}:
 *   get:
 *     tags: [Funciones]
 *     summary: Obtiene una función por su id
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *     responses:
 *       200:
 *         description: Función encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Funcion"
 *       400:
 *         description: Id inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorValidacion"
 *       404:
 *         description: Función no encontrada
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
router.get("/:id", validarIdFuncion, validar, funcionesController.obtenerFuncionPorId);

// ========================================
// POST /api/funciones
// ========================================
/**
 * @openapi
 * /api/funciones:
 *   post:
 *     tags: [Funciones]
 *     summary: Crea una función
 *     description: La función se crea siempre en estado programada.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/FuncionEntrada"
 *     responses:
 *       201:
 *         description: Función creada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/RespuestaFuncion"
 *       400:
 *         description: Datos inválidos, el evento no existe o una localidad no existe
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorValidacion"
 *       409:
 *         description: >
 *           Evento inactivo, fecha en el pasado, choque de agenda de la sala,
 *           tarifas duplicadas o faltantes, o precios incoherentes con la
 *           cercanía al escenario
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
router.post("/", validarCreacionFuncion, validar, funcionesController.crearFuncion);

// ========================================
// PUT /api/funciones/:id
// ========================================
/**
 * @openapi
 * /api/funciones/{id}:
 *   put:
 *     tags: [Funciones]
 *     summary: Reemplaza por completo una función
 *     description: El estado conserva su valor actual.
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
 *             $ref: "#/components/schemas/FuncionEntrada"
 *     responses:
 *       200:
 *         description: Función actualizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/RespuestaFuncion"
 *       400:
 *         description: Datos inválidos, el evento no existe o una localidad no existe
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorValidacion"
 *       404:
 *         description: Función no encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       409:
 *         description: >
 *           La función está en curso, finalizada o cancelada, o incumple
 *           alguna regla de negocio
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
  validarIdFuncion,
  validarActualizacionFuncion,
  validar,
  funcionesController.actualizarFuncion
);

// ========================================
// PATCH /api/funciones/:id/estado
// ========================================
/**
 * @openapi
 * /api/funciones/{id}/estado:
 *   patch:
 *     tags: [Funciones]
 *     summary: Cambia el estado de una función
 *     description: >
 *       Único endpoint que modifica el estado. Solo admite las transiciones
 *       de la máquina de estados, y pasar a en_venta exige que el cuadro de
 *       tarifas esté completo y sea coherente.
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
 *             $ref: "#/components/schemas/EstadoFuncion"
 *     responses:
 *       200:
 *         description: Estado de la función actualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/RespuestaFuncion"
 *       400:
 *         description: Datos de entrada inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorValidacion"
 *       404:
 *         description: Función no encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       409:
 *         description: Transición no permitida o tarifas incompletas para poner en venta
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
  validarIdFuncion,
  validarEstadoFuncion,
  validar,
  funcionesController.cambiarEstadoFuncion
);

// ========================================
// PATCH /api/funciones/:id
// ========================================
/**
 * @openapi
 * /api/funciones/{id}:
 *   patch:
 *     tags: [Funciones]
 *     summary: Actualiza parcialmente una función
 *     description: >
 *       Las reglas de negocio se comprueban sobre cómo queda la función
 *       después del cambio, no solo sobre los campos enviados.
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
 *             $ref: "#/components/schemas/FuncionParcial"
 *     responses:
 *       200:
 *         description: Función actualizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/RespuestaFuncion"
 *       400:
 *         description: Datos inválidos o cuerpo sin campos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorValidacion"
 *       404:
 *         description: Función no encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       409:
 *         description: >
 *           La función está en curso, finalizada o cancelada, o incumple
 *           alguna regla de negocio
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
  validarIdFuncion,
  validarFuncionParcial,
  validar,
  funcionesController.actualizarFuncionParcial
);

// ========================================
// DELETE /api/funciones/:id
// ========================================
/**
 * @openapi
 * /api/funciones/{id}:
 *   delete:
 *     tags: [Funciones]
 *     summary: Elimina una función
 *     description: No se puede eliminar una función con boletas vendidas.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *     responses:
 *       200:
 *         description: Función eliminada
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
 *         description: Función no encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       409:
 *         description: La función tiene boletas vendidas
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
  validarIdFuncion,
  validar,
  funcionesController.eliminarFuncion
);

// ========================================
// Exportaciones
// ========================================
module.exports = router;
