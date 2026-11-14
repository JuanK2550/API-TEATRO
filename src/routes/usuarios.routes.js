// ========================================
// Importaciones
// ========================================
const express = require("express");

const usuariosController = require("../controllers/usuarios.controller");
const autenticarJWT = require("../middlewares/auth.middleware");
const autorizarRoles = require("../middlewares/roles.middleware");
const { validar } = require("../middlewares/validar.middleware");
const {
  validarCreacionUsuario,
  validarIdUsuario,
  validarListadoUsuarios,
  validarBusquedaRecuperacion,
  validarEdicionUsuario,
  validarEstadoUsuario
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
 *     UsuarioFicha:
 *       type: object
 *       description: >
 *         Ficha administrativa de una cuenta. Nunca incluye la contraseña, su
 *         hash ni la versión de sesión.
 *       properties:
 *         id: { type: integer, example: 4 }
 *         nombre: { type: string, example: Taquilla Teatro }
 *         email: { type: string, format: email, example: taquilla@teatro.com }
 *         rol: { type: string, enum: [administrador, taquilla, asistente] }
 *         activo: { type: boolean, example: true }
 *         fechaRegistro: { type: string, format: date-time }
 *     ListadoUsuarios:
 *       type: object
 *       properties:
 *         usuarios:
 *           type: array
 *           items: { $ref: "#/components/schemas/UsuarioFicha" }
 *         total: { type: integer, example: 12 }
 *         pagina: { type: integer, example: 1 }
 *         porPagina: { type: integer, example: 20 }
 *     UsuarioEdicion:
 *       type: object
 *       description: >
 *         Solo nombre y correo. El rol, la contraseña y el estado no se cambian
 *         por esta vía: si llegan en el cuerpo se descartan.
 *       required: [nombre, email]
 *       properties:
 *         nombre: { type: string, minLength: 3, maxLength: 100, example: Taquilla Norte }
 *         email: { type: string, format: email, example: taquilla.norte@teatro.com }
 *     UsuarioEstado:
 *       type: object
 *       required: [activo]
 *       properties:
 *         activo: { type: boolean, example: false }
 *     RespuestaUsuarioFicha:
 *       type: object
 *       properties:
 *         mensaje: { type: string, example: Usuario actualizado correctamente }
 *         usuario: { $ref: "#/components/schemas/UsuarioFicha" }
 */

// ========================================
// GET /api/usuarios
// ========================================
/**
 * @openapi
 * /api/usuarios:
 *   get:
 *     tags: [Usuarios]
 *     summary: Lista las cuentas con filtros y paginación
 *     description: >
 *       Reservado al **administrador**. Veinte cuentas por página, de la más
 *       reciente a la más antigua. La búsqueda compara el texto con el nombre y
 *       el correo sin interpretar comodines.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - { in: query, name: q, schema: { type: string, maxLength: 100 } }
 *       - { in: query, name: rol, schema: { type: string, enum: [administrador, taquilla, asistente] } }
 *       - { in: query, name: activo, schema: { type: string, enum: ["true", "false"] } }
 *       - { in: query, name: pagina, schema: { type: integer, minimum: 1 } }
 *     responses:
 *       200:
 *         description: Página de cuentas
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ListadoUsuarios" }
 *       400:
 *         description: Filtros inválidos
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorValidacion" }
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
  "/",
  autenticarJWT,
  autorizarRoles("administrador"),
  validarListadoUsuarios,
  validar,
  usuariosController.listarUsuarios
);

// ========================================
// GET /api/usuarios/busqueda-recuperacion
// ========================================
/**
 * @openapi
 * /api/usuarios/busqueda-recuperacion:
 *   get:
 *     tags: [Usuarios]
 *     summary: Busca cuentas activas para la recuperación administrativa
 *     description: >
 *       Reservado al **administrador**. Devuelve como máximo veinte cuentas
 *       activas con id, nombre, correo y rol: lo justo para elegir a quién
 *       emitir el token, sin ningún dato más.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string, minLength: 2, maxLength: 100 }
 *     responses:
 *       200:
 *         description: Coincidencias
 *       400:
 *         description: Búsqueda de menos de 2 o más de 100 caracteres
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorValidacion" }
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
  "/busqueda-recuperacion",
  autenticarJWT,
  autorizarRoles("administrador"),
  validarBusquedaRecuperacion,
  validar,
  usuariosController.buscarParaRecuperacion
);

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
 *       - BearerAuth: []
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
 *         description: Falta el token, es inválido o fue revocado
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
// PUT /api/usuarios/:id
// ========================================
/**
 * @openapi
 * /api/usuarios/{id}:
 *   put:
 *     tags: [Usuarios]
 *     summary: Edita el nombre y el correo de una cuenta
 *     description: >
 *       Reservado al **administrador**. No cambia el rol, la contraseña ni el
 *       estado: esos campos se descartan si llegan en el cuerpo.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer, minimum: 1 } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: "#/components/schemas/UsuarioEdicion" }
 *     responses:
 *       200:
 *         description: Cuenta actualizada
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/RespuestaUsuarioFicha" }
 *       400:
 *         description: Datos de entrada inválidos
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorValidacion" }
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
 *       404:
 *         description: Usuario no encontrado
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       409:
 *         description: Ya existe un usuario con ese correo electrónico
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 */
router.put(
  "/:id",
  autenticarJWT,
  autorizarRoles("administrador"),
  validarIdUsuario,
  validarEdicionUsuario,
  validar,
  usuariosController.actualizarUsuario
);

// ========================================
// PATCH /api/usuarios/:id/estado
// ========================================
/**
 * @openapi
 * /api/usuarios/{id}/estado:
 *   patch:
 *     tags: [Usuarios]
 *     summary: Activa o desactiva una cuenta
 *     description: >
 *       Reservado al **administrador**. Desactivar sube la versión de sesión,
 *       así que los tokens de esa cuenta dejan de servir en la siguiente
 *       petición. Nadie puede desactivarse a sí mismo, y no se puede dejar el
 *       sistema sin ningún administrador activo.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer, minimum: 1 } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: "#/components/schemas/UsuarioEstado" }
 *     responses:
 *       200:
 *         description: Estado actualizado
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/RespuestaUsuarioFicha" }
 *       400:
 *         description: activo no es un booleano
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorValidacion" }
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
 *       404:
 *         description: Usuario no encontrado
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       409:
 *         description: Desactivar la propia cuenta o al último administrador activo
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 */
router.patch(
  "/:id/estado",
  autenticarJWT,
  autorizarRoles("administrador"),
  validarIdUsuario,
  validarEstadoUsuario,
  validar,
  usuariosController.cambiarEstadoUsuario
);

// ========================================
// Exportaciones
// ========================================
module.exports = router;
