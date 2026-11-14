import { solicitudSegura } from "./seguridad.service";

// ========================================
// Operaciones genéricas sobre un recurso
// ========================================
export const consultarRecurso = (ruta, token, signal) => solicitudSegura(ruta, { token, signal });

export const crearRecurso = (ruta, datos, token) =>
  solicitudSegura(ruta, { token, method: "POST", body: datos });

export const reemplazarRecurso = (ruta, datos, token) =>
  solicitudSegura(ruta, { token, method: "PUT", body: datos });

export const modificarRecurso = (ruta, datos, token) =>
  solicitudSegura(ruta, { token, method: "PATCH", body: datos });

export const eliminarRecurso = (ruta, token) =>
  solicitudSegura(ruta, { token, method: "DELETE" });
