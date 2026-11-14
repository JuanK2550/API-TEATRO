import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { restablecerConTokenAdmin } from "../services/seguridad.service";
import MarcoAcceso from "../components/MarcoAcceso";
import CamposPasswordNueva from "../components/CamposPasswordNueva";
import { problemaPasswordNueva } from "../utils/password";

// ========================================
// Restablecer con el token que entregó el administrador
// ========================================
export default function RestablecerTokenPage() {
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  async function enviar(evento) {
    evento.preventDefault();
    const problema = problemaPasswordNueva(nueva, confirmacion);
    if (problema) {
      setError(problema);
      return;
    }

    setError("");
    setEnviando(true);
    try {
      await restablecerConTokenAdmin({
        token: token.trim(),
        passwordNueva: nueva,
        confirmarPassword: confirmacion
      });
      navigate("/login", {
        replace: true,
        state: { aviso: "Contraseña restablecida mediante recuperación administrativa. Inicia sesión con la nueva." }
      });
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <MarcoAcceso
      titulo="Recuperación administrativa"
      descripcion="Pega el token temporal que te entregó el administrador después de verificar tu identidad. Vence a los 15 minutos."
    >
      {error && (
        <div className="aviso aviso-error" role="alert">
          {error}
        </div>
      )}
      <form onSubmit={enviar} noValidate>
        <div className="mb-3">
          <label className="form-label" htmlFor="restablecer-token">Token temporal</label>
          <textarea
            id="restablecer-token"
            className="form-control campo-secreto"
            rows={3}
            spellCheck="false"
            autoComplete="off"
            required
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
        </div>
        <CamposPasswordNueva
          prefijo="restablecer"
          nueva={nueva}
          confirmacion={confirmacion}
          alCambiarNueva={setNueva}
          alCambiarConfirmacion={setConfirmacion}
        />
        <button className="btn btn-primary w-100 py-2 mt-2" type="submit" disabled={enviando || !token}>
          {enviando ? "Restableciendo…" : "Restablecer contraseña"}
        </button>
      </form>
      <div className="acceso-enlaces">
        <Link to="/login">Volver al inicio de sesión</Link>
      </div>
    </MarcoAcceso>
  );
}
