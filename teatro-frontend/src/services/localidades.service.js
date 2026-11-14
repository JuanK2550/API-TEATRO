import { consultarRecurso, crearRecurso, modificarRecurso, reemplazarRecurso } from "./recursos.service";

// ========================================
// Localidades
// La capacidad la calcula el servidor; nunca se envía
// ========================================
export const listarLocalidades = (token, signal) => consultarRecurso("/api/localidades", token, signal);
export const crearLocalidad = (datos, token) => crearRecurso("/api/localidades", datos, token);
export const actualizarLocalidad = (id, datos, token) => reemplazarRecurso(`/api/localidades/${id}`, datos, token);
export const cambiarEstadoLocalidad = (id, activa, token) =>
  modificarRecurso(`/api/localidades/${id}/estado`, { activa }, token);
