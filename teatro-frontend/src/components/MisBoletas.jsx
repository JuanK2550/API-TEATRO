import { useCallback, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useDatos } from "../hooks/useDatos";
import { cambiarEstadoBoleta, misBoletas } from "../services/boletas.service";
import { listarFunciones } from "../services/funciones.service";
import { listarEventos } from "../services/eventos.service";
import { listarLocalidades } from "../services/localidades.service";
import { miFichaDeAsistente } from "../services/asistentes.service";
import { etiquetaEstado, indexarPorId } from "../utils/formato";
import TablaBoletas from "./TablaBoletas";
import VentaBoleta from "./VentaBoleta";
import Aviso from "./Aviso";

// ========================================
// Mis boletas (asistente)
// ========================================
export default function MisBoletas() {
  const { token } = useAuth();
  const [parametros] = useSearchParams();
  const funcionPedida = parametros.get("funcion");
  const [estado, setEstado] = useState("");
  const [comprando, setComprando] = useState(Boolean(funcionPedida));
  const [mensaje, setMensaje] = useState(null);

  const cargar = useCallback(
    async (signal) => {
      const [boletas, funciones, eventos, localidades, ficha] = await Promise.all([
        misBoletas(token, signal),
        listarFunciones(token, signal),
        listarEventos(token, signal),
        listarLocalidades(token, signal),
        miFichaDeAsistente(token, signal)
      ]);
      return { boletas, funciones, eventos, localidades, ficha };
    },
    [token]
  );
  const { datos, error, cargando, recargar } = useDatos(cargar);

  const indices = useMemo(
    () => ({
      funciones: indexarPorId(datos?.funciones),
      eventos: indexarPorId(datos?.eventos),
      localidades: indexarPorId(datos?.localidades)
    }),
    [datos]
  );

  const enVenta = useMemo(
    () => (datos?.funciones ?? []).filter((f) => f.estado === "en_venta").sort((a, b) => `${a.fecha} ${a.hora}`.localeCompare(`${b.fecha} ${b.hora}`)),
    [datos]
  );

  const visibles = (datos?.boletas ?? []).filter((b) => !estado || b.estado === estado).sort((a, b) => b.id - a.id);

  async function cambiar(boleta, nuevo) {
    const pregunta =
      nuevo === "cancelada"
        ? `¿Cancelar la boleta ${boleta.codigo}? Se libera la butaca y no se puede deshacer.`
        : `¿Confirmas el pago simulado de la boleta ${boleta.codigo}?`;
    if (!window.confirm(pregunta)) return;
    setMensaje(null);
    try {
      await cambiarEstadoBoleta(boleta.id, nuevo, token);
      setMensaje({ tipo: "exito", texto: `Boleta ${boleta.codigo}: ${etiquetaEstado(nuevo).toLowerCase()}.` });
      recargar();
    } catch (fallo) {
      setMensaje({ tipo: "error", texto: fallo.message });
    }
  }

  const acciones = (b) => [
    ...(b.estado === "reservada"
      ? [
          <button key="pagar" type="button" className="btn btn-sm btn-outline-secondary" onClick={() => cambiar(b, "pagada")}>
            Pagar (simulado)
          </button>
        ]
      : []),
    ...(["reservada", "pagada"].includes(b.estado)
      ? [
          <button key="cancelar" type="button" className="btn btn-sm btn-outline-primary" onClick={() => cambiar(b, "cancelada")}>
            Cancelar
          </button>
        ]
      : [])
  ];

  return (
    <section className="tarjeta modulo" aria-labelledby="mis-boletas-titulo">
      <div className="modulo-cabecera">
        <div>
          <h2 id="mis-boletas-titulo">Mis boletas</h2>
          <p>Solo ves tus boletas: el servidor resuelve tu ficha desde la sesión, no desde lo que envía el navegador.</p>
        </div>
        <div className="modulo-acciones">
          <button className="btn btn-primary" type="button" disabled={!datos?.ficha || enVenta.length === 0} onClick={() => setComprando(true)}>
            Comprar boleta
          </button>
          <button className="btn btn-outline-secondary" type="button" onClick={recargar} disabled={cargando}>
            Actualizar
          </button>
        </div>
      </div>

      <Aviso mensaje={mensaje} alCerrar={() => setMensaje(null)} />
      {error && <Aviso mensaje={{ tipo: "error", texto: error }} />}

      {datos && !datos.ficha && (
        <div className="aviso aviso-info" role="status">
          <span>
            Para comprar necesitas tus datos de asistente. <Link to="/panel/mi-perfil">Complétalos en Mi perfil</Link>.
          </span>
        </div>
      )}

      {comprando && datos?.ficha && enVenta.length > 0 && (
        <VentaBoleta
          token={token}
          funciones={enVenta}
          eventos={indices.eventos}
          localidades={indices.localidades}
          asistenteFijo={datos.ficha}
          funcionInicial={funcionPedida}
          alCancelar={() => setComprando(false)}
          alTerminar={(boleta) => {
            setComprando(false);
            setMensaje({ tipo: "exito", texto: `Boleta ${boleta.codigo} reservada. Págala antes de la función.` });
            recargar();
          }}
        />
      )}

      <div className="filtros" role="search">
        <div>
          <label className="form-label" htmlFor="mis-boletas-estado">Estado</label>
          <select id="mis-boletas-estado" className="form-select" value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="">Todas</option>
            {["reservada", "pagada", "usada", "cancelada"].map((e) => (
              <option key={e} value={e}>{etiquetaEstado(e)}</option>
            ))}
          </select>
        </div>
      </div>

      <TablaBoletas
        boletas={visibles}
        funciones={indices.funciones}
        eventos={indices.eventos}
        localidades={indices.localidades}
        acciones={acciones}
        cargando={cargando}
        vacio="Todavía no tienes boletas."
      />
      <div className="tabla-pie">
        <span>{cargando ? "Consultando…" : `${visibles.length} boleta(s)`}</span>
        <span>El pago es una simulación: no se cobra nada.</span>
      </div>
    </section>
  );
}
