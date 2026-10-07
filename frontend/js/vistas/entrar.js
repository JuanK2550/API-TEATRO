// ========================================
// Bienvenido a la Sala
// Pantalla partida: la foto a un lado, el formulario al otro
// ========================================
// El rol lo pone el servidor: el formulario no lo menciona.
import * as api from "../api.js";
import {
  aviso,
  cargando,
  elemento,
  enlaceBoton,
  figura,
  FOTOS_DEL_TEATRO,
  icono,
  resumenDeErrores
} from "../formato.js";

// Los dos formularios comparten nombres de campo, así que el id lleva delante
// el del formulario: dos id iguales en la página romperían la relación entre
// cada etiqueta y su campo.
const campo = (formulario, nombre, etiqueta, tipo, ayuda, extra = {}) => {
  const id = `${formulario}-${nombre}`;
  const caja = elemento("p", "campo");

  const rotulo = elemento("label", "campo__rotulo", etiqueta);
  rotulo.htmlFor = id;
  caja.appendChild(rotulo);

  const entrada = elemento("input", "campo__entrada");
  entrada.id = id;
  entrada.name = nombre;
  entrada.type = tipo;
  entrada.required = true;
  Object.entries(extra).forEach(([k, v]) => entrada.setAttribute(k, v));
  if (ayuda) entrada.setAttribute("aria-describedby", `${id}-ayuda`);
  caja.appendChild(entrada);

  if (ayuda) {
    const nota = elemento("span", "campo__ayuda", ayuda);
    nota.id = `${id}-ayuda`;
    caja.appendChild(nota);
  }

  caja.appendChild(elemento("strong", "campo__error"));
  return caja;
};

const limpiarErrores = (formulario) => {
  formulario.querySelectorAll(".campo").forEach((c) => {
    c.classList.remove("campo--malo");
    c.querySelector(".campo__error").textContent = "";
    c.querySelector(".campo__entrada").removeAttribute("aria-invalid");
  });
  const resumen = formulario.querySelector(".resumen-error");
  if (resumen) resumen.remove();
};

// El 400 del validador trae { campo, mensaje }: cada mensaje va bajo su campo
// y además al resumen, que es lo que recibe el foco.
const pintarError = (formulario, error) => {
  limpiarErrores(formulario);

  const problemas = [];

  (error.errores || []).forEach(({ campo: nombre, mensaje }) => {
    const entrada = formulario.querySelector(`[name="${nombre}"]`);
    if (!entrada) {
      problemas.push({ id: null, mensaje });
      return;
    }
    const caja = entrada.closest(".campo");
    caja.classList.add("campo--malo");
    caja.querySelector(".campo__error").textContent = mensaje;
    entrada.setAttribute("aria-invalid", "true");
    problemas.push({
      id: entrada.id,
      mensaje: `${caja.querySelector(".campo__rotulo").textContent}: ${mensaje}`
    });
  });

  const resumen = resumenDeErrores(
    problemas.length > 0 ? "Revisa lo que escribiste" : error.message,
    problemas
  );
  formulario.prepend(resumen);
  resumen.focus({ preventScroll: false });
};

const conEnvio = (formulario, boton, trabajo) => {
  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    limpiarErrores(formulario);

    const textoOriginal = boton.firstChild.textContent;
    boton.disabled = true;
    boton.firstChild.textContent = "Un momento…";

    try {
      await trabajo(Object.fromEntries(new FormData(formulario)));
    } catch (error) {
      pintarError(formulario, error);
    } finally {
      boton.disabled = false;
      boton.firstChild.textContent = textoOriginal;
    }
  });
};

// ========================================
// Perfil
// Quién está autenticado, según el servidor
// ========================================
// El correo y el rol se piden a GET /api/auth/perfil: los dice el servidor, no
// el navegador. El nombre viene de la respuesta del login, porque el token solo
// lleva el id, el correo y el rol.
const pintarPerfil = async (caja) => {
  const cargador = cargando("tu perfil");
  caja.appendChild(cargador);

  try {
    const { usuario, clienteApi } = await api.perfil();

    cargador.remove();

    const ficha = elemento("dl", "perfil");
    const dato = (rotulo, valor) => {
      ficha.appendChild(elemento("dt", "", rotulo));
      ficha.appendChild(elemento("dd", "", valor));
    };
    dato("Nombre", api.usuarioActual().nombre);
    dato("Correo", usuario.email);
    dato("Rol", usuario.rol);
    dato("Aplicación", clienteApi.nombre);
    caja.appendChild(ficha);

    caja.appendChild(
      elemento(
        "p",
        "pliego__nota",
        "El correo y el rol los acaba de confirmar el servidor en GET /api/auth/perfil, que exige las dos credenciales: la API Key de la aplicación y tu token. El rol lo asigna el teatro, no el formulario. Tu sesión vive solo en la memoria de esta pestaña: al recargar hay que volver a entrar."
      )
    );
  } catch (error) {
    cargador.remove();
    caja.appendChild(aviso("No se pudo leer tu perfil", `${error.message}.`));
  }
};

// ========================================
// Pestañas
// Una sola a la vista; la que entra se funde
// ========================================
const pestanas = (paneles) => {
  const tiras = elemento("div", "pestanas");
  tiras.setAttribute("role", "tablist");
  tiras.setAttribute("aria-label", "Entrar o crear cuenta");

  const botones = paneles.map(({ id, titulo }, i) => {
    const b = elemento("button", "pestana", titulo);
    b.type = "button";
    b.id = `pestana-${id}`;
    b.setAttribute("role", "tab");
    b.setAttribute("aria-controls", `panel-${id}`);
    b.setAttribute("aria-selected", String(i === 0));
    b.tabIndex = i === 0 ? 0 : -1;
    tiras.appendChild(b);
    return b;
  });

  const mostrar = (indice, moverFoco = true) => {
    paneles.forEach(({ panel }, i) => {
      const activo = i === indice;
      botones[i].setAttribute("aria-selected", String(activo));
      botones[i].tabIndex = activo ? 0 : -1;
      panel.hidden = !activo;
      if (activo) {
        panel.dataset.movimiento = "entra";
        panel.addEventListener(
          "animationend",
          () => delete panel.dataset.movimiento,
          { once: true }
        );
      }
    });
    if (moverFoco) botones[indice].focus();
  };

  botones.forEach((b, i) => {
    b.addEventListener("click", () => mostrar(i, false));
    // Flechas entre pestañas, que es como se espera que funcionen.
    b.addEventListener("keydown", (e) => {
      const salto = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!salto) return;
      e.preventDefault();
      mostrar((i + salto + botones.length) % botones.length);
    });
  });

  paneles.forEach(({ id, panel }, i) => {
    panel.id = `panel-${id}`;
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", `pestana-${id}`);
    panel.tabIndex = 0;
    panel.hidden = i !== 0;
  });

  return tiras;
};

// ========================================
// Vista
// ========================================
export const render = (vista, parametros, contexto) => {
  const escena = elemento("section", "bienvenida");

  // ---------- Lado de la fotografía ----------
  const lado = elemento("div", "bienvenida__foto");
  lado.appendChild(figura(FOTOS_DEL_TEATRO[0], { viva: true, ancho: "(max-width: 60rem) 100vw, 50vw" }));
  lado.appendChild(elemento("div", "bienvenida__velo"));

  const frase = elemento("div", "bienvenida__frase");
  frase.appendChild(elemento("p", "pliego__rotulo", "Teatro Maldonado de Tunja"));
  frase.appendChild(
    elemento("p", "bienvenida__lema", "La función empieza cuando eliges tu butaca.")
  );
  lado.appendChild(frase);
  escena.appendChild(lado);

  // ---------- Lado del formulario ----------
  const tarjeta = elemento("div", "bienvenida__tarjeta");
  tarjeta.setAttribute("aria-labelledby", "titulo-entrar");

  const titulo = elemento("h2", "bienvenida__titulo", "Bienvenido a la Sala");
  titulo.id = "titulo-entrar";
  tarjeta.appendChild(titulo);

  if (contexto && contexto.aviso) {
    const nota = elemento("p", "resumen-error", contexto.aviso);
    nota.setAttribute("role", "alert");
    tarjeta.appendChild(nota);
  }

  const usuario = api.usuarioActual();
  if (usuario) {
    titulo.textContent = "Tu sesión";
    tarjeta.appendChild(
      elemento("p", "bienvenida__entrada", `Entraste como ${usuario.nombre}.`)
    );

    const caja = elemento("div");
    tarjeta.appendChild(caja);
    pintarPerfil(caja);

    const acciones = elemento("div", "acciones");
    acciones.appendChild(
      enlaceBoton("Mis boletas", "#/mis-boletas", "boton boton--fantasma")
    );

    const salir = elemento("button", "boton boton--fantasma", "Cerrar sesión");
    salir.type = "button";
    salir.appendChild(icono("salir"));
    salir.addEventListener("click", () => {
      // cerrarSesion ya borra el token, el asistente y la marca de sesión.
      api.cerrarSesion();
      // Recargar es la garantía dura: el token no queda ni en una variable.
      location.hash = "#/entrar";
      location.reload();
    });
    acciones.appendChild(salir);

    tarjeta.appendChild(acciones);
    escena.appendChild(tarjeta);
    vista.appendChild(escena);
    return;
  }

  tarjeta.appendChild(
    elemento(
      "p",
      "bienvenida__entrada",
      "Entra para comprar: la boleta va a nombre de tu cuenta y no tendrás que escribir tus datos otra vez."
    )
  );

  // ---------- Panel: entrar ----------
  const panelEntrar = elemento("div", "panel");
  const formEntrar = elemento("form", "formulario");
  formEntrar.noValidate = true;
  formEntrar.appendChild(
    campo("entrar", "email", "Correo electrónico", "email", null, {
      autocomplete: "email",
      inputmode: "email"
    })
  );
  formEntrar.appendChild(
    campo("entrar", "password", "Contraseña", "password", null, {
      autocomplete: "current-password"
    })
  );
  const botonEntrar = elemento("button", "boton", "Entrar");
  botonEntrar.type = "submit";
  botonEntrar.appendChild(icono("flecha"));
  formEntrar.appendChild(botonEntrar);
  panelEntrar.appendChild(formEntrar);

  conEnvio(formEntrar, botonEntrar, async (datos) => {
    await api.entrar(datos.email, datos.password);
    location.hash = (contexto && contexto.volverA) || "#/";
  });

  // ---------- Panel: crear cuenta ----------
  const panelCrear = elemento("div", "panel");
  panelCrear.appendChild(
    elemento(
      "p",
      "pliego__nota",
      "El teatro asigna el rol: toda cuenta nueva entra como asistente."
    )
  );

  const formCrear = elemento("form", "formulario");
  formCrear.noValidate = true;
  formCrear.appendChild(
    campo("crear", "nombre", "Nombre completo", "text", "Entre 3 y 100 caracteres.", {
      autocomplete: "name"
    })
  );
  formCrear.appendChild(
    campo("crear", "email", "Correo electrónico", "email", null, {
      autocomplete: "email",
      inputmode: "email"
    })
  );
  formCrear.appendChild(
    campo("crear", "password", "Contraseña", "password", "Entre 10 y 72 caracteres.", {
      autocomplete: "new-password"
    })
  );
  const botonCrear = elemento("button", "boton", "Crear cuenta");
  botonCrear.type = "submit";
  botonCrear.appendChild(icono("flecha"));
  formCrear.appendChild(botonCrear);
  panelCrear.appendChild(formCrear);

  conEnvio(formCrear, botonCrear, async (datos) => {
    await api.registrar({
      nombre: datos.nombre,
      email: datos.email,
      password: datos.password
    });
    // Registrarse no es entrar: la API no devuelve token en el registro.
    await api.entrar(datos.email, datos.password);
    location.hash = (contexto && contexto.volverA) || "#/";
  });

  tarjeta.appendChild(
    pestanas([
      { id: "entrar", titulo: "Entrar", panel: panelEntrar },
      { id: "crear", titulo: "Crear cuenta", panel: panelCrear }
    ])
  );
  tarjeta.appendChild(panelEntrar);
  tarjeta.appendChild(panelCrear);

  escena.appendChild(tarjeta);
  vista.appendChild(escena);
};
