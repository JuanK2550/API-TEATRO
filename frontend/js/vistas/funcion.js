// ========================================
// Función
// Cuadro de tarifas por cercanía al escenario y descuentos habilitados
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
  pesos,
  porcentaje,
  PORCENTAJE_DESCUENTO
} from "../formato.js";

const RAZON_NO_VENTA = {
  programada:
    "La función todavía no abre venta. Cuando el teatro la ponga en venta, aquí aparecerá el plano de la sala.",
  agotada: "No quedan butacas para esta función.",
  en_curso: "La función ya empezó.",
  finalizada: "Esta función ya se presentó.",
  cancelada: "El teatro canceló esta función."
};

// El cuadro llega ordenado por cercanía al escenario: orden 1 es la fila más
// cerca y la más cara.
const cuadroTarifas = (tarifas) => {
  const tabla = elemento("table", "tarifas");
  const cabeza = elemento("thead");
  const filaCabeza = elemento("tr");
  ["Localidad", "Cercanía", "Precio"].forEach((t) => {
    const celda = elemento("th", "", t);
    celda.scope = "col";
    filaCabeza.appendChild(celda);
  });
  cabeza.appendChild(filaCabeza);
  tabla.appendChild(cabeza);

  const cuerpo = elemento("tbody");
  tarifas.forEach((tarifa) => {
    const fila = elemento("tr");

    const localidad = elemento("th");
    localidad.scope = "row";
    localidad.appendChild(elemento("span", "tarifas__nombre", tarifa.nombre));
    localidad.appendChild(elemento("span", "tarifas__codigo", tarifa.codigo));
    fila.appendChild(localidad);

    fila.appendChild(
      elemento(
        "td",
        "tarifas__orden",
        tarifa.orden === 1 ? "La más cerca" : `${tarifa.orden}ª desde el escenario`
      )
    );
    fila.appendChild(elemento("td", "tarifas__precio", pesos.format(tarifa.precio)));
    cuerpo.appendChild(fila);
  });
  tabla.appendChild(cuerpo);
  return tabla;
};

const cuadroDescuentos = (habilitados) => {
  const caja = elemento("div", "descuentos");
  caja.appendChild(elemento("h3", "pliego__rotulo", "Descuentos habilitados"));

  if (habilitados.length === 0) {
    caja.appendChild(
      elemento(
        "p",
        "pliego__nota",
        "Esta función no habilita descuentos: todas las boletas se venden a tarifa plena."
      )
    );
    return caja;
  }

  const lista = elemento("ul", "descuentos__lista");
  habilitados.forEach((clave) => {
    const item = elemento("li", "descuento");
    item.appendChild(
      elemento("span", "descuento__nombre", NOMBRE_DESCUENTO[clave] || clave)
    );
    item.appendChild(
      elemento(
        "span",
        "descuento__cifra",
        `- ${porcentaje.format(PORCENTAJE_DESCUENTO[clave] || 0)}`
      )
    );
    lista.appendChild(item);
  });
  caja.appendChild(lista);
  caja.appendChild(
    elemento(
      "p",
      "pliego__nota",
      "El precio final lo calcula el servidor al emitir la boleta: el navegador nunca lo propone."
    )
  );
  return caja;
};

export const render = async (vista, parametros) => {
  const cuerpo = elemento("section", "pliego");
  cuerpo.appendChild(cargando("la función"));
  vista.appendChild(cuerpo);

  try {
    const funcion = await api.funcion(parametros.id);
    const [evento, cuadro] = await Promise.all([
      api.evento(funcion.eventoId),
      api.tarifas(funcion.id)
    ]);

    vista.textContent = "";

    const pliego = elemento("section", "pliego");
    pliego.setAttribute("aria-labelledby", "titulo-funcion");

    const volver = elemento("a", "volver", "Todas sus funciones");
    volver.href = `#/evento/${evento.id}`;
    volver.prepend(icono("atras"));
    pliego.appendChild(volver);

    const titulo = elemento("h2", "pliego__titulo", evento.titulo);
    titulo.id = "titulo-funcion";
    pliego.appendChild(titulo);

    const cuando = elemento("p", "pliego__cuando");
    cuando.appendChild(
      elemento(
        "span",
        "pliego__fecha",
        diaLargo.format(aFecha(funcion.fecha, funcion.hora))
      )
    );
    cuando.appendChild(elemento("span", "pliego__hora", `${funcion.hora} h`));
    pliego.appendChild(cuando);

    const estado = elemento("p", "pliego__estado");
    estado.appendChild(chipEstado(funcion.estado));
    pliego.appendChild(estado);

    pliego.appendChild(elemento("h3", "pliego__rotulo", "Precio por localidad"));
    pliego.appendChild(cuadroTarifas(cuadro.tarifas));
    pliego.appendChild(cuadroDescuentos(cuadro.descuentosHabilitados));

    const cierre = elemento("div", "pliego__cierre");
    if (funcion.estado === "en_venta") {
      cierre.appendChild(
        enlaceBoton("Elegir butaca en el plano", `#/funcion/${funcion.id}/butacas`)
      );
    } else {
      cierre.appendChild(
        aviso(
          "Sin venta por ahora",
          RAZON_NO_VENTA[funcion.estado] || "Esta función no admite venta.",
          enlaceBoton("Ver otras funciones", "#/", "boton boton--fantasma")
        )
      );
    }
    pliego.appendChild(cierre);

    vista.appendChild(pliego);
  } catch (error) {
    cuerpo.textContent = "";
    cuerpo.appendChild(avisoDeError(error));
  }
};
