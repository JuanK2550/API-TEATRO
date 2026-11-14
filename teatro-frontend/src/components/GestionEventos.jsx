import { useCallback, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useDatos } from "../hooks/useDatos";
import { actualizarEvento, cambiarEstadoEvento, crearEvento, listarEventos } from "../services/eventos.service";
import { ETIQUETAS_TIPO_EVENTO, coincide } from "../utils/formato";
import EstadoInsignia from "./EstadoInsignia";
import Aviso from "./Aviso";

const CLASIFICACIONES = ["G", "+7", "+12", "+15", "+18"];
const VACIO = { titulo: "", tipo: "obra", descripcion: "", duracionMinutos: 90, clasificacionEdad: "G" };

// ========================================
// Eventos
// ========================================
export default function GestionEventos() {
  const { token } = useAuth();
  const [busqueda, setBusqueda] = useState("");
  const [tipo, setTipo] = useState("");
  const [estado, setEstado] = useState("");
  const [formulario, setFormulario] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback((signal) => listarEventos(token, signal), [token]);
  const { datos, error, cargando, recargar } = useDatos(cargar);

  const visibles = useMemo(
    () =>
      (datos ?? []).filter(
        (e) =>
          (!busqueda || coincide(`${e.titulo} ${e.descripcion}`, busqueda)) &&
          (!tipo || e.tipo === tipo) &&
          (!estado || String(e.activo) === estado)
      ),
    [datos, busqueda, tipo, estado]
  );

  const campo = (nombre) => (e) => setFormulario((a) => ({ ...a, [nombre]: e.target.value }));

  async function guardar(evento) {
    evento.preventDefault();
    setOcupado(true);
    setMensaje(null);
    const cuerpo = {
      titulo: formulario.titulo,
      tipo: formulario.tipo,
      descripcion: formulario.descripcion,
      duracionMinutos: Number(formulario.duracionMinutos),
      clasificacionEdad: formulario.clasificacionEdad
    };
    try {
      if (formulario.id) await actualizarEvento(formulario.id, cuerpo, token);
      else await crearEvento(cuerpo, token);
      setMensaje({ tipo: "exito", texto: formulario.id ? "Evento actualizado." : "Evento creado y activo." });
      setFormulario(null);
      recargar();
    } catch (fallo) {
      setMensaje({ tipo: "error", texto: fallo.message });
    } finally {
      setOcupado(false);
    }
  }

  async function alternar(e) {
    if (e.activo && !window.confirm(`¿Desactivar «${e.titulo}»? No admitirá funciones nuevas y dejará de verse en la cartelera.`)) return;
    setMensaje(null);
    try {
      await cambiarEstadoEvento(e.id, !e.activo, token);
      setMensaje({ tipo: "exito", texto: `«${e.titulo}» ${e.activo ? "desactivado" : "activado"}.` });
      recargar();
    } catch (fallo) {
      setMensaje({ tipo: "error", texto: fallo.message });
    }
  }

  return (
    <section className="tarjeta modulo mt-3" aria-labelledby="eventos-titulo">
      <div className="modulo-cabecera">
        <div>
          <h2 id="eventos-titulo">Eventos</h2>
          <p>Obras, conciertos, cine y actos institucionales. Un evento inactivo no admite funciones nuevas.</p>
        </div>
        <div className="modulo-acciones">
          <button className="btn btn-primary" type="button" onClick={() => setFormulario({ ...VACIO })}>
            Nuevo evento
          </button>
          <button className="btn btn-outline-secondary" type="button" onClick={recargar} disabled={cargando}>
            Actualizar
          </button>
        </div>
      </div>

      <Aviso mensaje={mensaje} alCerrar={() => setMensaje(null)} />

      {formulario && (
        <form className="formulario-panel" onSubmit={guardar}>
          <h3>{formulario.id ? "Editar evento" : "Nuevo evento"}</h3>
          <div className="formulario-rejilla">
            <div className="ancho-completo">
              <label className="form-label" htmlFor="evento-titulo">Título</label>
              <input id="evento-titulo" className="form-control" required minLength={3} maxLength={150} value={formulario.titulo} onChange={campo("titulo")} />
            </div>
            <div>
              <label className="form-label" htmlFor="evento-tipo">Tipo</label>
              <select id="evento-tipo" className="form-select" value={formulario.tipo} onChange={campo("tipo")}>
                {Object.entries(ETIQUETAS_TIPO_EVENTO).map(([valor, texto]) => (
                  <option key={valor} value={valor}>{texto}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label" htmlFor="evento-duracion">Duración (minutos)</label>
              <input id="evento-duracion" className="form-control" type="number" min={10} max={600} required value={formulario.duracionMinutos} onChange={campo("duracionMinutos")} />
            </div>
            <div>
              <label className="form-label" htmlFor="evento-clasificacion">Clasificación</label>
              <select id="evento-clasificacion" className="form-select" value={formulario.clasificacionEdad} onChange={campo("clasificacionEdad")}>
                {CLASIFICACIONES.map((c) => (
                  <option key={c} value={c}>{c === "G" ? "G · todo público" : c}</option>
                ))}
              </select>
            </div>
            <div className="ancho-completo">
              <label className="form-label" htmlFor="evento-descripcion">Descripción</label>
              <textarea id="evento-descripcion" className="form-control" rows={3} required value={formulario.descripcion} onChange={campo("descripcion")} />
            </div>
          </div>
          <div className="formulario-botones">
            <button className="btn btn-primary" type="submit" disabled={ocupado}>
              {ocupado ? "Guardando…" : "Guardar evento"}
            </button>
            <button className="btn btn-outline-secondary" type="button" onClick={() => setFormulario(null)}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="filtros" role="search">
        <div>
          <label className="form-label" htmlFor="eventos-buscar">Buscar evento</label>
          <input id="eventos-buscar" className="form-control" type="search" placeholder="Título o descripción" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </div>
        <div>
          <label className="form-label" htmlFor="eventos-tipo">Tipo</label>
          <select id="eventos-tipo" className="form-select" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(ETIQUETAS_TIPO_EVENTO).map(([valor, texto]) => (
              <option key={valor} value={valor}>{texto}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label" htmlFor="eventos-estado">Estado</label>
          <select id="eventos-estado" className="form-select" value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="">Todos</option>
            <option value="true">Activos</option>
            <option value="false">Inactivos</option>
          </select>
        </div>
      </div>

      {error && <Aviso mensaje={{ tipo: "error", texto: error }} />}

      <div className="tabla-contenedor">
        <table className="table table-hover">
          <thead>
            <tr>
              <th scope="col">Título</th>
              <th scope="col">Tipo</th>
              <th scope="col">Duración</th>
              <th scope="col">Clasificación</th>
              <th scope="col">Estado</th>
              <th scope="col">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((e) => (
              <tr key={e.id}>
                <td>{e.titulo}</td>
                <td>{ETIQUETAS_TIPO_EVENTO[e.tipo] ?? e.tipo}</td>
                <td className="cifra">{e.duracionMinutos} min</td>
                <td>{e.clasificacionEdad}</td>
                <td>
                  <EstadoInsignia estado={e.activo ? "activo" : "inactivo"} texto={e.activo ? "Activo" : "Inactivo"} />
                </td>
                <td>
                  <div className="tabla-acciones">
                    <button className="btn btn-outline-secondary btn-sm" type="button" onClick={() => setFormulario({ ...e })}>
                      Editar
                    </button>
                    <button className={`btn btn-sm ${e.activo ? "btn-outline-primary" : "btn-outline-secondary"}`} type="button" onClick={() => alternar(e)}>
                      {e.activo ? "Desactivar" : "Activar"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!cargando && visibles.length === 0 && <p className="vacio">No hay eventos que coincidan.</p>}
      </div>
      <div className="tabla-pie">
        <span>{cargando ? "Consultando…" : `${visibles.length} de ${(datos ?? []).length} eventos`}</span>
      </div>
    </section>
  );
}
