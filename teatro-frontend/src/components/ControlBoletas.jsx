import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useDatos } from "../hooks/useDatos";
import { TRANSICIONES_BOLETA, boletasDeFuncion, cambiarEstadoBoleta } from "../services/boletas.service";
import { listarFunciones } from "../services/funciones.service";
import { listarEventos } from "../services/eventos.service";
import { listarLocalidades } from "../services/localidades.service";
import { listarAsistentes } from "../services/asistentes.service";
import { coincide, etiquetaEstado, formatearFecha, hoyComoTexto, indexarPorId } from "../utils/formato";
import TablaBoletas from "./TablaBoletas";
import VentaBoleta from "./VentaBoleta";
import EstadoInsignia from "./EstadoInsignia";
import Aviso from "./Aviso";

const TEXTO_ACCION = { pagada: "Cobrar", usada: "Registrar entrada", cancelada: "Cancelar" };

// ========================================
// Catálogo para la taquilla
// ========================================
function useCatalogoTaquilla(token) {
  const cargar = useCallback(
    async (signal) => {
      const [funciones, eventos, localidades, asistentes] = await Promise.all([
        listarFunciones(token, signal),
        listarEventos(token, signal),
        listarLocalidades(token, signal),
        listarAsistentes(token, signal)
      ]);
      return { funciones, eventos, localidades, asistentes };
    },
    [token]
  );
  return useDatos(cargar);
}

// ========================================
// Control de boletas (taquilla)
// ========================================
export default function ControlBoletas() {
  const { token } = useAuth();
  const [parametros, setParametros] = useSearchParams();
  const funcionId = parametros.get("funcion") ?? "";
  const [busqueda, setBusqueda] = useState("");
  const [vendiendo, setVendiendo] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  const catalogo = useCatalogoTaquilla(token);
  const indices = useMemo(
    () => ({
      funciones: indexarPorId(catalogo.datos?.funciones),
      eventos: indexarPorId(catalogo.datos?.eventos),
      localidades: indexarPorId(catalogo.datos?.localidades),
      asistentes: indexarPorId(catalogo.datos?.asistentes)
    }),
    [catalogo.datos]
  );

  const vigentes = useMemo(() => {
    const hoy = hoyComoTexto();
    return (catalogo.datos?.funciones ?? [])
      .filter((f) => f.fecha >= hoy && !["finalizada", "cancelada"].includes(f.estado))
      .sort((a, b) => `${a.fecha} ${a.hora}`.localeCompare(`${b.fecha} ${b.hora}`));
  }, [catalogo.datos]);

  const cargarBoletas = useCallback(
    (signal) => (funcionId ? boletasDeFuncion(funcionId, token, signal) : Promise.resolve([])),
    [funcionId, token]
  );
  const boletas = useDatos(cargarBoletas);

  const funcion = indices.funciones.get(Number(funcionId));
  const visibles = (boletas.datos ?? [])
    .filter((b) => !busqueda || coincide(`${b.codigo} ${indices.asistentes.get(b.asistenteId)?.nombre ?? ""}`, busqueda))
    .sort((a, b) => a.localidadId - b.localidadId || a.fila - b.fila || a.numero - b.numero);

  const elegirFuncion = (valor) => {
    setVendiendo(false);
    setMensaje(null);
    setParametros(valor ? { funcion: valor } : {});
  };

  async function cambiar(boleta, nuevo) {
    if (nuevo === "cancelada" && !window.confirm(`¿Cancelar la boleta ${boleta.codigo}? La butaca queda libre para la venta.`)) return;
    setMensaje(null);
    try {
      await cambiarEstadoBoleta(boleta.id, nuevo, token);
      setMensaje({ tipo: "exito", texto: `Boleta ${boleta.codigo}: ${etiquetaEstado(nuevo).toLowerCase()}.` });
      boletas.recargar();
    } catch (fallo) {
      setMensaje({ tipo: "error", texto: fallo.message });
    }
  }

  const acciones = (b) =>
    TRANSICIONES_BOLETA[b.estado].map((nuevo) => (
      <button
        key={nuevo}
        type="button"
        className={`btn btn-sm ${nuevo === "usada" ? "btn-primary" : nuevo === "cancelada" ? "btn-outline-primary" : "btn-outline-secondary"}`}
        disabled={nuevo === "usada" && funcion?.estado !== "en_curso"}
        title={nuevo === "usada" && funcion?.estado !== "en_curso" ? "La entrada se registra cuando la función está en curso" : undefined}
        onClick={() => cambiar(b, nuevo)}
      >
        {TEXTO_ACCION[nuevo]}
      </button>
    ));

  return (
    <section className="tarjeta modulo" aria-labelledby="control-titulo">
      <div className="modulo-cabecera">
        <div>
          <h2 id="control-titulo">Control de boletas</h2>
          <p>Elige una función para cobrar reservas, vender en taquilla y registrar la entrada en la puerta.</p>
        </div>
        <div className="modulo-acciones">
          <button className="btn btn-primary" type="button" disabled={!funcion || funcion.estado !== "en_venta"} onClick={() => setVendiendo(true)}>
            Vender en taquilla
          </button>
          <button className="btn btn-outline-secondary" type="button" disabled={!funcionId || boletas.cargando} onClick={boletas.recargar}>
            Actualizar
          </button>
        </div>
      </div>

      <Aviso mensaje={mensaje} alCerrar={() => setMensaje(null)} />
      {catalogo.error && <Aviso mensaje={{ tipo: "error", texto: catalogo.error }} />}

      <div className="filtros" role="search">
        <div>
          <label className="form-label" htmlFor="control-funcion">Función</label>
          <select id="control-funcion" className="form-select" value={funcionId} onChange={(e) => elegirFuncion(e.target.value)}>
            <option value="">{catalogo.cargando ? "Cargando funciones…" : "Elige una función"}</option>
            {vigentes.map((f) => (
              <option key={f.id} value={f.id}>
                {formatearFecha(f.fecha)} · {f.hora} · {indices.eventos.get(f.eventoId)?.titulo ?? `Evento ${f.eventoId}`} · {etiquetaEstado(f.estado)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label" htmlFor="control-buscar">Código o asistente</label>
          <input id="control-buscar" className="form-control" type="search" placeholder="BOL-2026-…" disabled={!funcionId} value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </div>
      </div>

      {funcion && (
        <p className="d-flex flex-wrap align-items-center gap-2 mb-3">
          <strong>{indices.eventos.get(funcion.eventoId)?.titulo}</strong>
          <EstadoInsignia estado={funcion.estado} />
          {funcion.estado !== "en_curso" && (
            <span className="texto-secundario">La entrada se podrá registrar cuando el administrador abra la sala.</span>
          )}
        </p>
      )}

      {vendiendo && funcion && (
        <VentaBoleta
          token={token}
          funciones={[funcion]}
          eventos={indices.eventos}
          localidades={indices.localidades}
          asistentes={catalogo.datos?.asistentes ?? []}
          alCancelar={() => setVendiendo(false)}
          alTerminar={(boleta) => {
            setVendiendo(false);
            setMensaje({ tipo: "exito", texto: `Boleta ${boleta.codigo} reservada. Cóbrala para marcarla pagada.` });
            boletas.recargar();
          }}
        />
      )}

      {boletas.error && <Aviso mensaje={{ tipo: "error", texto: boletas.error }} />}

      {funcionId ? (
        <>
          <TablaBoletas
            boletas={visibles}
            funciones={indices.funciones}
            eventos={indices.eventos}
            localidades={indices.localidades}
            asistentes={indices.asistentes}
            acciones={acciones}
            cargando={boletas.cargando}
            vacio="Esta función todavía no tiene boletas."
          />
          <div className="tabla-pie">
            <span>{boletas.cargando ? "Consultando…" : `${visibles.length} boleta(s)`}</span>
          </div>
        </>
      ) : (
        <p className="vacio">Elige una función para ver sus boletas.</p>
      )}
    </section>
  );
}
