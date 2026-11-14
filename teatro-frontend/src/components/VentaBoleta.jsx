import { useCallback, useMemo, useState } from "react";
import { useDatos } from "../hooks/useDatos";
import { ocupacionDeFuncion, tarifasDeFuncion } from "../services/funciones.service";
import { comprarBoleta } from "../services/boletas.service";
import { ETIQUETAS_DESCUENTO, formatearFecha, formatearPesos } from "../utils/formato";
import Aviso from "./Aviso";
import PlanoButacas from "./PlanoButacas";

const PORCENTAJE = { ninguno: 0, estudiante: 20, infantil: 50, adultoMayor: 30 };

// ========================================
// Butacas de una función
// Tarifas y ocupación, siempre frescas
// ========================================
function useButacas(funcionId, token) {
  const cargar = useCallback(
    async (signal) => {
      if (!funcionId) return null;
      const [tarifas, ocupacion] = await Promise.all([
        tarifasDeFuncion(funcionId, token, signal),
        ocupacionDeFuncion(funcionId, token, signal)
      ]);
      return { tarifas, ocupacion };
    },
    [funcionId, token]
  );
  return useDatos(cargar);
}

// ========================================
// Venta de una boleta
// El precio, el código y el estado los pone el servidor
// ========================================
export default function VentaBoleta({ token, funciones, eventos, localidades, asistentes, asistenteFijo, funcionInicial, alTerminar, alCancelar }) {
  const inicial = funciones.length === 1 ? funciones[0].id : funciones.find((f) => String(f.id) === String(funcionInicial))?.id;
  const [funcionId, setFuncionId] = useState(inicial ? String(inicial) : "");
  const [asistenteId, setAsistenteId] = useState(asistenteFijo ? String(asistenteFijo.id) : "");
  const [localidadId, setLocalidadId] = useState("");
  const [fila, setFila] = useState(null);
  const [numero, setNumero] = useState(null);
  const [tipoDescuento, setTipoDescuento] = useState("ninguno");
  const [mensaje, setMensaje] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const { datos: butacas, cargando: cargandoButacas, recargar } = useButacas(funcionId, token);
  const tarifa = butacas?.tarifas?.tarifas?.find((t) => String(t.localidadId) === localidadId);
  const localidad = localidades.get(Number(localidadId));
  const descuentos = ["ninguno", ...(butacas?.tarifas?.descuentosHabilitados ?? [])];

  const ocupadas = useMemo(
    () =>
      new Set(
        (butacas?.ocupacion ?? [])
          .filter((o) => String(o.localidadId) === localidadId)
          .map((o) => `${o.fila}-${o.numero}`)
      ),
    [butacas, localidadId]
  );

  const precioPrevisto = tarifa ? Math.round(tarifa.precio * (1 - PORCENTAJE[tipoDescuento] / 100)) : null;

  function elegirFuncion(valor) {
    setFuncionId(valor);
    setLocalidadId("");
    setFila(null);
    setNumero(null);
    setTipoDescuento("ninguno");
  }

  async function vender(evento) {
    evento.preventDefault();
    setEnviando(true);
    setMensaje(null);
    try {
      const respuesta = await comprarBoleta(
        {
          asistenteId: Number(asistenteId),
          funcionId: Number(funcionId),
          localidadId: Number(localidadId),
          fila,
          numero,
          tipoDescuento
        },
        token
      );
      alTerminar(respuesta.boleta);
    } catch (fallo) {
      setMensaje({ tipo: "error", texto: fallo.message });
      // Si alguien tomó la butaca mientras se elegía, se suelta la elección
      // y el plano se vuelve a pedir para mostrarla ocupada.
      if (fallo.status === 409) {
        setFila(null);
        setNumero(null);
      }
      recargar();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="formulario-panel" onSubmit={vender}>
      <h3>{asistenteFijo ? "Comprar boleta" : "Vender en taquilla"}</h3>
      <Aviso mensaje={mensaje} />
      <div className="formulario-rejilla">
        <div className="ancho-completo">
          <label className="form-label" htmlFor="venta-funcion">Función</label>
          <select id="venta-funcion" className="form-select" required value={funcionId} onChange={(e) => elegirFuncion(e.target.value)}>
            <option value="">Elige una función en venta</option>
            {funciones.map((f) => (
              <option key={f.id} value={f.id}>
                {eventos.get(f.eventoId)?.titulo ?? `Evento ${f.eventoId}`} · {formatearFecha(f.fecha)} · {f.hora}
              </option>
            ))}
          </select>
        </div>

        {!asistenteFijo && (
          <div className="ancho-completo">
            <label className="form-label" htmlFor="venta-asistente">Asistente</label>
            <select id="venta-asistente" className="form-select" required value={asistenteId} onChange={(e) => setAsistenteId(e.target.value)}>
              <option value="">Elige a quién se vende</option>
              {asistentes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre} · {a.documento}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="ancho-completo">
          <label className="form-label" htmlFor="venta-localidad">Localidad</label>
          <select
            id="venta-localidad"
            className="form-select"
            required
            disabled={!butacas || cargandoButacas}
            value={localidadId}
            onChange={(e) => {
              setLocalidadId(e.target.value);
              setFila(null);
              setNumero(null);
            }}
          >
            <option value="">{cargandoButacas && funcionId ? "Cargando tarifas…" : "Elige la zona"}</option>
            {(butacas?.tarifas?.tarifas ?? [])
              .filter((t) => t.activa !== false)
              .sort((a, b) => a.orden - b.orden)
              .map((t) => (
                <option key={t.localidadId} value={t.localidadId}>
                  {t.nombre} · {formatearPesos(t.precio)}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label className="form-label" htmlFor="venta-descuento">Descuento</label>
          <select id="venta-descuento" className="form-select" disabled={!butacas} value={tipoDescuento} onChange={(e) => setTipoDescuento(e.target.value)}>
            {descuentos.map((d) => (
              <option key={d} value={d}>{ETIQUETAS_DESCUENTO[d] ?? d}</option>
            ))}
          </select>
        </div>
      </div>

      {localidad && butacas && (
        <fieldset className="mt-3">
          <legend className="form-label">
            Butaca{fila && numero ? `: fila ${fila}, número ${numero}` : " · elige una en el plano"}
          </legend>
          <PlanoButacas
            localidad={localidad}
            ocupadas={ocupadas}
            fila={fila}
            numero={numero}
            alElegir={(f, n) => {
              setFila(f);
              setNumero(n);
            }}
          />
        </fieldset>
      )}

      <p className="form-text mt-3 mb-0" aria-live="polite">
        {precioPrevisto !== null ? (
          <>
            Precio previsto: <strong className="cifra">{formatearPesos(precioPrevisto)}</strong>. El precio final lo calcula el servidor con la tarifa vigente; la boleta nace reservada.
          </>
        ) : (
          "El precio, el código y el estado los calcula el servidor."
        )}
      </p>

      <div className="formulario-botones">
        <button className="btn btn-primary" type="submit" disabled={enviando || !numero || !asistenteId}>
          {enviando ? "Reservando…" : "Reservar boleta"}
        </button>
        <button className="btn btn-outline-secondary" type="button" onClick={alCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
