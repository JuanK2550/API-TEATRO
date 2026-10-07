// ========================================
// Plano de sala
// Elegir butaca, decir quién eres y confirmar
// ========================================
import * as api from "../api.js";
import { marcarRecienEmitida } from "./boleta.js";
import {
  aFecha,
  aviso,
  avisoDeError,
  cargando,
  diaLargo,
  elemento,
  enlaceBoton,
  icono,
  NOMBRE_DESCUENTO,
  pesos,
  porcentaje,
  PORCENTAJE_DESCUENTO,
  resumenDeErrores
} from "../formato.js";

// Lo elegido vive mientras dure la vista.
let eleccion = null;

// Lo mismo que --sale en la hoja de estilos: la salida del panel.
const SALIDA = 150;

const clave = (localidadId, fila, numero) => `${localidadId}-${fila}-${numero}`;

// ========================================
// Una localidad dibujada a escala
// ========================================
const dibujarLocalidad = (localidad, tarifa, tomadas, alElegir) => {
  const zona = elemento("section", "zona");
  zona.dataset.localidad = localidad.id;

  const encabezado = elemento("div", "zona__encabezado");
  encabezado.appendChild(elemento("h3", "zona__nombre", localidad.nombre));
  encabezado.appendChild(
    elemento("p", "zona__dato", `${pesos.format(tarifa.precio)} · ${localidad.capacidad} butacas`)
  );
  zona.appendChild(encabezado);

  const rejilla = elemento("div", "zona__filas");

  for (let fila = 1; fila <= localidad.filas; fila += 1) {
    const linea = elemento("div", "fila");
    linea.appendChild(elemento("span", "fila__numero", String(fila)));

    for (let numero = 1; numero <= localidad.butacasPorFila; numero += 1) {
      const ocupada = tomadas.has(clave(localidad.id, fila, numero));
      const boton = elemento("button", "butaca");
      boton.type = "button";
      boton.dataset.clave = clave(localidad.id, fila, numero);
      boton.setAttribute(
        "aria-label",
        `${localidad.nombre}, fila ${fila}, butaca ${numero}, ${
          ocupada ? "ocupada" : "disponible"
        }`
      );

      if (ocupada) {
        boton.classList.add("butaca--ocupada");
        boton.disabled = true;
      } else {
        boton.addEventListener("click", () =>
          alElegir({ localidad, tarifa, fila, numero })
        );
      }

      linea.appendChild(boton);
    }

    rejilla.appendChild(linea);
  }

  zona.appendChild(rejilla);
  return zona;
};

// ========================================
// Panel de resumen
// ========================================
const panelResumen = (cuadro, alConfirmar) => {
  const panel = elemento("aside", "resumen");
  panel.setAttribute("aria-live", "polite");

  const cuerpo = elemento("div", "resumen__cuerpo");
  panel.appendChild(elemento("h3", "resumen__titulo", "Tu butaca"));
  panel.appendChild(cuerpo);

  // Si el panel pasa de vacío a lleno, o al revés, entra entero; si solo
  // cambió el descuento, se mueve la cifra, que es lo único distinto.
  let teniaButaca = false;

  const pintar = () => {
    const cambioDeEstado = teniaButaca !== Boolean(eleccion);
    teniaButaca = Boolean(eleccion);

    cuerpo.textContent = "";

    if (cambioDeEstado) {
      cuerpo.dataset.movimiento = "entra";
      requestAnimationFrame(() => delete cuerpo.dataset.movimiento);
    }

    if (!eleccion) {
      cuerpo.appendChild(
        elemento(
          "p",
          "resumen__vacio",
          "Toca una butaca disponible en el plano para empezar."
        )
      );
      return;
    }

    const lista = elemento("dl", "resumen__datos");
    const dato = (rotulo, valor) => {
      lista.appendChild(elemento("dt", "", rotulo));
      lista.appendChild(elemento("dd", "", valor));
    };
    dato("Localidad", eleccion.localidad.nombre);
    dato("Fila", String(eleccion.fila));
    dato("Butaca", String(eleccion.numero));
    cuerpo.appendChild(lista);

    // Solo los descuentos que la función habilita, más "ninguno", que siempre vale.
    const campo = elemento("p", "campo");
    const rotulo = elemento("label", "campo__rotulo", "Descuento");
    rotulo.htmlFor = "descuento";
    campo.appendChild(rotulo);

    const select = elemento("select", "campo__entrada");
    select.id = "descuento";
    select.name = "tipoDescuento";
    ["ninguno", ...cuadro.descuentosHabilitados].forEach((valor) => {
      const opcion = elemento("option", "", NOMBRE_DESCUENTO[valor] || valor);
      opcion.value = valor;
      if (valor === eleccion.tipoDescuento) opcion.selected = true;
      select.appendChild(opcion);
    });
    campo.appendChild(select);
    cuerpo.appendChild(campo);

    const precio = elemento("p", "resumen__precio");
    const base = eleccion.tarifa.precio;
    const estimado = Math.round(base * (1 - PORCENTAJE_DESCUENTO[eleccion.tipoDescuento]));
    precio.appendChild(elemento("span", "precio__rotulo", "Precio estimado"));
    const cifra = elemento("span", "precio__cifra", pesos.format(estimado));
    if (!cambioDeEstado) {
      cifra.dataset.movimiento = "cambia";
    }
    precio.appendChild(cifra);
    cuerpo.appendChild(precio);

    cuerpo.appendChild(
      elemento(
        "p",
        "resumen__nota",
        eleccion.tipoDescuento === "ninguno"
          ? "El precio definitivo lo calcula el servidor al emitir la boleta."
          : `Tarifa ${pesos.format(base)} menos ${porcentaje.format(
              PORCENTAJE_DESCUENTO[eleccion.tipoDescuento]
            )}. El precio definitivo lo calcula el servidor al emitir la boleta.`
      )
    );

    select.addEventListener("change", () => {
      eleccion.tipoDescuento = select.value;
      pintar();
    });

    const seguir = elemento("button", "boton", "Continuar");
    seguir.type = "button";
    seguir.appendChild(icono("flecha"));
    seguir.addEventListener("click", alConfirmar);
    cuerpo.appendChild(seguir);
  };

  panel.pintar = pintar;

  // Soltar la butaca: el panel se va antes de volver a pintarse vacío. Es el
  // único camino que lo vacía, y pasa cuando la butaca se ocupó entre medias.
  panel.vaciar = () => {
    cuerpo.dataset.movimiento = "sale";
    setTimeout(() => {
      eleccion = null;
      pintar();
    }, SALIDA);
  };

  pintar();
  return panel;
};

// ========================================
// Datos del asistente
// Las reglas son las mismas del validador de la API
// ========================================
const REGLAS = [
  {
    nombre: "nombre",
    etiqueta: "Nombre completo",
    tipo: "text",
    ayuda: "Entre 3 y 100 caracteres.",
    autocomplete: "name",
    valida: (v) => (v.trim().length < 3 || v.trim().length > 100
      ? "El nombre debe tener entre 3 y 100 caracteres"
      : /[<>]/.test(v)
        ? "El nombre no puede contener los caracteres < ni >"
        : null)
  },
  {
    nombre: "documento",
    etiqueta: "Documento",
    tipo: "text",
    ayuda: "Entre 5 y 20 caracteres: números, letras o guiones.",
    autocomplete: "off",
    valida: (v) => (!/^[0-9A-Za-z-]{5,20}$/.test(v.trim())
      ? "El documento debe tener entre 5 y 20 caracteres y solo números, letras o guiones"
      : null)
  },
  {
    nombre: "email",
    etiqueta: "Correo electrónico",
    tipo: "email",
    autocomplete: "email",
    valida: (v) => (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
      ? "El email no tiene un formato válido"
      : null)
  },
  {
    nombre: "telefono",
    etiqueta: "Teléfono",
    tipo: "tel",
    ayuda: "Entre 7 y 15 dígitos.",
    autocomplete: "tel",
    valida: (v) => (!/^[0-9]{7,15}$/.test(v.trim())
      ? "El teléfono debe contener entre 7 y 15 dígitos"
      : null)
  },
  {
    nombre: "fechaNacimiento",
    etiqueta: "Fecha de nacimiento",
    tipo: "date",
    autocomplete: "bday",
    valida: (v) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return "Usa el formato AAAA-MM-DD";
      if (aFecha(v) > new Date()) return "La fecha de nacimiento no puede estar en el futuro";
      return null;
    }
  }
];

// El nombre y el correo ya los dio la persona al crear su cuenta: la Sala los
// trae puestos en vez de pedirlos otra vez, y se pueden cambiar.
const formularioAsistente = (alEnviar, usuario) => {
  const form = elemento("form", "formulario");
  form.noValidate = true;

  const YA_CONOCIDOS = usuario
    ? { nombre: usuario.nombre, email: usuario.email }
    : {};

  REGLAS.forEach((regla) => {
    const caja = elemento("p", "campo");
    const rotulo = elemento("label", "campo__rotulo", regla.etiqueta);
    rotulo.htmlFor = regla.nombre;
    caja.appendChild(rotulo);

    const entrada = elemento("input", "campo__entrada");
    entrada.id = regla.nombre;
    entrada.name = regla.nombre;
    entrada.type = regla.tipo;
    entrada.autocomplete = regla.autocomplete;
    if (YA_CONOCIDOS[regla.nombre]) entrada.value = YA_CONOCIDOS[regla.nombre];
    if (regla.ayuda) entrada.setAttribute("aria-describedby", `${regla.nombre}-ayuda`);
    caja.appendChild(entrada);

    if (regla.ayuda) {
      const nota = elemento("span", "campo__ayuda", regla.ayuda);
      nota.id = `${regla.nombre}-ayuda`;
      caja.appendChild(nota);
    }

    caja.appendChild(elemento("strong", "campo__error"));
    form.appendChild(caja);
  });

  const boton = elemento("button", "boton", "Confirmar la compra");
  boton.type = "submit";
  boton.appendChild(icono("flecha"));
  form.appendChild(boton);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const datos = Object.fromEntries(new FormData(form));

    const anterior = form.querySelector(".resumen-error");
    if (anterior) anterior.remove();

    const malos = [];
    REGLAS.forEach((regla) => {
      const entrada = form.querySelector(`[name="${regla.nombre}"]`);
      const caja = entrada.closest(".campo");
      const problema = regla.valida(datos[regla.nombre] || "");
      caja.classList.toggle("campo--malo", Boolean(problema));
      caja.querySelector(".campo__error").textContent = problema || "";
      if (problema) {
        entrada.setAttribute("aria-invalid", "true");
        malos.push({ id: entrada.id, mensaje: `${regla.etiqueta}: ${problema}` });
      } else {
        entrada.removeAttribute("aria-invalid");
      }
    });

    // Con cinco campos, el resumen al principio evita tener que cazarlos uno
    // a uno; cada línea lleva al campo que falla.
    if (malos.length > 0) {
      const resumen = resumenDeErrores(
        malos.length === 1
          ? "Falta un dato por corregir"
          : `Faltan ${malos.length} datos por corregir`,
        malos
      );
      form.prepend(resumen);
      resumen.focus();
      return;
    }

    alEnviar(datos, form, boton);
  });

  return form;
};

// ========================================
// Vista
// ========================================
export const render = async (vista, parametros) => {
  eleccion = null;
  const cargador = elemento("section", "pliego");
  cargador.appendChild(cargando("el plano de la sala"));
  vista.appendChild(cargador);

  try {
    const funcion = await api.funcion(parametros.id);

    // Comprar exige sesión: el asistente lo resuelve el servidor desde el token.
    if (!api.usuarioActual()) {
      vista.textContent = "";
      const puerta = elemento("section", "pliego");
      puerta.appendChild(elemento("h2", "pliego__titulo", "Entra para comprar"));
      puerta.appendChild(
        aviso(
          "La boleta va a nombre de tu cuenta",
          "Así el teatro sabe quién eres sin que tengas que escribir tu documento cada vez, y nadie puede consultar los datos de otra persona.",
          enlaceBoton("Entrar o crear cuenta", "#/entrar")
        )
      );
      puerta.appendChild(
        enlaceBoton("Ver la función", `#/funcion/${funcion.id}`, "boton boton--fantasma")
      );
      vista.appendChild(puerta);
      return;
    }

    const [evento, cuadro, salas, tomadasCrudas, asistenteDeLaCuenta] =
      await Promise.all([
        api.evento(funcion.eventoId),
        api.tarifas(funcion.id),
        api.localidades(),
        api.ocupacion(funcion.id),
        api.miAsistente()
      ]);

    vista.textContent = "";
    const pliego = elemento("section", "pliego");

    const volver = elemento("a", "volver", "Función");
    volver.href = `#/funcion/${funcion.id}`;
    volver.prepend(icono("atras"));
    pliego.appendChild(volver);

    pliego.appendChild(elemento("h2", "pliego__titulo", evento.titulo));
    pliego.appendChild(
      elemento(
        "p",
        "pliego__cuando",
        `${diaLargo.format(aFecha(funcion.fecha, funcion.hora))} · ${funcion.hora} h`
      )
    );

    if (funcion.estado !== "en_venta") {
      pliego.appendChild(
        aviso(
          "Esta función ya no vende butacas",
          `Su estado es ${funcion.estado}.`,
          enlaceBoton("Volver a la cartelera", "#/", "boton boton--fantasma")
        )
      );
      vista.appendChild(pliego);
      return;
    }

    const tomadas = new Set(
      tomadasCrudas.map((b) => clave(b.localidadId, b.fila, b.numero))
    );

    // Dónde estamos en la compra. Lo mueve avanzarPaso().
    const PASOS = ["Butaca", "Datos", "Confirmar", "Boleta"];
    const pasos = elemento("ol", "pasos");
    pasos.setAttribute("aria-label", "Pasos de la compra");
    PASOS.forEach((nombre, i) => {
      const item = elemento("li", "paso", nombre);
      item.dataset.estado = i === 0 ? "actual" : "pendiente";
      pasos.appendChild(item);
    });
    pliego.appendChild(pasos);

    const avanzarPaso = (indice) => {
      [...pasos.children].forEach((item, i) => {
        item.dataset.estado = i < indice ? "hecho" : i === indice ? "actual" : "pendiente";
        if (i === indice) item.setAttribute("aria-current", "step");
        else item.removeAttribute("aria-current");
      });
    };

    const sala = elemento("div", "sala");
    const escenario = elemento("p", "sala__escenario", "Escenario");

    const leyenda = elemento("ul", "leyenda");
    [
      ["butaca", "Disponible"],
      ["butaca butaca--ocupada", "Ocupada"],
      ["butaca butaca--elegida", "Tu butaca"]
    ].forEach(([clases, texto]) => {
      const item = elemento("li");
      const muestra = elemento("span", clases);
      muestra.setAttribute("aria-hidden", "true");
      item.appendChild(muestra);
      item.appendChild(document.createTextNode(texto));
      leyenda.appendChild(item);
    });

    const panel = panelResumen(cuadro, () => {
      avanzarPaso(1);
      const paso = pliego.querySelector("#datos-asistente");
      const yaEstaba = !paso.hidden;
      paso.hidden = false;

      // El paso entra una sola vez: si ya estaba abierto, volver a animarlo
      // solo distrae.
      if (!yaEstaba) {
        paso.dataset.movimiento = "entra";
        paso.addEventListener(
          "animationend",
          () => delete paso.dataset.movimiento,
          { once: true }
        );
      }

      // El primer campo si hay formulario; el botón de confirmar si no lo hay.
      paso.querySelector("input, button").focus();
      paso.scrollIntoView({ block: "start" });
    });

    // Se guarda la butaca elegida en vez de volver a recorrer las 450 cada vez.
    let butacaElegida = null;

    const alElegir = (nueva) => {
      eleccion = { ...nueva, tipoDescuento: "ninguno" };

      if (butacaElegida) {
        butacaElegida.classList.remove("butaca--elegida");
        butacaElegida.setAttribute("aria-pressed", "false");
      }

      butacaElegida = sala.querySelector(
        `[data-clave="${clave(nueva.localidad.id, nueva.fila, nueva.numero)}"]`
      );
      butacaElegida.classList.add("butaca--elegida");
      butacaElegida.setAttribute("aria-pressed", "true");
      panel.pintar();
    };

    // Una línea por localidad, con el color que tiene en el plano y su precio.
    const leyendaZonas = elemento("ul", "leyenda-zonas");
    leyendaZonas.setAttribute("aria-label", "Precio de cada localidad");

    const zonas = salas
      .filter((l) => l.activa && cuadro.tarifas.some((t) => t.localidadId === l.id))
      .sort((a, b) => a.orden - b.orden);

    // En pantallas pequeñas se elige primero la localidad: 450 butacas no caben.
    const selector = elemento("div", "selector-zona");
    selector.setAttribute("role", "group");
    selector.setAttribute("aria-label", "Elige una localidad");
    zonas.forEach((localidad, i) => {
      const tarifa = cuadro.tarifas.find((t) => t.localidadId === localidad.id);
      const boton = elemento(
        "button",
        "selector-zona__boton",
        `${localidad.nombre} · ${pesos.format(tarifa.precio)}`
      );
      boton.type = "button";
      boton.setAttribute("aria-pressed", String(i === 0));
      boton.addEventListener("click", () => {
        selector
          .querySelectorAll(".selector-zona__boton")
          .forEach((b) => b.setAttribute("aria-pressed", "false"));
        boton.setAttribute("aria-pressed", "true");
        sala.dataset.zonaVisible = localidad.id;
        aplicarZonaVisible();
      });
      selector.appendChild(boton);
    });
    sala.dataset.zonaVisible = zonas[0] ? zonas[0].id : "";

    zonas.forEach((localidad) => {
      const tarifa = cuadro.tarifas.find((t) => t.localidadId === localidad.id);
      sala.appendChild(dibujarLocalidad(localidad, tarifa, tomadas, alElegir));

      const linea = elemento("li");
      linea.dataset.localidad = localidad.id;
      const muestra = elemento("span", "butaca");
      muestra.setAttribute("aria-hidden", "true");
      linea.appendChild(muestra);
      linea.appendChild(document.createTextNode(localidad.nombre));
      linea.appendChild(elemento("b", "", pesos.format(tarifa.precio)));
      leyendaZonas.appendChild(linea);
    });

    // Las tres zonas caben juntas en una pantalla ancha; en una estrecha se ve
    // la elegida en el selector, porque 450 butacas no caben de frente.
    const estrecha = window.matchMedia("(max-width: 60rem)");

    const aplicarZonaVisible = () => {
      if (!sala.isConnected) {
        estrecha.removeEventListener("change", aplicarZonaVisible);
        return;
      }
      const unaSola = estrecha.matches;
      selector.hidden = !unaSola;
      zonas.forEach((localidad) => {
        const nodo = sala.querySelector(`.zona[data-localidad="${localidad.id}"]`);
        nodo.hidden = unaSola && String(localidad.id) !== sala.dataset.zonaVisible;
      });
      pista.hidden = sala.scrollWidth <= sala.clientWidth;
    };

    estrecha.addEventListener("change", aplicarZonaVisible);

    const plano = elemento("div", "plano");
    plano.appendChild(selector);
    plano.appendChild(escenario);

    const pista = elemento(
      "p",
      "sala__pista",
      "Desliza el plano de lado para ver la fila completa."
    );
    pista.hidden = true;
    plano.appendChild(pista);

    plano.appendChild(sala);
    plano.appendChild(leyendaZonas);
    plano.appendChild(leyenda);

    const columnas = elemento("div", "plano-y-resumen");
    columnas.appendChild(plano);
    columnas.appendChild(panel);
    pliego.appendChild(columnas);

    // ---------- Datos del asistente ----------
    const bloqueAsistente = elemento("section", "pliego__seccion");
    bloqueAsistente.id = "datos-asistente";
    bloqueAsistente.hidden = true;
    bloqueAsistente.appendChild(elemento("h3", "pliego__rotulo", "¿A nombre de quién?"));

    // El servidor resolvió quién es por el token. Quien ya compró no vuelve a
    // escribir su documento, y la Sala nunca pregunta si un documento existe.
    if (asistenteDeLaCuenta) {
      bloqueAsistente.appendChild(
        elemento(
          "p",
          "pliego__entrada",
          `A nombre de ${asistenteDeLaCuenta.nombre}, documento ${asistenteDeLaCuenta.documento}.`
        )
      );
      bloqueAsistente.appendChild(
        elemento(
          "p",
          "pliego__nota",
          "Son los datos que tu cuenta ya tiene registrados en el teatro."
        )
      );
    } else {
      bloqueAsistente.appendChild(
        elemento(
          "p",
          "pliego__nota",
          "Es la primera compra de tu cuenta, así que necesitamos tus datos. El nombre y el correo vienen de tu cuenta; corrígelos si hace falta. Quedan ligados a ella: la próxima vez no tendrás que escribir nada."
        )
      );
    }

    // ---------- Emisión ----------
    // La usan los dos caminos: el formulario de la primera compra y el botón
    // de quien ya tiene datos ligados a su cuenta.
    const emitir = async (datos, caja, boton) => {
      avanzarPaso(2);
      const textoOriginal = boton.firstChild.textContent;
      boton.disabled = true;
      boton.firstChild.textContent = "Emitiendo…";

      const anterior = caja.querySelector(".resumen-error");
      if (anterior) anterior.remove();

      const fallar = (texto) => {
        const nota = elemento("p", "resumen-error", texto);
        nota.setAttribute("role", "alert");
        caja.prepend(nota);
        nota.scrollIntoView({ block: "center" });
      };

      try {
        let asistente = api.asistenteActual();

        if (!asistente) {
          try {
            asistente = await api.crearMiAsistente(datos);
          } catch (error) {
            if (error.status === 409) {
              fallar(
                `${error.message}. Si ese documento es tuyo, lo registró la taquilla del teatro y allí pueden ligarlo a tu cuenta.`
              );
              return;
            }
            if (error.status === 400) {
              fallar(
                error.errores.map((e) => e.mensaje).join(". ") || error.message
              );
              return;
            }
            throw error;
          }
        }

        const emitida = await api.venderBoleta({
          asistenteId: asistente.id,
          funcionId: funcion.id,
          localidadId: eleccion.localidad.id,
          fila: eleccion.fila,
          numero: eleccion.numero,
          tipoDescuento: eleccion.tipoDescuento
        });

        marcarRecienEmitida(emitida.boleta.id);
        location.hash = `#/boleta/${emitida.boleta.id}`;
      } catch (error) {
        if (error.status === 409) {
          fallar(`${error.message}. Vuelve a elegir butaca: el plano se acaba de actualizar.`);
          // La ocupación se vuelve a pedir: puede haber cambiado hace un segundo.
          const frescas = await api.ocupacion(funcion.id);
          const ahora = new Set(
            frescas.map((b) => clave(b.localidadId, b.fila, b.numero))
          );
          sala.querySelectorAll(".butaca").forEach((boton) => {
            const ocupada = ahora.has(boton.dataset.clave);
            boton.classList.toggle("butaca--ocupada", ocupada);
            boton.classList.remove("butaca--elegida");
            boton.disabled = ocupada;
            boton.setAttribute(
              "aria-label",
              boton.getAttribute("aria-label").replace(/disponible|ocupada/, ocupada ? "ocupada" : "disponible")
            );
          });
          butacaElegida = null;
          panel.vaciar();
          return;
        }
        fallar(error.message);
      } finally {
        boton.disabled = false;
        boton.firstChild.textContent = textoOriginal;
        // Si seguimos aquí es que no se emitió: el paso vuelve a los datos.
        if (caja.isConnected) avanzarPaso(1);
      }
    };

    if (asistenteDeLaCuenta) {
      const confirmar = elemento("button", "boton", "Confirmar la compra");
      confirmar.type = "button";
      confirmar.appendChild(icono("flecha"));
      confirmar.addEventListener("click", () =>
        emitir(null, bloqueAsistente, confirmar)
      );
      bloqueAsistente.appendChild(confirmar);
    } else {
      bloqueAsistente.appendChild(
        formularioAsistente(
          (datos, form, boton) => emitir(datos, form, boton),
          api.usuarioActual()
        )
      );
    }

    pliego.appendChild(bloqueAsistente);

    vista.appendChild(pliego);
    aplicarZonaVisible();
  } catch (error) {
    cargador.textContent = "";
    cargador.appendChild(avisoDeError(error));
  }
};
