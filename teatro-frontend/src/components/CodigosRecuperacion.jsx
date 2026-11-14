import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useDatos } from "../hooks/useDatos";
import { estadoCodigos, generarCodigos, regenerarCodigos } from "../services/seguridad.service";
import Aviso from "./Aviso";

// ========================================
// Códigos de recuperación
// Se ven una sola vez; después solo queda su huella en el servidor
// ========================================
export default function CodigosRecuperacion() {
  const { token, usuario } = useAuth();
  const [password, setPassword] = useState("");
  const [codigos, setCodigos] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback((signal) => estadoCodigos(token, signal), [token]);
  const { datos, cargando, recargar } = useDatos(cargar);
  const disponibles = datos?.disponibles ?? 0;

  async function emitir(evento) {
    evento.preventDefault();
    if (disponibles > 0 && !window.confirm("Generar un lote nuevo anula todos los códigos que tienes ahora. ¿Continuar?")) return;
    setEnviando(true);
    setMensaje(null);
    try {
      const respuesta = disponibles > 0 ? await regenerarCodigos(password, token) : await generarCodigos(password, token);
      setCodigos(respuesta.codigos);
      setPassword("");
      recargar();
    } catch (fallo) {
      setMensaje({ tipo: "error", texto: fallo.message });
    } finally {
      setEnviando(false);
    }
  }

  function descargar() {
    const contenido = [
      "Teatro Maldonado · códigos de recuperación",
      `Cuenta: ${usuario?.email}`,
      `Generados: ${new Date().toLocaleString("es-CO")}`,
      "Cada código sirve una sola vez. Guárdalos fuera de este equipo.",
      "",
      ...codigos
    ].join("\n");
    const enlace = document.createElement("a");
    enlace.href = URL.createObjectURL(new Blob([contenido], { type: "text/plain;charset=utf-8" }));
    enlace.download = "codigos-recuperacion-teatro.txt";
    enlace.click();
    URL.revokeObjectURL(enlace.href);
  }

  return (
    <section className="tarjeta modulo" aria-labelledby="codigos-titulo">
      <div className="modulo-cabecera">
        <div>
          <h2 id="codigos-titulo">Seguridad de mi cuenta</h2>
          <p>Los códigos de respaldo te dejan recuperar el acceso si olvidas la contraseña. Cada uno se usa una sola vez.</p>
        </div>
      </div>

      <p>
        <strong>Códigos disponibles:</strong> <span className="cifra">{cargando ? "…" : disponibles}</span> de 8
      </p>

      <Aviso mensaje={mensaje} alCerrar={() => setMensaje(null)} />

      {codigos ? (
        <div className="secretos" role="status">
          <p className="mb-0">
            <strong>Guarda estos ocho códigos ahora.</strong> No volverán a mostrarse. No los compartas ni los guardes en un equipo público.
          </p>
          <ul className="secretos-lista" aria-label="Códigos de recuperación">
            {codigos.map((codigo) => (
              <li key={codigo}>{codigo}</li>
            ))}
          </ul>
          <div className="formulario-botones mt-0">
            <button className="btn btn-outline-secondary" type="button" onClick={descargar}>
              Guardar archivo .txt
            </button>
            <button className="btn btn-primary" type="button" onClick={() => setCodigos(null)}>
              Ya los guardé — ocultar
            </button>
          </div>
        </div>
      ) : (
        <form className="formulario-panel" onSubmit={emitir}>
          <h3>{disponibles > 0 ? "Regenerar mis códigos" : "Generar mis códigos"}</h3>
          <p className="texto-secundario">
            {disponibles > 0
              ? "Un lote nuevo anula los códigos anteriores, también los que no hayas usado."
              : "Todavía no tienes códigos. Genéralos ahora, antes de necesitarlos."}
          </p>
          <label className="form-label" htmlFor="codigos-password">Contraseña actual</label>
          <input
            id="codigos-password"
            className="form-control"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="formulario-botones">
            <button className="btn btn-primary" type="submit" disabled={enviando || !password}>
              {enviando ? "Generando…" : disponibles > 0 ? "Regenerar códigos" : "Generar códigos"}
            </button>
            <Link className="btn btn-outline-secondary" to="/panel">
              Volver al panel
            </Link>
          </div>
        </form>
      )}
    </section>
  );
}
