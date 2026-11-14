import { useCallback, useEffect, useMemo, useState } from "react";
import { AuthContext } from "./auth-context";
import { iniciarSesion } from "../services/api";
import { solicitudSegura } from "../services/seguridad.service";
import { EVENTO_SESION_INVALIDA, guardarAvisoDeSesion, borrarAvisoDeSesion } from "../services/sesion-expirada";

// ========================================
// Dónde vive la sesión
// sessionStorage: muere al cerrar la pestaña y no viaja solo en cada petición
// ========================================
const CLAVE = "teatro_sesion_v1";

function expiracionJwt(token) {
  try {
    const carga = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return Number.isFinite(carga.exp) ? carga.exp * 1000 : null;
  } catch {
    return null;
  }
}

function mensajeFinSesion(motivo) {
  if (/expirad/i.test(motivo)) return "Tu sesión expiró por seguridad. Inicia sesión de nuevo.";
  if (/revocad/i.test(motivo)) return "Tu sesión se cerró porque la contraseña cambió. Inicia sesión de nuevo.";
  return "Tu sesión ya no es válida. Inicia sesión de nuevo.";
}

function leerSesion() {
  try {
    const sesion = JSON.parse(sessionStorage.getItem(CLAVE) || "null");
    if (typeof sesion?.token !== "string" || !sesion?.usuario) return null;
    const expira = expiracionJwt(sesion.token);
    if (expira && expira <= Date.now()) return null;
    return sesion;
  } catch {
    return null;
  }
}

// ========================================
// Proveedor
// ========================================
export function AuthProvider({ children }) {
  const [sesion, setSesion] = useState(leerSesion);
  const [tokenVerificado, setTokenVerificado] = useState(null);
  // Si la sesión se cerró a propósito, nadie debe volver a la página de antes:
  // quien entre después puede ser otra persona.
  const [salidaVoluntaria, setSalidaVoluntaria] = useState(false);

  const cerrar = useCallback((voluntaria) => {
    sessionStorage.removeItem(CLAVE);
    setSalidaVoluntaria(voluntaria);
    setSesion(null);
  }, []);

  const logout = useCallback(() => cerrar(true), [cerrar]);

  const invalidarSesion = useCallback(
    (motivo) => {
      guardarAvisoDeSesion(mensajeFinSesion(motivo));
      cerrar(false);
    },
    [cerrar]
  );

  // La caducidad del JWT es absoluta: se programa el cierre para ese instante.
  useEffect(() => {
    if (!sesion?.token) return undefined;
    const tokenActual = sesion.token;
    const expira = expiracionJwt(tokenActual);
    const espera = expira ? Math.max(0, Math.min(expira - Date.now(), 2147483647)) : null;
    const temporizador = espera !== null ? setTimeout(() => invalidarSesion("Token expirado"), espera) : null;

    const alInvalidar = (evento) => {
      if (evento.detail?.token === tokenActual) invalidarSesion(evento.detail.motivo);
    };

    window.addEventListener(EVENTO_SESION_INVALIDA, alInvalidar);
    return () => {
      if (temporizador !== null) clearTimeout(temporizador);
      window.removeEventListener(EVENTO_SESION_INVALIDA, alInvalidar);
    };
  }, [sesion?.token, invalidarSesion]);

  // Al recuperar una sesión guardada se confirma con el servidor: el rol y la
  // vigencia los decide la API, no lo que quedó en el navegador.
  useEffect(() => {
    if (!sesion?.token) return undefined;
    const controlador = new AbortController();
    const tokenActual = sesion.token;

    solicitudSegura("/api/auth/perfil", { token: tokenActual, signal: controlador.signal })
      .then(({ usuario }) => {
        if (!usuario?.id || !usuario?.rol) {
          invalidarSesion("Sesión no válida");
          return;
        }
        setSesion((actual) => {
          if (!actual || actual.token !== tokenActual) return actual;
          const nueva = {
            ...actual,
            usuario: { ...actual.usuario, id: usuario.id, email: usuario.email, rol: usuario.rol }
          };
          sessionStorage.setItem(CLAVE, JSON.stringify(nueva));
          return nueva;
        });
        setTokenVerificado(tokenActual);
      })
      .catch((error) => {
        if (controlador.signal.aborted) return;
        if (error.status === 401) invalidarSesion(error.message);
        else setTokenVerificado(tokenActual);
      });

    return () => controlador.abort();
  }, [sesion?.token, invalidarSesion]);

  const login = useCallback(async (email, password) => {
    const datos = await iniciarSesion(email, password);
    const nueva = { usuario: datos.usuario, token: datos.token };
    borrarAvisoDeSesion();
    sessionStorage.setItem(CLAVE, JSON.stringify(nueva));
    setTokenVerificado(datos.token);
    setSalidaVoluntaria(false);
    setSesion(nueva);
    return datos.usuario;
  }, []);

  const valor = useMemo(
    () => ({
      usuario: sesion?.usuario ?? null,
      token: sesion?.token ?? null,
      autenticado: Boolean(sesion?.token),
      verificando: Boolean(sesion?.token) && tokenVerificado !== sesion.token,
      salidaVoluntaria,
      login,
      logout,
      invalidarSesion
    }),
    [sesion, tokenVerificado, salidaVoluntaria, login, logout, invalidarSesion]
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}
