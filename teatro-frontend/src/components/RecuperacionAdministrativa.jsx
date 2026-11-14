import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { buscarUsuariosRecuperacion, generarTokenRecuperacionAdmin } from "../services/seguridad.service";
import { ETIQUETAS_ROL } from "../utils/formato";
import Aviso from "./Aviso";

const HORA = new Intl.DateTimeFormat("es-CO", { dateStyle: "short", timeStyle: "medium" });

// ========================================
// Recuperación administrativa
// El token se muestra una sola vez y no se guarda en ningún sitio
// ========================================
export default function RecuperacionAdministrativa() {
  const { token } = useAuth();
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [elegido, setElegido] = useState("");
  const [verificado, setVerificado] = useState(false);
  const [emitido, setEmitido] = useState(null);
  const [visible, setVisible] = useState(true);
  const [mensaje, setMensaje] = useState(null);
  const [enviando, setEnviando] = useState(false);

  // Busca al dejar de escribir; con menos de dos letras no pregunta al servidor.
  useEffect(() => {
    const consulta = texto.trim();
    if (consulta.length < 2) return undefined;

    const controlador = new AbortController();
    const espera = setTimeout(() => {
      setBuscando(true);
      buscarUsuariosRecuperacion(consulta, token, controlador.signal)
        .then(({ usuarios }) => setResultados(usuarios))
        .catch((fallo) => {
          if (fallo.name !== "AbortError") setMensaje({ tipo: "error", texto: fallo.message });
        })
        .finally(() => {
          if (!controlador.signal.aborted) setBuscando(false);
        });
    }, 350);

    return () => {
      clearTimeout(espera);
      controlador.abort();
    };
  }, [texto, token]);

  const opciones = texto.trim().length < 2 ? [] : resultados;
  const cuenta = opciones.find((u) => String(u.id) === elegido);

  async function generar(evento) {
    evento.preventDefault();
    setEnviando(true);
    setMensaje(null);
    try {
      const respuesta = await generarTokenRecuperacionAdmin(elegido, token);
      setEmitido({ token: respuesta.token, expiraEn: respuesta.expiraEn, para: cuenta });
      setVisible(true);
      setVerificado(false);
    } catch (fallo) {
      setMensaje({ tipo: "error", texto: fallo.message });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="tarjeta modulo" aria-labelledby="recuperacion-titulo">
      <div className="modulo-cabecera">
        <div>
          <h2 id="recuperacion-titulo">Recuperación administrativa</h2>
          <p>
            Busca la cuenta, verifica la identidad del titular por un procedimiento autorizado y genera un token temporal. Vence a los 15 minutos y
            sirve una sola vez.
          </p>
        </div>
      </div>

      <Aviso mensaje={mensaje} alCerrar={() => setMensaje(null)} />

      <form onSubmit={generar} className="formulario-rejilla">
        <div className="ancho-completo">
          <label className="form-label" htmlFor="recuperacion-buscar">Buscar cuenta por nombre o correo</label>
          <input
            id="recuperacion-buscar"
            className="form-control"
            type="search"
            autoComplete="off"
            aria-describedby="recuperacion-buscar-ayuda"
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              setElegido("");
            }}
          />
          <div id="recuperacion-buscar-ayuda" className="form-text">
            Escribe al menos dos caracteres. Se muestran hasta 20 cuentas activas. {buscando && "Buscando…"}
          </div>
        </div>
        <div className="ancho-completo">
          <label className="form-label" htmlFor="recuperacion-cuenta">Cuenta</label>
          <select id="recuperacion-cuenta" className="form-select" required disabled={opciones.length === 0} value={elegido} onChange={(e) => setElegido(e.target.value)}>
            <option value="">{opciones.length ? "Selecciona la cuenta" : "Sin resultados todavía"}</option>
            {opciones.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre} — {u.email} ({ETIQUETAS_ROL[u.rol] ?? u.rol})
              </option>
            ))}
          </select>
        </div>
        <div className="ancho-completo form-check">
          <input id="recuperacion-verificado" className="form-check-input" type="checkbox" checked={verificado} onChange={(e) => setVerificado(e.target.checked)} />
          <label className="form-check-label" htmlFor="recuperacion-verificado">
            Confirmo que verifiqué la identidad del titular por un procedimiento autorizado.
          </label>
        </div>
        <div className="ancho-completo formulario-botones mt-0">
          <button className="btn btn-primary" type="submit" disabled={!elegido || !verificado || enviando}>
            {enviando ? "Generando…" : "Generar token temporal"}
          </button>
          <Link className="btn btn-outline-secondary" to="/panel">
            Volver al panel
          </Link>
        </div>
      </form>

      {emitido && (
        <div className="secretos" role="status">
          <p className="mb-1">
            <strong>Token generado para {emitido.para?.nombre ?? "la cuenta elegida"}.</strong> Se muestra solo durante esta operación.
          </p>
          <p className="mb-2 texto-secundario">Caduca: {HORA.format(new Date(emitido.expiraEn))}</p>
          {visible ? (
            <>
              <label className="form-label" htmlFor="recuperacion-token">Token para entregar únicamente al titular verificado</label>
              <textarea id="recuperacion-token" className="form-control campo-secreto" rows={2} readOnly value={emitido.token} onFocus={(e) => e.target.select()} />
              <p className="form-text">No lo compartas en capturas, registros ni canales públicos.</p>
            </>
          ) : (
            <p className="mb-2">Token oculto.</p>
          )}
          <button
            className="btn btn-outline-secondary btn-sm"
            type="button"
            onClick={() => {
              setVisible(false);
              setEmitido((actual) => ({ ...actual, token: "" }));
            }}
          >
            Ocultar token
          </button>
        </div>
      )}
    </section>
  );
}
