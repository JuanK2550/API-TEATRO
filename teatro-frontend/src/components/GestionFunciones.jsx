import { useCallback, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useDatos } from "../hooks/useDatos";
import { TRANSICIONES_FUNCION, cambiarEstadoFuncion, crearFuncion, listarFunciones } from "../services/funciones.service";
import { listarEventos } from "../services/eventos.service";
import { listarLocalidades } from "../services/localidades.service";
import { ETIQUETAS_DESCUENTO, etiquetaEstado, formatearFecha, formatearPesos, hoyComoTexto, indexarPorId } from "../utils/formato";
import EstadoInsignia from "./EstadoInsignia";
import Aviso from "./Aviso";

const DESCUENTOS = ["estudiante", "infantil", "adultoMayor"];
const TEXTO_ACCION = {
  en_venta: "Poner en venta",
  agotada: "Marcar agotada",
  en_curso: "Abrir sala",
  finalizada: "Finalizar",
  cancelada: "Cancelar"
};

// ========================================
// Funciones
// ========================================
export default function GestionFunciones() {
  const { token } = useAuth();
  const [eventoFiltro, setEventoFiltro] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("");
  const [soloProximas, setSoloProximas] = useState(true);
  const [formulario, setFormulario] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(
    async (signal) => {
      const [funciones, eventos, localidades] = await Promise.all([
        listarFunciones(token, signal),
        listarEventos(token, signal),
        listarLocalidades(token, signal)
      ]);
      return { funciones, eventos, localidades };
    },
    [token]
  );
  const { datos, error, cargando, recargar } = useDatos(cargar);

  const eventos = useMemo(() => indexarPorId(datos?.eventos), [datos]);
  const localidadesActivas = useMemo(
    () => (datos?.localidades ?? []).filter((l) => l.activa).sort((a, b) => a.orden - b.orden),
    [datos]
  );

  const visibles = useMemo(() => {
    const hoy = hoyComoTexto();
    return (datos?.funciones ?? [])
      .filter(
        (f) =>
          (!eventoFiltro || String(f.eventoId) === eventoFiltro) &&
          (!estadoFiltro || f.estado === estadoFiltro) &&
          (!soloProximas || f.fecha >= hoy)
      )
      .sort((a, b) => `${a.fecha} ${a.hora}`.localeCompare(`${b.fecha} ${b.hora}`));
  }, [datos, eventoFiltro, estadoFiltro, soloProximas]);

  function abrirFormulario() {
    setFormulario({
      eventoId: "",
      fecha: "",
      hora: "19:00",
      precios: Object.fromEntries(localidadesActivas.map((l) => [l.id, ""])),
      descuentos: []
    });
  }

  const alternarDescuento = (d) =>
    setFormulario((a) => ({
      ...a,
      descuentos: a.descuentos.includes(d) ? a.descuentos.filter((x) => x !== d) : [...a.descuentos, d]
    }));

  async function guardar(evento) {
    evento.preventDefault();
    setOcupado(true);
    setMensaje(null);
    try {
      await crearFuncion(
        {
          eventoId: Number(formulario.eventoId),
          fecha: formulario.fecha,
          hora: formulario.hora,
          tarifas: localidadesActivas.map((l) => ({ localidadId: l.id, precio: Number(formulario.precios[l.id]) })),
          descuentosHabilitados: formulario.descuentos
        },
        token
      );
      setMensaje({ tipo: "exito", texto: "Función creada. Nace programada: ponla en venta cuando esté lista." });
      setFormulario(null);
      recargar();
    } catch (fallo) {
      setMensaje({ tipo: "error", texto: fallo.message });
    } finally {
      setOcupado(false);
    }
  }

  async function cambiarEstado(funcion, nuevo) {
    const titulo = eventos.get(funcion.eventoId)?.titulo ?? "la función";
    if (nuevo === "cancelada" && !window.confirm(`¿Cancelar la función de «${titulo}» del ${formatearFecha(funcion.fecha)}? Es definitivo.`)) return;
    setMensaje(null);
    try {
      await cambiarEstadoFuncion(funcion.id, nuevo, token);
      setMensaje({ tipo: "exito", texto: `Función de «${titulo}»: ${etiquetaEstado(nuevo).toLowerCase()}.` });
      recargar();
    } catch (fallo) {
      setMensaje({ tipo: "error", texto: fallo.message });
    }
  }

  return (
    <section className="tarjeta modulo mt-3" aria-labelledby="funciones-titulo">
      <div className="modulo-cabecera">
        <div>
          <h2 id="funciones-titulo">Funciones</h2>
          <p>Sala única: no puede haber dos funciones a la misma fecha y hora. Más cerca del escenario, más caro.</p>
        </div>
        <div className="modulo-acciones">
          <button className="btn btn-primary" type="button" onClick={abrirFormulario} disabled={!datos}>
            Nueva función
          </button>
          <button className="btn btn-outline-secondary" type="button" onClick={recargar} disabled={cargando}>
            Actualizar
          </button>
        </div>
      </div>

      <Aviso mensaje={mensaje} alCerrar={() => setMensaje(null)} />

      {formulario && (
        <form className="formulario-panel" onSubmit={guardar}>
          <h3>Nueva función</h3>
          <div className="formulario-rejilla">
            <div>
              <label className="form-label" htmlFor="funcion-evento">Evento</label>
              <select id="funcion-evento" className="form-select" required value={formulario.eventoId} onChange={(e) => setFormulario((a) => ({ ...a, eventoId: e.target.value }))}>
                <option value="">Elige un evento activo</option>
                {(datos?.eventos ?? [])
                  .filter((e) => e.activo)
                  .map((e) => (
                    <option key={e.id} value={e.id}>{e.titulo}</option>
                  ))}
              </select>
            </div>
            <div>
              <label className="form-label" htmlFor="funcion-fecha">Fecha</label>
              <input id="funcion-fecha" className="form-control" type="date" min={hoyComoTexto()} required value={formulario.fecha} onChange={(e) => setFormulario((a) => ({ ...a, fecha: e.target.value }))} />
            </div>
            <div>
              <label className="form-label" htmlFor="funcion-hora">Hora</label>
              <input id="funcion-hora" className="form-control" type="time" required value={formulario.hora} onChange={(e) => setFormulario((a) => ({ ...a, hora: e.target.value }))} />
            </div>
            {localidadesActivas.map((l) => (
              <div key={l.id}>
                <label className="form-label" htmlFor={`funcion-precio-${l.id}`}>
                  Precio · {l.nombre}
                </label>
                <input
                  id={`funcion-precio-${l.id}`}
                  className="form-control"
                  type="number"
                  min={1000}
                  step={500}
                  required
                  inputMode="numeric"
                  value={formulario.precios[l.id]}
                  onChange={(e) => setFormulario((a) => ({ ...a, precios: { ...a.precios, [l.id]: e.target.value } }))}
                />
              </div>
            ))}
            <fieldset className="ancho-completo">
              <legend className="form-label">Descuentos habilitados</legend>
              <div className="d-flex flex-wrap gap-3">
                {DESCUENTOS.map((d) => (
                  <div key={d} className="form-check">
                    <input id={`funcion-descuento-${d}`} className="form-check-input" type="checkbox" checked={formulario.descuentos.includes(d)} onChange={() => alternarDescuento(d)} />
                    <label className="form-check-label" htmlFor={`funcion-descuento-${d}`}>{ETIQUETAS_DESCUENTO[d]}</label>
                  </div>
                ))}
              </div>
            </fieldset>
          </div>
          <p className="form-text mb-0 mt-2">El estado no se elige: toda función nace programada. El servidor comprueba la sala única y la coherencia de precios.</p>
          <div className="formulario-botones">
            <button className="btn btn-primary" type="submit" disabled={ocupado}>
              {ocupado ? "Guardando…" : "Crear función"}
            </button>
            <button className="btn btn-outline-secondary" type="button" onClick={() => setFormulario(null)}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="filtros" role="search">
        <div>
          <label className="form-label" htmlFor="funciones-evento">Evento</label>
          <select id="funciones-evento" className="form-select" value={eventoFiltro} onChange={(e) => setEventoFiltro(e.target.value)}>
            <option value="">Todos</option>
            {(datos?.eventos ?? []).map((e) => (
              <option key={e.id} value={e.id}>{e.titulo}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label" htmlFor="funciones-estado">Estado</label>
          <select id="funciones-estado" className="form-select" value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)}>
            <option value="">Todos</option>
            {Object.keys(TRANSICIONES_FUNCION).map((estado) => (
              <option key={estado} value={estado}>{etiquetaEstado(estado)}</option>
            ))}
          </select>
        </div>
        <div className="d-flex align-items-end">
          <div className="form-check mb-2">
            <input id="funciones-proximas" className="form-check-input" type="checkbox" checked={soloProximas} onChange={(e) => setSoloProximas(e.target.checked)} />
            <label className="form-check-label" htmlFor="funciones-proximas">Solo desde hoy</label>
          </div>
        </div>
      </div>

      {error && <Aviso mensaje={{ tipo: "error", texto: error }} />}

      <div className="tabla-contenedor">
        <table className="table table-hover">
          <thead>
            <tr>
              <th scope="col">Fecha</th>
              <th scope="col">Hora</th>
              <th scope="col">Evento</th>
              <th scope="col">Desde</th>
              <th scope="col">Estado</th>
              <th scope="col">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((f) => (
              <tr key={f.id}>
                <td className="cifra">{formatearFecha(f.fecha)}</td>
                <td className="cifra">{f.hora}</td>
                <td>{eventos.get(f.eventoId)?.titulo ?? `Evento ${f.eventoId}`}</td>
                <td className="cifra">{f.tarifas?.length ? formatearPesos(Math.min(...f.tarifas.map((t) => t.precio))) : "—"}</td>
                <td>
                  <EstadoInsignia estado={f.estado} />
                </td>
                <td>
                  <div className="tabla-acciones">
                    {TRANSICIONES_FUNCION[f.estado].map((nuevo) => (
                      <button
                        key={nuevo}
                        type="button"
                        className={`btn btn-sm ${nuevo === "cancelada" ? "btn-outline-primary" : "btn-outline-secondary"}`}
                        onClick={() => cambiarEstado(f, nuevo)}
                      >
                        {TEXTO_ACCION[nuevo]}
                      </button>
                    ))}
                    {TRANSICIONES_FUNCION[f.estado].length === 0 && <span className="texto-secundario">Sin cambios posibles</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!cargando && visibles.length === 0 && <p className="vacio">No hay funciones con esos filtros.</p>}
      </div>
      <div className="tabla-pie">
        <span>{cargando ? "Consultando…" : `${visibles.length} función(es)`}</span>
      </div>
    </section>
  );
}
