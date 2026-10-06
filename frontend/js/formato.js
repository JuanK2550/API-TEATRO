// ========================================
// Piezas compartidas por las vistas
// ========================================
export const PALABRA_ESTADO = {
  en_venta: "En venta",
  programada: "Programada",
  agotada: "Agotada",
  en_curso: "En curso",
  finalizada: "Finalizada",
  cancelada: "Cancelada"
};

// Los porcentajes son los mismos de PORCENTAJES_DESCUENTO en
// src/services/boletas.service.js. La API expone qué descuentos habilita cada
// función, pero no cuánto descuenta cada uno, así que la tabla se repite aquí.
export const PORCENTAJE_DESCUENTO = {
  ninguno: 0,
  estudiante: 0.2,
  infantil: 0.5,
  adultoMayor: 0.3
};

export const NOMBRE_DESCUENTO = {
  ninguno: "Sin descuento",
  estudiante: "Estudiante",
  infantil: "Infantil",
  adultoMayor: "Adulto mayor"
};

export const pesos = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0
});

export const porcentaje = new Intl.NumberFormat("es-CO", {
  style: "percent",
  maximumFractionDigits: 0
});

export const diaLargo = new Intl.DateTimeFormat("es-CO", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric"
});

// Las fechas vienen como YYYY-MM-DD: se arman a mano para que no las corra la
// zona horaria del navegador.
export const aFecha = (fecha, hora = "00:00") => {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const [h, m] = hora.split(":").map(Number);
  return new Date(anio, mes - 1, dia, h, m);
};

export const esFutura = (funcion) =>
  aFecha(funcion.fecha, funcion.hora) >= new Date();

export const precioDesde = (funcion) =>
  funcion.tarifas.reduce((menor, t) => Math.min(menor, t.precio), Infinity);

// Cada tipo de evento entra con su propia fotografía del teatro.
export const FOTO_POR_TIPO = {
  obra: {
    archivo: "telon-rojo",
    alt: "Telón rojo de terciopelo iluminado desde el escenario"
  },
  concierto: {
    archivo: "escenario-luces",
    alt: "Escenario vacío con los focos encendidos"
  },
  cine: {
    archivo: "butacas-vacias",
    alt: "Filas de butacas de terciopelo rojo en penumbra"
  },
  institucional: {
    archivo: "publico-sala",
    alt: "Público sentado en la sala durante una función"
  }
};

export const elemento = (etiqueta, clase, texto) => {
  const nodo = document.createElement(etiqueta);
  if (clase) nodo.className = clase;
  if (texto !== undefined) nodo.textContent = texto;
  return nodo;
};

const TRAZOS = {
  flecha: "M5 12h13M13 6l6 6-6 6",
  atras: "M19 12H6M11 18l-6-6 6-6",
  reloj: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  salir: "M16 17l5-5-5-5M21 12H9M12 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6",
  alerta: "M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"
};

export const icono = (nombre) => {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "icono");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const trazo = document.createElementNS("http://www.w3.org/2000/svg", "path");
  trazo.setAttribute("d", TRAZOS[nombre]);
  svg.appendChild(trazo);
  return svg;
};

// El color nunca va solo: cada estado lleva su palabra.
export const chipEstado = (estado) =>
  elemento("span", `estado estado--${estado}`, PALABRA_ESTADO[estado] || estado);

export const enlaceBoton = (texto, destino, clase = "boton") => {
  const enlace = elemento("a", clase, texto);
  enlace.href = destino;
  enlace.appendChild(icono("flecha"));
  return enlace;
};

// ========================================
// Estados de la página
// ========================================
export const cargando = (que) => {
  const caja = elemento("div", "esqueleto");
  caja.setAttribute("aria-live", "polite");
  caja.setAttribute("aria-busy", "true");
  caja.appendChild(elemento("p", "a-fondo", `Cargando ${que}`));
  for (let i = 0; i < 3; i += 1) caja.appendChild(elemento("div", "esqueleto__linea"));
  return caja;
};

export const aviso = (titulo, cuerpo, accion) => {
  const caja = elemento("div", "aviso");
  caja.appendChild(elemento("h3", "aviso__titulo", titulo));
  caja.appendChild(elemento("p", "aviso__cuerpo", cuerpo));
  if (accion) caja.appendChild(accion);
  return caja;
};

// ========================================
// Un error de la API contado en palabras
// ========================================
// ========================================
// Resumen de errores de un formulario
// Enlaza cada problema con su campo y recibe el foco
// ========================================
// El error de cada campo se queda donde está: el resumen no lo reemplaza, lo
// acompaña, porque con cinco campos malos a la vez no se ven todos de un
// vistazo.
export const resumenDeErrores = (titulo, problemas) => {
  const caja = elemento("div", "resumen-error");
  caja.setAttribute("role", "alert");
  caja.tabIndex = -1;

  const cabeza = elemento("p", "resumen-error__titulo");
  cabeza.appendChild(icono("alerta"));
  cabeza.appendChild(document.createTextNode(titulo));
  caja.appendChild(cabeza);

  if (problemas.length > 0) {
    const lista = elemento("ul", "resumen-error__lista");
    problemas.forEach(({ id, mensaje }) => {
      const item = elemento("li");
      if (id) {
        const enlace = elemento("a", "", mensaje);
        enlace.href = `#${id}`;
        enlace.addEventListener("click", (e) => {
          e.preventDefault();
          const campo = document.getElementById(id);
          if (campo) campo.focus();
        });
        item.appendChild(enlace);
      } else {
        item.textContent = mensaje;
      }
      lista.appendChild(item);
    });
    caja.appendChild(lista);
  }

  return caja;
};

export const avisoDeError = (error) => {
  if (error && error.status === 401) {
    return aviso(
      "La aplicación no pudo identificarse",
      "El servidor rechazó la API Key de la aplicación web. Revisa que API_KEY_WEB esté en el .env y reinicia el servidor."
    );
  }

  if (error && error.status === 404) {
    return aviso(
      "No encontramos eso",
      "El enlace apunta a algo que ya no está en cartel.",
      enlaceBoton("Volver a la cartelera", "#/", "boton boton--fantasma")
    );
  }

  return aviso(
    "No se pudo cargar",
    `${error.message}. Comprueba que la API esté corriendo en este mismo servidor.`
  );
};
