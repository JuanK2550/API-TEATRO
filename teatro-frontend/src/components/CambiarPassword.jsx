import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { cambiarPassword } from "../services/seguridad.service";
import { guardarAvisoDeSesion } from "../services/sesion-expirada";
import { problemaPasswordNueva } from "../utils/password";
import CamposPasswordNueva from "./CamposPasswordNueva";
import Aviso from "./Aviso";

// ========================================
// Cambiar mi contraseña
// Al terminar, todas las sesiones de la cuenta quedan revocadas
// ========================================
export default function CambiarPassword() {
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [mensaje, setMensaje] = useState(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento) {
    evento.preventDefault();
    const problema = problemaPasswordNueva(nueva, confirmacion);
    if (problema) {
      setMensaje({ tipo: "error", texto: problema });
      return;
    }

    setEnviando(true);
    setMensaje(null);
    try {
      await cambiarPassword({ passwordActual: actual, passwordNueva: nueva, confirmarPassword: confirmacion }, token);
      // El token de esta pestaña ya no sirve: la versión de sesión subió.
      guardarAvisoDeSesion("Contraseña cambiada. Se cerraron todas tus sesiones: entra con la nueva.");
      navigate("/login", { replace: true });
      logout();
    } catch (fallo) {
      setMensaje({ tipo: "error", texto: fallo.message });
      setEnviando(false);
    }
  }

  return (
    <section className="tarjeta modulo" aria-labelledby="password-titulo">
      <div className="modulo-cabecera">
        <div>
          <h2 id="password-titulo">Cambiar mi contraseña</h2>
          <p>Por seguridad, al terminar se cierran todas tus sesiones abiertas, incluida esta.</p>
        </div>
      </div>

      <Aviso mensaje={mensaje} alCerrar={() => setMensaje(null)} />

      <form onSubmit={enviar} className="formulario-password" noValidate>
        <div className="mb-3">
          <label className="form-label" htmlFor="password-actual">Contraseña actual</label>
          <input id="password-actual" className="form-control" type="password" autoComplete="current-password" required value={actual} onChange={(e) => setActual(e.target.value)} />
        </div>
        <CamposPasswordNueva prefijo="password" nueva={nueva} confirmacion={confirmacion} alCambiarNueva={setNueva} alCambiarConfirmacion={setConfirmacion} />
        <div className="formulario-botones">
          <button className="btn btn-primary" type="submit" disabled={enviando || !actual}>
            {enviando ? "Actualizando…" : "Actualizar contraseña"}
          </button>
          <Link className="btn btn-outline-secondary" to="/panel">
            Volver
          </Link>
        </div>
      </form>
    </section>
  );
}
