// ========================================
// Importaciones
// ========================================
const express = require("express");

const router = express.Router();

// ========================================
// GET /api/seguridad/cliente
// Devuelve el cliente que validarApiKey dejó en req.clienteApi
// ========================================
/**
 * @openapi
 * /api/seguridad/cliente:
 *   get:
 *     tags: [Seguridad]
 *     summary: Obtiene el cliente autenticado
 *     description: >
 *       Devuelve la identidad asociada a la API Key enviada en la cabecera
 *       X-API-Key. La URL es la misma para todos los clientes; lo que cambia
 *       la respuesta es la clave.
 *     responses:
 *       200:
 *         description: Cliente autenticado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 mensaje:
 *                   type: string
 *                   example: Cliente autenticado
 *                 cliente:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     nombre:
 *                       type: string
 *                       example: Postman Laboratorio
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
 *       429:
 *         description: Demasiadas peticiones
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 */
router.get("/cliente", (req, res) => {
  res.status(200).json({
    mensaje: "Cliente autenticado",
    cliente: req.clienteApi
  });
});

// ========================================
// Exportaciones
// ========================================
module.exports = router;
