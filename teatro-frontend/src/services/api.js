import { solicitudSegura } from "./seguridad.service";

// ========================================
// Inicio de sesión
// ========================================
// El login es público: no lleva token ni API Key. Si la respuesta no trae las
// dos piezas que el panel necesita, se trata como un fallo y no como un
// acceso a medias.
export async function iniciarSesion(email, password) {
  const datos = await solicitudSegura("/api/auth/login", {
    method: "POST",
    body: { email, password }
  });

  if (!datos.token || !datos.usuario) {
    throw new Error("La respuesta de autenticación está incompleta.");
  }

  return datos;
}

// ========================================
// Registro público
// Solo nombre, correo y contraseña: el rol lo pone el servidor
// ========================================
export const registrarAsistente = ({ nombre, email, password }) =>
  solicitudSegura("/api/auth/registro", { method: "POST", body: { nombre, email, password } });
