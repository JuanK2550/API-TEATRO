// ========================================
// Importaciones
// ========================================
const express = require("express");

const estadisticasController = require("../controllers/estadisticas.controller");
const autenticarJWT = require("../middlewares/auth.middleware");
const autorizarRoles = require("../middlewares/roles.middleware");

const router = express.Router();

// ========================================
// Esquemas de documentación
// ========================================
/**
 * @openapi
 * components:
 *   schemas:
 *     ResumenTeatro:
 *       type: object
 *       description: >
 *         Totales agregados del teatro. Ningún campo identifica a una persona.
 *       properties:
 *         resumen:
 *           type: object
 *           properties:
 *             usuarios: { type: integer, example: 12 }
 *             eventos: { type: integer, example: 11 }
 *             funciones: { type: integer, example: 16 }
 *             localidades: { type: integer, example: 3 }
 *             asistentes: { type: integer, example: 5 }
 *             boletas: { type: integer, example: 7 }
 *             ingresos:
 *               type: integer
 *               description: Suma en pesos de las boletas pagadas y usadas
 *               example: 245000
 *         boletasPorEstado:
 *           type: object
 *           properties:
 *             reservada: { type: integer }
 *             pagada: { type: integer }
 *             usada: { type: integer }
 *             cancelada: { type: integer }
 *         boletasPorMes:
 *           type: array
 *           description: Boletas no canceladas por mes de la función, los seis últimos con datos
 *           items:
 *             type: object
 *             properties:
 *               mes: { type: string, example: "2027-02" }
 *               total: { type: integer, example: 4 }
 */

// ========================================
// GET /api/estadisticas/resumen
// ========================================
/**
 * @openapi
 * /api/estadisticas/resumen:
 *   get:
 *     tags: [Estadísticas]
 *     summary: Resumen del teatro para el panel administrativo
 *     description: >
 *       Reservado al **administrador**. Solo cifras agregadas: cuántas cuentas,
 *       eventos, funciones, localidades, asistentes y boletas hay, las boletas
 *       por estado y por mes, y los ingresos de las pagadas y usadas.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Resumen calculado en el momento
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ResumenTeatro" }
 *       401:
 *         description: Falta el token, es inválido o fue revocado
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       403:
 *         description: El rol autenticado no es administrador
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 */
router.get(
  "/resumen",
  autenticarJWT,
  autorizarRoles("administrador"),
  estadisticasController.obtenerResumen
);

// ========================================
// Exportaciones
// ========================================
module.exports = router;
