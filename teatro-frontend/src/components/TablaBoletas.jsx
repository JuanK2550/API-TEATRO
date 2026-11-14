import EstadoInsignia from "./EstadoInsignia";
import { ETIQUETAS_DESCUENTO, formatearFecha, formatearPesos } from "../utils/formato";

// ========================================
// Tabla de boletas
// Las acciones las decide quien la usa, según su rol
// ========================================
export default function TablaBoletas({ boletas, funciones, eventos, localidades, asistentes, acciones, cargando, vacio }) {
  const conAsistente = Boolean(asistentes);

  return (
    <div className="tabla-contenedor">
      <table className="table table-hover">
        <thead>
          <tr>
            <th scope="col">Código</th>
            <th scope="col">Función</th>
            {conAsistente && <th scope="col">Asistente</th>}
            <th scope="col">Ubicación</th>
            <th scope="col">Precio</th>
            <th scope="col">Estado</th>
            <th scope="col">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {boletas.map((b) => {
            const funcion = funciones.get(b.funcionId);
            const titulo = funcion ? eventos.get(funcion.eventoId)?.titulo ?? `Evento ${funcion.eventoId}` : `Función ${b.funcionId}`;
            const botones = acciones(b);
            return (
              <tr key={b.id}>
                <td className="codigo text-nowrap">{b.codigo}</td>
                <td>
                  {titulo}
                  {funcion && (
                    <div className="texto-secundario cifra">
                      {formatearFecha(funcion.fecha)} · {funcion.hora}
                    </div>
                  )}
                </td>
                {conAsistente && <td>{asistentes.get(b.asistenteId)?.nombre ?? `Asistente ${b.asistenteId}`}</td>}
                <td>
                  {localidades.get(b.localidadId)?.nombre ?? "Localidad"}
                  <div className="texto-secundario cifra">
                    Fila {b.fila} · butaca {b.numero}
                  </div>
                </td>
                <td>
                  <span className="cifra">{formatearPesos(b.precio)}</span>
                  <div className="texto-secundario">{ETIQUETAS_DESCUENTO[b.tipoDescuento] ?? b.tipoDescuento}</div>
                </td>
                <td>
                  <EstadoInsignia estado={b.estado} />
                </td>
                <td>
                  <div className="tabla-acciones">
                    {botones.length ? botones : <span className="texto-secundario">—</span>}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!cargando && boletas.length === 0 && <p className="vacio">{vacio}</p>}
    </div>
  );
}
