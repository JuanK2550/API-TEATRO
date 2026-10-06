// ========================================
// Boleta emitida
// El talón muestra exactamente lo que devolvió el servidor
// ========================================
import * as api from "../api.js";
import {
  aFecha,
  aviso,
  avisoDeError,
  cargando,
  chipEstado,
  diaLargo,
  elemento,
  enlaceBoton,
  icono,
  NOMBRE_DESCUENTO,
  pesos
} from "../formato.js";

// ========================================
// Boleta recién emitida
// La marca la vista de butacas justo antes de navegar
// ========================================
// Solo el talón que acaba de salir entra desde abajo. El que se abre desde
// "Mis boletas" aparece sin más: ya se había visto antes.
let recienEmitida = null;

export const marcarRecienEmitida = (id) => {
  recienEmitida = Number(id);
};

// ========================================
// Talón troquelado
// ========================================
const talon = (boleta, funcion, evento, localidad, movimiento) => {
  const caja = elemento("article", "talon");
  if (movimiento) caja.dataset.movimiento = movimiento;

  const cuerpo = elemento("div", "talon__cuerpo");
  cuerpo.appendChild(elemento("p", "talon__sello", "Teatro Maldonado de Tunja"));
  cuerpo.appendChild(elemento("h2", "talon__obra", evento.titulo));
  cuerpo.appendChild(
    elemento(
      "p",
      "talon__cuando",
      `${diaLargo.format(aFecha(funcion.fecha, funcion.hora))} · ${funcion.hora} h`
    )
  );

  const datos = elemento("dl", "talon__datos");
  const dato = (rotulo, valor) => {
    datos.appendChild(elemento("dt", "", rotulo));
    datos.appendChild(elemento("dd", "", valor));
  };
  dato("Localidad", localidad ? localidad.nombre : `Localidad ${boleta.localidadId}`);
  dato("Fila", String(boleta.fila));
  dato("Butaca", String(boleta.numero));
  dato("Tarifa", NOMBRE_DESCUENTO[boleta.tipoDescuento] || boleta.tipoDescuento);
  cuerpo.appendChild(datos);
  caja.appendChild(cuerpo);

  const colilla = elemento("div", "talon__colilla");
  colilla.appendChild(elemento("p", "talon__rotulo", "Código"));
  colilla.appendChild(elemento("p", "talon__codigo", boleta.codigo));
  colilla.appendChild(
    elemento(
      "p",
      "talon__rotulo",
      boleta.estado === "pagada" || boleta.estado === "usada" ? "Valor pagado" : "Valor"
    )
  );
  colilla.appendChild(elemento("p", "talon__precio", pesos.format(boleta.precio)));
  const sello = chipEstado(boleta.estado);
  if (movimiento === "estado") sello.dataset.movimiento = "cambia";
  colilla.appendChild(sello);
  caja.appendChild(colilla);

  return caja;
};

// ========================================
// Vista
// ========================================
export const render = async (vista, parametros) => {
  const cargador = elemento("section", "pliego");
  cargador.appendChild(cargando("tu boleta"));
  vista.appendChild(cargador);

  try {
    let boleta = await api.boleta(parametros.id);
    const funcion = await api.funcion(boleta.funcionId);
    const [evento, localidades] = await Promise.all([
      api.evento(funcion.eventoId),
      api.localidades()
    ]);
    const localidad = localidades.find((l) => l.id === boleta.localidadId);

    let movimiento = recienEmitida === boleta.id ? "emitida" : null;
    recienEmitida = null;

    const pintar = () => {
      vista.textContent = "";
      const pliego = elemento("section", "pliego");

      pliego.appendChild(
        elemento("p", "pliego__rotulo", "Boleta emitida")
      );
      pliego.appendChild(talon(boleta, funcion, evento, localidad, movimiento));

      const acciones = elemento("div", "acciones");

      if (boleta.estado === "reservada") {
        const nota = elemento("div", "simulacion");
        nota.appendChild(elemento("p", "simulacion__sello", "Simulación"));
        nota.appendChild(
          elemento(
            "p",
            "simulacion__cuerpo",
            "Esta Sala no cobra nada: no hay pasarela de pago ni se envían datos a ningún banco. El botón solo cambia el estado de la boleta a pagada para poder seguir la demostración."
          )
        );

        const pagar = elemento("button", "boton", "Pago simulado");
        pagar.type = "button";
        pagar.appendChild(icono("flecha"));
        pagar.addEventListener("click", async () => {
          pagar.disabled = true;
          const etiqueta = pagar.firstChild.textContent;
          pagar.firstChild.textContent = "Registrando…";
          try {
            const respuesta = await api.cambiarEstadoBoleta(boleta.id, "pagada");
            boleta = respuesta.boleta;
            // Lo que cambió es el estado: el talón no vuelve a entrar entero.
            movimiento = "estado";
            pintar();
          } catch (error) {
            const fallo = elemento("p", "resumen-error", error.message);
            fallo.setAttribute("role", "alert");
            nota.appendChild(fallo);
            pagar.disabled = false;
            pagar.firstChild.textContent = etiqueta;
          }
        });

        nota.appendChild(pagar);
        pliego.appendChild(nota);
      }

      if (boleta.estado === "pagada") {
        pliego.appendChild(
          aviso(
            "Pago simulado registrado",
            "La boleta quedó en estado pagada. En la puerta de la sala, con la función en curso, la taquilla la marcará como usada."
          )
        );
      }

      if (boleta.estado === "cancelada") {
        pliego.appendChild(
          aviso(
            "Boleta cancelada",
            "La butaca volvió al plano de la sala y puede venderse de nuevo. La boleta se conserva como registro."
          )
        );
      }

      acciones.appendChild(
        enlaceBoton("Ver mis boletas", "#/mis-boletas", "boton boton--fantasma")
      );
      acciones.appendChild(
        enlaceBoton("Volver a la cartelera", "#/", "boton boton--fantasma")
      );
      pliego.appendChild(acciones);

      vista.appendChild(pliego);
    };

    pintar();
  } catch (error) {
    cargador.textContent = "";
    cargador.appendChild(avisoDeError(error));
  }
};
