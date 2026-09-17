// ========================================
// Importaciones
// ========================================
const express = require("express");

const boletasController = require("../controllers/boletas.controller");
const { validar } = require("../middlewares/validar.middleware");
const {
  validarIdBoleta,
  validarAsistenteIdBoleta,
  validarFuncionIdBoleta,
  validarCreacionBoleta,
  validarActualizacionBoleta,
  validarBoletaParcial,
  validarEstadoBoleta
} = require("../middlewares/boletas.validator");

const router = express.Router();

// ========================================
// Esquemas de documentación
// ========================================
/**
 * @openapi
 * components:
 *   schemas:
 *     Boleta:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         asistenteId:
 *           type: integer
 *           example: 1
 *         funcionId:
 *           type: integer
 *           example: 1
 *         localidadId:
 *           type: integer
 *           example: 1
 *         fila:
 *           type: integer
 *           example: 2
 *         numero:
 *           type: integer
 *           example: 7
 *         tipoDescuento:
 *           type: string
 *           enum: [ninguno, estudiante, infantil, adultoMayor]
 *           example: ninguno
 *         precio:
 *           type: integer
 *           description: >
 *             Calculado por la API a partir de la tarifa de la localidad en
 *             esa función menos el porcentaje del descuento. Nunca proviene
 *             del cliente.
 *           example: 75000
 *         codigo:
 *           type: string
 *           description: Generado por la API, único
 *           example: BOL-2026-0001
 *         estado:
 *           type: string
 *           enum: [reservada, pagada, usada, cancelada]
 *           description: Solo se modifica con PATCH /api/boletas/{id}/estado
 *           example: pagada
 *     BoletaEntrada:
 *       type: object
 *       required: [asistenteId, funcionId, localidadId, fila, numero]
 *       description: >
 *         Los campos precio, codigo y estado son administrados por la API y
 *         se ignoran si el cliente los envía. El precio se calcula a partir
 *         de la tarifa de la función, el código se genera con el formato
 *         BOL-<año>-<consecutivo> y toda boleta nace en estado reservada.
 *       properties:
 *         asistenteId:
 *           type: integer
 *           minimum: 1
 *           example: 1
 *         funcionId:
 *           type: integer
 *           minimum: 1
 *           description: La función debe estar en estado en_venta
 *           example: 1
 *         localidadId:
 *           type: integer
 *           minimum: 1
 *           description: Debe estar activa y tener tarifa en esa función
 *           example: 1
 *         fila:
 *           type: integer
 *           minimum: 1
 *           description: No puede superar las filas de la localidad
 *           example: 2
 *         numero:
 *           type: integer
 *           minimum: 1
 *           description: No puede superar las butacas por fila de la localidad
 *           example: 7
 *         tipoDescuento:
 *           type: string
 *           enum: [ninguno, estudiante, infantil, adultoMayor]
 *           description: >
 *             Opcional, por defecto ninguno. Si no es ninguno, debe estar en
 *             los descuentos habilitados de la función.
 *           example: estudiante
 *     BoletaParcial:
 *       type: object
 *       description: >
 *         Al menos un campo. Los no enviados conservan su valor. El precio se
 *         recalcula siempre. Los campos precio, codigo y estado siguen siendo
 *         administrados por la API.
 *       properties:
 *         asistenteId:
 *           type: integer
 *         funcionId:
 *           type: integer
 *         localidadId:
 *           type: integer
 *         fila:
 *           type: integer
 *         numero:
 *           type: integer
 *         tipoDescuento:
 *           type: string
 *           enum: [ninguno, estudiante, infantil, adultoMayor]
 *     EstadoBoleta:
 *       type: object
 *       required: [estado]
 *       description: >
 *         Transiciones permitidas: reservada a pagada o cancelada; pagada a
 *         usada o cancelada. Los estados usada y cancelada son terminales.
 *         Pasar a usada exige además que la función esté en curso.
 *       properties:
 *         estado:
 *           type: string
 *           enum: [reservada, pagada, usada, cancelada]
 *           example: pagada
 *     RespuestaBoleta:
 *       type: object
 *       properties:
 *         mensaje:
 *           type: string
 *           example: Boleta creada correctamente
 *         boleta:
 *           $ref: "#/components/schemas/Boleta"
 */

// ========================================
// GET /api/boletas
// ========================================
/**
 * @openapi
 * /api/boletas:
 *   get:
 *     tags: [Boletas]
 *     summary: Lista todas las boletas
 *     responses:
 *       200:
 *         description: Listado de boletas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: "#/components/schemas/Boleta"
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
router.get("/", boletasController.obtenerBoletas);

// ========================================
// GET /api/boletas/asistente/:asistenteId
// ========================================
/**
 * @openapi
 * /api/boletas/asistente/{asistenteId}:
 *   get:
 *     tags: [Boletas]
 *     summary: Lista las boletas de un asistente
 *     parameters:
 *       - in: path
 *         name: asistenteId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *     responses:
 *       200:
 *         description: Boletas del asistente
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: "#/components/schemas/Boleta"
 *       400:
 *         description: asistenteId inválido
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
 */
router.get(
  "/asistente/:asistenteId",
  validarAsistenteIdBoleta,
  validar,
  boletasController.obtenerBoletasPorAsistente
);

// ========================================
// GET /api/boletas/funcion/:funcionId
// ========================================
/**
 * @openapi
 * /api/boletas/funcion/{funcionId}:
 *   get:
 *     tags: [Boletas]
 *     summary: Lista las boletas de una función
 *     parameters:
 *       - in: path
 *         name: funcionId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *     responses:
 *       200:
 *         description: Boletas de la función
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: "#/components/schemas/Boleta"
 *       400:
 *         description: funcionId inválido
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
  "/funcion/:funcionId",
  validarFuncionIdBoleta,
  validar,
  boletasController.obtenerBoletasPorFuncion
);

// ========================================
// GET /api/boletas/:id
// ========================================
/**
 * @openapi
 * /api/boletas/{id}:
 *   get:
 *     tags: [Boletas]
 *     summary: Obtiene una boleta por su id
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *     responses:
 *       200:
 *         description: Boleta encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Boleta"
 *       400:
 *         description: Id inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorValidacion"
 *       404:
 *         description: Boleta no encontrada
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
router.get("/:id", validarIdBoleta, validar, boletasController.obtenerBoletaPorId);

// ========================================
// POST /api/boletas
// ========================================
/**
 * @openapi
 * /api/boletas:
 *   post:
 *     tags: [Boletas]
 *     summary: Vende una boleta
 *     description: >
 *       La boleta nace reservada, con el precio calculado por la API y un
 *       código generado automáticamente.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/BoletaEntrada"
 *     responses:
 *       201:
 *         description: Boleta creada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/RespuestaBoleta"
 *       400:
 *         description: >
 *           Datos inválidos, o el asistente, la función o la localidad
 *           indicados no existen
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorValidacion"
 *       409:
 *         description: >
 *           La función no está en venta, la localidad está inactiva o sin
 *           tarifa, la butaca no existe o está ocupada, el descuento no está
 *           habilitado, se alcanzó el aforo o se superó el límite por asistente
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
router.post("/", validarCreacionBoleta, validar, boletasController.crearBoleta);

// ========================================
// PUT /api/boletas/:id
// ========================================
/**
 * @openapi
 * /api/boletas/{id}:
 *   put:
 *     tags: [Boletas]
 *     summary: Reemplaza por completo una boleta
 *     description: >
 *       Solo se puede modificar una boleta reservada. El código y el estado
 *       se conservan, y el precio se recalcula.
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
 *             $ref: "#/components/schemas/BoletaEntrada"
 *     responses:
 *       200:
 *         description: Boleta actualizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/RespuestaBoleta"
 *       400:
 *         description: Datos inválidos o alguna entidad relacionada no existe
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorValidacion"
 *       404:
 *         description: Boleta no encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       409:
 *         description: La boleta no está reservada, o incumple alguna regla de negocio
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
  validarIdBoleta,
  validarActualizacionBoleta,
  validar,
  boletasController.actualizarBoleta
);

// ========================================
// PATCH /api/boletas/:id/estado
// ========================================
/**
 * @openapi
 * /api/boletas/{id}/estado:
 *   patch:
 *     tags: [Boletas]
 *     summary: Cambia el estado de una boleta
 *     description: >
 *       Único endpoint que modifica el estado. Solo admite las transiciones
 *       de la máquina de estados. Marcar una boleta como usada exige que su
 *       función esté en curso, y una boleta ya usada no se puede volver a
 *       marcar.
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
 *             $ref: "#/components/schemas/EstadoBoleta"
 *     responses:
 *       200:
 *         description: Estado de la boleta actualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/RespuestaBoleta"
 *       400:
 *         description: Datos de entrada inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorValidacion"
 *       404:
 *         description: Boleta no encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       409:
 *         description: Transición no permitida o la función no está en curso
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
  validarIdBoleta,
  validarEstadoBoleta,
  validar,
  boletasController.cambiarEstadoBoleta
);

// ========================================
// PATCH /api/boletas/:id
// ========================================
/**
 * @openapi
 * /api/boletas/{id}:
 *   patch:
 *     tags: [Boletas]
 *     summary: Actualiza parcialmente una boleta
 *     description: >
 *       Solo se puede modificar una boleta reservada. Las reglas se
 *       comprueban sobre cómo queda la boleta después del cambio, y el
 *       precio se recalcula.
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
 *             $ref: "#/components/schemas/BoletaParcial"
 *     responses:
 *       200:
 *         description: Boleta actualizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/RespuestaBoleta"
 *       400:
 *         description: Datos inválidos o cuerpo sin campos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorValidacion"
 *       404:
 *         description: Boleta no encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       409:
 *         description: La boleta no está reservada, o incumple alguna regla de negocio
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
  validarIdBoleta,
  validarBoletaParcial,
  validar,
  boletasController.actualizarBoletaParcial
);

// ========================================
// DELETE /api/boletas/:id
// ========================================
/**
 * @openapi
 * /api/boletas/{id}:
 *   delete:
 *     tags: [Boletas]
 *     summary: Elimina una boleta
 *     description: Solo se pueden eliminar boletas reservadas o canceladas.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *     responses:
 *       200:
 *         description: Boleta eliminada
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
 *         description: Boleta no encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       409:
 *         description: La boleta está pagada o usada
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
  validarIdBoleta,
  validar,
  boletasController.eliminarBoleta
);

// ========================================
// Exportaciones
// ========================================
module.exports = router;
