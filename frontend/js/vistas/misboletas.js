// ========================================
// Mis boletas
// Solo las del asistente de esta sesión
// ========================================
// Se piden a GET /api/boletas/mias, que resuelve el asistente desde el token:
// no hay ningún id en la dirección que alguien pueda cambiar para leer las
// boletas de otra persona.
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
// Una boleta de la lista
// ========================================
const fila = (boleta, funcion, evento, localidad, alCancelar, cambioDeEstado) => {
  const item = elemento("li", "boleta");

  const identidad = elemento("div", "boleta__identidad");
  identidad.appendChild(elemento("p", "boleta__codigo", boleta.codigo));
  identidad.appendChild(
    elemento("p", "boleta__obra", evento ? evento.titulo : `Función ${boleta.funcionId}`)
  );
  if (funcion) {
    identidad.appendChild(
      elemento(
        "p",
        "boleta__ficha",
        `${diaLargo.format(aFecha(funcion.fecha, funcion.hora))} · ${funcion.hora} h`
      )
    );
  }
  item.appendChild(identidad);

  const butaca = elemento("div", "boleta__butaca");
  butaca.appendChild(
    elemento(
      "p",
      "boleta__ficha",
      localidad ? localidad.nombre : `Localidad ${boleta.localidadId}`
    )
  );
  butaca.appendChild(
    elemento("p", "boleta__sitio", `Fila ${boleta.fila} · Butaca ${boleta.numero}`)
  );
  if (boleta.tipoDescuento !== "ninguno") {
    butaca.appendChild(
      elemento("p", "boleta__ficha", NOMBRE_DESCUENTO[boleta.tipoDescuento])
    );
  }
  item.appendChild(butaca);

  const precio = elemento("p", "precio");
  precio.appendChild(elemento("span", "precio__rotulo", "Pagado"));
  precio.appendChild(elemento("span", "precio__cifra", pesos.format(boleta.precio)));
  item.appendChild(precio);

  const cierre = elemento("div", "boleta__cierre");
  const sello = chipEstado(boleta.estado);
  if (cambioDeEstado) sello.dataset.movimiento = "cambia";
  cierre.appendChild(sello);
  cierre.appendChild(
    enlaceBoton("Ver talón", `#/boleta/${boleta.id}`, "boton boton--fantasma")
  );

  // Solo reservada y pagada admiten cancelación; usada y cancelada son terminales.
  if (boleta.estado === "reservada" || boleta.estado === "pagada") {
    const cancelar = elemento("button", "boton boton--texto", "Cancelar");
    cancelar.type = "button";
    cancelar.addEventListener("click", () => alCancelar(boleta, cancelar, item));
    cierre.appendChild(cancelar);
  }

  item.appendChild(cierre);
  return item;
};

// ========================================
// Vista
// ========================================
export const render = async (vista) => {
  const pliego = elemento("section", "pliego");
  pliego.appendChild(elemento("h2", "pliego__titulo", "Mis boletas"));
  vista.appendChild(pliego);

  if (!api.usuarioActual()) {
    pliego.appendChild(
      aviso(
        "Entra para ver tus boletas",
        "Las boletas van a nombre de tu cuenta. La sesión vive solo en la memoria de esta pestaña, así que al recargar hay que entrar de nuevo.",
        enlaceBoton("Entrar", "#/entrar")
      )
    );
    return;
  }

  const cargador = cargando("tus boletas");
  pliego.appendChild(cargador);

  try {
    const boletas = await api.misBoletas();
    const asistente = api.asistenteActual();

    if (asistente) {
      cargador.before(
        elemento(
          "p",
          "pliego__entrada",
          `A nombre de ${asistente.nombre}, documento ${asistente.documento}.`
        )
      );
    }
    const [funciones, eventos, localidades] = await Promise.all([
      api.funciones(),
      api.eventos(),
      api.localidades()
    ]);

    cargador.remove();

    if (boletas.length === 0) {
      pliego.appendChild(
        aviso(
          "Sin boletas",
          "Tu cuenta todavía no tiene boletas emitidas.",
          enlaceBoton("Ver la cartelera", "#/")
        )
      );
      return;
    }

    const alCancelar = async (boleta, boton, item) => {
      boton.disabled = true;
      const etiqueta = boton.textContent;
      boton.textContent = "Cancelando…";
      try {
        const respuesta = await api.cambiarEstadoBoleta(boleta.id, "cancelada");
        const localidad = localidades.find((l) => l.id === respuesta.boleta.localidadId);
        const funcion = funciones.find((f) => f.id === respuesta.boleta.funcionId);
        const evento = funcion && eventos.find((e) => e.id === funcion.eventoId);
        item.replaceWith(
          fila(respuesta.boleta, funcion, evento, localidad, alCancelar, true)
        );
      } catch (error) {
        const fallo = elemento("p", "resumen-error", error.message);
        fallo.setAttribute("role", "alert");
        item.appendChild(fallo);
        boton.disabled = false;
        boton.textContent = etiqueta;
      }
    };

    const lista = elemento("ul", "boletas");
    boletas
      .slice()
      .sort((a, b) => b.id - a.id)
      .forEach((boleta) => {
        const funcion = funciones.find((f) => f.id === boleta.funcionId);
        const evento = funcion && eventos.find((e) => e.id === funcion.eventoId);
        const localidad = localidades.find((l) => l.id === boleta.localidadId);
        lista.appendChild(fila(boleta, funcion, evento, localidad, alCancelar));
      });
    pliego.appendChild(lista);

    const pie = elemento("div", "acciones");
    pie.appendChild(enlaceBoton("Volver a la cartelera", "#/", "boton boton--fantasma"));
    pliego.appendChild(pie);
  } catch (error) {
    cargador.remove();
    pliego.appendChild(avisoDeError(error));
  }
};
