import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { restablecerConCodigo } from "../services/seguridad.service";
import MarcoAcceso from "../components/MarcoAcceso";
import CamposPasswordNueva from "../components/CamposPasswordNueva";
import { problemaPasswordNueva } from "../utils/password";

// ========================================
// Recuperar el acceso con un código de respaldo
// ========================================
export default function RecuperarPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
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
      await restablecerConCodigo({
        email: email.trim(),
        codigo: codigo.trim().toUpperCase(),
        passwordNueva: nueva,
        confirmarPassword: confirmacion
      });
      navigate("/login", {
        replace: true,
        state: { aviso: "Contraseña restablecida con tu código de respaldo. Ese código ya no sirve: inicia sesión con la nueva." }
      });
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <MarcoAcceso
      titulo="Recuperar el acceso"
      descripcion="Escribe tu correo y uno de los ocho códigos de respaldo que guardaste. Cada código sirve una sola vez."
    >
      {error && (
        <div className="aviso aviso-error" role="alert">
          {error}
        </div>
      )}
      <form onSubmit={enviar} noValidate>
        <div className="mb-3">
          <label className="form-label" htmlFor="recuperar-email">Correo electrónico</label>
          <input
            id="recuperar-email"
            className="form-control"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="mb-3">
          <label className="form-label" htmlFor="recuperar-codigo">Código de respaldo</label>
          <input
            id="recuperar-codigo"
            className="form-control campo-secreto"
            type="text"
            autoComplete="one-time-code"
            spellCheck="false"
            placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
            required
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
          />
        </div>
        <CamposPasswordNueva
          prefijo="recuperar"
          nueva={nueva}
          confirmacion={confirmacion}
          alCambiarNueva={setNueva}
          alCambiarConfirmacion={setConfirmacion}
        />
        <button className="btn btn-primary w-100 py-2 mt-2" type="submit" disabled={enviando || !email || !codigo}>
          {enviando ? "Restableciendo…" : "Restablecer contraseña"}
        </button>
      </form>
      <div className="acceso-enlaces">
        <Link to="/restablecer-token">No tengo códigos: me dieron un token administrativo</Link>
        <Link to="/login">Volver al inicio de sesión</Link>
      </div>
    </MarcoAcceso>
  );
}
