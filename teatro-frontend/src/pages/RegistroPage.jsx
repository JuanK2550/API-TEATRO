import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { registrarAsistente } from "../services/api";
import { problemaPasswordNueva } from "../utils/password";
import MarcoAcceso from "../components/MarcoAcceso";
import CamposPasswordNueva from "../components/CamposPasswordNueva";

// ========================================
// Registro de asistentes
// El rol no se elige: el servidor crea siempre una cuenta de asistente
// ========================================
export default function RegistroPage() {
  const { autenticado, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  if (autenticado) return <Navigate to={location.state?.volverA ?? "/panel/mi-perfil"} replace />;

  async function enviar(evento) {
    evento.preventDefault();
    const problema = problemaPasswordNueva(password, confirmacion);
    if (problema) {
      setError(problema);
      return;
    }

    setError("");
    setEnviando(true);
    try {
      await registrarAsistente({ nombre: nombre.trim(), email: email.trim(), password });
      await login(email.trim(), password);
      navigate(location.state?.volverA ?? "/panel/mi-perfil", { replace: true });
    } catch (fallo) {
      setError(fallo.message);
      setEnviando(false);
    }
  }

  return (
    <MarcoAcceso titulo="Crear una cuenta" descripcion="Con tu cuenta compras boletas, las pagas y las ves todas en un mismo sitio.">
      {error && (
        <div className="aviso aviso-error" role="alert">
          {error}
        </div>
      )}
      <form onSubmit={enviar} noValidate>
        <div className="mb-3">
          <label className="form-label" htmlFor="registro-nombre">Nombre completo</label>
          <input id="registro-nombre" className="form-control" autoComplete="name" required minLength={3} maxLength={100} value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="form-label" htmlFor="registro-email">Correo electrónico</label>
          <input id="registro-email" className="form-control" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <CamposPasswordNueva prefijo="registro" etiqueta="Contraseña" nueva={password} confirmacion={confirmacion} alCambiarNueva={setPassword} alCambiarConfirmacion={setConfirmacion} />
        <button className="btn btn-primary w-100 py-2 mt-2" type="submit" disabled={enviando || !nombre || !email}>
          {enviando ? "Creando la cuenta…" : "Crear cuenta"}
        </button>
      </form>
      <div className="acceso-enlaces">
        <Link to="/login" state={location.state}>Ya tengo cuenta: entrar</Link>
        <Link to="/">Volver a la cartelera</Link>
      </div>
    </MarcoAcceso>
  );
}
