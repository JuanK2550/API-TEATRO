import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { borrarAvisoDeSesion, leerAvisoDeSesion } from "../services/sesion-expirada";
import MarcoAcceso from "../components/MarcoAcceso";

// ========================================
// Inicio de sesión
// ========================================
export default function LoginPage() {
  const { autenticado, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [aviso] = useState(() => location.state?.aviso || leerAvisoDeSesion());

  useEffect(() => {
    borrarAvisoDeSesion();
  }, []);

  if (autenticado) return <Navigate to={location.state?.volverA ?? "/panel"} replace />;

  async function enviar(evento) {
    evento.preventDefault();
    setError("");
    setEnviando(true);
    try {
      await login(email.trim(), password);
      navigate(location.state?.volverA ?? "/panel", { replace: true });
    } catch (fallo) {
      setError(fallo.message);
      setPassword("");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <MarcoAcceso titulo="Panel del teatro" descripcion="Gestión de la programación, la taquilla y tus boletas.">
      {aviso && (
        <div className={`aviso ${location.state?.aviso ? "aviso-exito" : "aviso-cuidado"}`} role="status">
          {aviso}
        </div>
      )}
      {error && (
        <div className="aviso aviso-error" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={enviar} noValidate>
        <div className="mb-3">
          <label className="form-label" htmlFor="acceso-email">Correo electrónico</label>
          <input
            id="acceso-email"
            className="form-control"
            type="email"
            autoComplete="username"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="mb-4">
          <label className="form-label" htmlFor="acceso-password">Contraseña</label>
          <input
            id="acceso-password"
            className="form-control"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button className="btn btn-primary w-100 py-2" type="submit" disabled={enviando || !email || !password}>
          {enviando ? "Entrando…" : "Iniciar sesión"}
        </button>
      </form>

      <div className="acceso-enlaces">
        <Link to="/registro" state={location.state}>¿No tienes cuenta? Créala</Link>
        <Link to="/recuperar-password">¿Olvidaste tu contraseña? Usa un código de respaldo</Link>
        <Link to="/restablecer-token">Tengo un token de recuperación administrativa</Link>
        <Link to="/">Ver la cartelera</Link>
      </div>
    </MarcoAcceso>
  );
}
