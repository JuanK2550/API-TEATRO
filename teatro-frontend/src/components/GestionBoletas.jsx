import { useCallback, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useDatos } from "../hooks/useDatos";
import { TRANSICIONES_BOLETA, cambiarEstadoBoleta, listarBoletas } from "../services/boletas.service";
import { eliminarRecurso } from "../services/recursos.service";
import { listarFunciones } from "../services/funciones.service";
import { listarEventos } from "../services/eventos.service";
import { listarLocalidades } from "../services/localidades.service";
import { listarAsistentes } from "../services/asistentes.service";
import { coincide, etiquetaEstado, formatearFecha, indexarPorId } from "../utils/formato";
import TablaBoletas from "./TablaBoletas";
import Aviso from "./Aviso";

const TEXTO_ACCION = { pagada: "Marcar pagada", usada: "Registrar entrada", cancelada: "Cancelar" };

// ========================================
// Boletas (administrador)
// ========================================
export default function GestionBoletas() {
  const { token } = useAuth();
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState("");
  const [funcionFiltro, setFuncionFiltro] = useState("");
  const [mensaje, setMensaje] = useState(null);

  const cargar = useCallback(
    async (signal) => {
      const [boletas, funciones, eventos, localidades, asistentes] = await Promise.all([
        listarBoletas(token, signal),
        listarFunciones(token, signal),
        listarEventos(token, signal),
        listarLocalidades(token, signal),
        listarAsistentes(token, signal)
      ]);
      return { boletas, funciones, eventos, localidades, asistentes };
    },
    [token]
  );
  const { datos, error, cargando, recargar } = useDatos(cargar);

  const indices = useMemo(
    () => ({
      funciones: indexarPorId(datos?.funciones),
      eventos: indexarPorId(datos?.eventos),
      localidades: indexarPorId(datos?.localidades),
      asistentes: indexarPorId(datos?.asistentes)
    }),
    [datos]
  );

  const visibles = useMemo(
    () =>
      (datos?.boletas ?? [])
        .filter((b) => {
          if (estado && b.estado !== estado) return false;
          if (funcionFiltro && String(b.funcionId) !== funcionFiltro) return false;
          if (!busqueda) return true;
          const funcion = indices.funciones.get(b.funcionId);
          const texto = `${b.codigo} ${indices.asistentes.get(b.asistenteId)?.nombre ?? ""} ${indices.eventos.get(funcion?.eventoId)?.titulo ?? ""}`;
          return coincide(texto, busqueda);
        })
        .sort((a, b) => b.id - a.id),
    [datos, indices, busqueda, estado, funcionFiltro]
  );

  async function cambiar(boleta, nuevo) {
    if (nuevo === "cancelada" && !window.confirm(`¿Cancelar la boleta ${boleta.codigo}? La butaca queda libre.`)) return;
    setMensaje(null);
    try {
      await cambiarEstadoBoleta(boleta.id, nuevo, token);
      setMensaje({ tipo: "exito", texto: `Boleta ${boleta.codigo}: ${etiquetaEstado(nuevo).toLowerCase()}.` });
      recargar();
    } catch (fallo) {
      setMensaje({ tipo: "error", texto: fallo.message });
    }
  }

  async function eliminar(boleta) {
    if (!window.confirm(`¿Eliminar la boleta ${boleta.codigo}? No se puede deshacer.`)) return;
    setMensaje(null);
    try {
      await eliminarRecurso(`/api/boletas/${boleta.id}`, token);
      setMensaje({ tipo: "exito", texto: `Boleta ${boleta.codigo} eliminada.` });
      recargar();
    } catch (fallo) {
      setMensaje({ tipo: "error", texto: fallo.message });
    }
  }

  const acciones = (b) => [
    ...TRANSICIONES_BOLETA[b.estado].map((nuevo) => {
      const salaCerrada = nuevo === "usada" && indices.funciones.get(b.funcionId)?.estado !== "en_curso";
      return (
        <button
          key={nuevo}
          type="button"
          className={`btn btn-sm ${nuevo === "cancelada" ? "btn-outline-primary" : "btn-outline-secondary"}`}
          disabled={salaCerrada}
          title={salaCerrada ? "La entrada se registra cuando la función está en curso" : undefined}
          onClick={() => cambiar(b, nuevo)}
        >
          {TEXTO_ACCION[nuevo]}
        </button>
      );
    }),
    ...(["reservada", "cancelada"].includes(b.estado)
      ? [
          <button key="eliminar" type="button" className="btn btn-sm btn-outline-secondary" onClick={() => eliminar(b)}>
            Eliminar
          </button>
        ]
      : [])
  ];

  return (
    <section className="tarjeta modulo" aria-labelledby="boletas-titulo">
      <div className="modulo-cabecera">
        <div>
          <h2 id="boletas-titulo">Boletas</h2>
          <p>Toda la venta del teatro. El precio y el código los pone el servidor; registrar la entrada exige la función en curso.</p>
        </div>
        <div className="modulo-acciones">
          <button className="btn btn-outline-secondary" type="button" onClick={recargar} disabled={cargando}>
            Actualizar
          </button>
        </div>
      </div>

      <Aviso mensaje={mensaje} alCerrar={() => setMensaje(null)} />

      <div className="filtros" role="search">
        <div>
          <label className="form-label" htmlFor="boletas-buscar">Buscar por código, asistente o evento</label>
          <input id="boletas-buscar" className="form-control" type="search" placeholder="Ej.: BOL-2026-0003" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </div>
        <div>
          <label className="form-label" htmlFor="boletas-estado">Estado</label>
          <select id="boletas-estado" className="form-select" value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="">Todos</option>
            {Object.keys(TRANSICIONES_BOLETA).map((e) => (
              <option key={e} value={e}>{etiquetaEstado(e)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label" htmlFor="boletas-funcion">Función</label>
          <select id="boletas-funcion" className="form-select" value={funcionFiltro} onChange={(e) => setFuncionFiltro(e.target.value)}>
            <option value="">Todas</option>
            {(datos?.funciones ?? []).map((f) => (
              <option key={f.id} value={f.id}>
                {indices.eventos.get(f.eventoId)?.titulo ?? `Evento ${f.eventoId}`} · {formatearFecha(f.fecha)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <Aviso mensaje={{ tipo: "error", texto: error }} />}

      <TablaBoletas
        boletas={visibles}
        funciones={indices.funciones}
        eventos={indices.eventos}
        localidades={indices.localidades}
        asistentes={indices.asistentes}
        acciones={acciones}
        cargando={cargando}
        vacio="No hay boletas con esos filtros."
      />
      <div className="tabla-pie">
        <span>{cargando ? "Consultando…" : `${visibles.length} de ${(datos?.boletas ?? []).length} boletas`}</span>
      </div>
    </section>
  );
}
