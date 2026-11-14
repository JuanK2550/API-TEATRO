import { consultarRecurso, crearRecurso, modificarRecurso, reemplazarRecurso } from "./recursos.service";

// ========================================
// Usuarios
// Gestión reservada al administrador; el backend lo vuelve a comprobar
// ========================================
export function listarUsuarios({ q = "", rol = "", activo = "", pagina = 1 }, token, signal) {
  const parametros = new URLSearchParams();
  if (q.trim()) parametros.set("q", q.trim());
  if (rol) parametros.set("rol", rol);
  if (activo) parametros.set("activo", activo);
  parametros.set("pagina", String(pagina));

  return consultarRecurso(`/api/usuarios?${parametros}`, token, signal);
}

export const crearUsuario = (datos, token) => crearRecurso("/api/usuarios", datos, token);
export const actualizarUsuario = (id, datos, token) => reemplazarRecurso(`/api/usuarios/${id}`, datos, token);
export const cambiarEstadoUsuario = (id, activo, token) =>
  modificarRecurso(`/api/usuarios/${id}/estado`, { activo }, token);
