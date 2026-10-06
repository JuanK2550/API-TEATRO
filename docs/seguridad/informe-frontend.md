# La Sala — cierre del frontend

## De dónde venimos

Hasta aquí el proyecto era una API que se probaba con Postman y con Swagger. La
seguridad se había trabajado en el servidor: validación de entrada, protección
contra Mass Assignment, API Keys guardadas como hash, contraseñas con bcrypt,
rol asignado por el servidor y sesión con JWT.

La Sala añade algo que antes no existía: **código propio corriendo en el
navegador de otra persona**. Eso cambia el mapa de riesgos. En el servidor el
enemigo es una petición mal intencionada; en el navegador el enemigo es que un
dato ajeno termine ejecutándose como si fuera código nuestro, y que lo que
guardemos ahí quede al alcance de cualquiera.

Este informe recoge lo que hicimos, lo que probamos y lo que decidimos.

## Lo que se construyó

La Sala es la taquilla que ve el espectador: cartelera, ficha del evento, cuadro
de tarifas, plano de butacas con las 450 asientos a escala, compra, talón
emitido y "Mis boletas".

La sirve el mismo Express en `/sala`. No hay framework ni paso de compilación:
HTML, CSS y JavaScript con módulos ES. Es una decisión de seguridad además de
una de simplicidad, porque **lo que está en `frontend/` es exactamente lo que
llega al navegador**: no hay un empaquetador que meta código que nadie revisó.

Las tipografías y las fotografías están descargadas en el repositorio. No se
pide nada a ningún CDN, y por eso la política de seguridad de contenido de
helmet se pudo dejar intacta.

## XSS: la amenaza principal

### El razonamiento

Un ataque de **Cross-Site Scripting** consiste en que un dato se cuele en la
página y el navegador lo trate como instrucciones en vez de como contenido. Si
lo consigue, ese código corre con los permisos de la página: puede leer lo que
haya en el almacenamiento, hacer peticiones con la sesión de la víctima o
cambiar lo que se ve en pantalla.

En nuestro caso los datos que vienen de fuera son los títulos, las
descripciones, los nombres de las personas y los mensajes que devuelve la API.
Todos pasan por la pantalla.

Hay dos sitios donde se puede defender: a la **entrada**, filtrando lo que se
guarda, y a la **salida**, decidiendo cómo se pinta. El proyecto ya filtraba a
la entrada: los validadores rechazan `<` y `>` en los campos de texto libre.
Pero un filtro de entrada es una defensa frágil. Depende de acertar con la lista
de lo prohibido, se queda corto en cuanto aparece una vía nueva —un dato que
entre por otro endpoint, una base de datos migrada, un campo que alguien añada
sin acordarse de la regla— y no protege al navegador, solo le quita una parte
del problema.

La defensa que de verdad cierra el agujero está en la salida: **que el texto
nunca se trate como marcado**.

### Qué se hizo

La Sala no escribe HTML en ningún momento. Se revisó `frontend/` entero buscando
las vías por las que un texto puede convertirse en marcado:

| Vía | Coincidencias |
| --- | ------------- |
| `innerHTML` | 0 |
| `outerHTML` | 0 |
| `insertAdjacentHTML` | 0 |
| `document.write` | 0 |
| `srcdoc` | 0 |
| `eval`, `new Function` | 0 |
| `setTimeout`/`setInterval` con texto | 0 |

Todo el contenido entra con `textContent` o `createTextNode`, que guardan el
texto como texto: si el dato dice `<img onerror=...>`, en pantalla se lee
`<img onerror=...>`.

También se revisaron los atributos, porque un `href` o un `src` son otra vía:

- Los `href` son siempre rutas internas de la propia Sala (`#/evento/3`), con un
  id numérico que viene de la API. Nunca se construye una dirección con texto de
  nadie, así que no hay forma de colar un `javascript:`.
- Los `src` de las fotografías salen de una **lista fija** por tipo de evento,
  con un valor por defecto si el tipo no está en la lista.
- Los demás atributos que se fijan son de accesibilidad (`role`, `aria-*`),
  `class` y el trazo de los iconos.

En esta revisión se encontró y se eliminó la única propiedad CSS que recibía un
dato de la API, `--butacas-por-fila`. Había quedado sin usar al cambiar las
filas de butacas a `flex`, así que era código muerto, pero mientras estuviera
ahí era el único punto donde un valor ajeno entraba en un estilo.

### Cómo se probó

Buscar patrones no basta: hay que meter una carga y mirar la pantalla. Se guardó
en el evento 1, con `PUT /api/eventos/1`, lo siguiente:

```
titulo:      Bernarda " onmouseover="alert(1)
descripcion: &lt;img src=x onerror=alert(1)&gt; javascript:alert(2)
             ${alert(3)} `alert(4)` &#60;script&#62;alert(5)&#60;/script&#62;
             data:text/html;base64,PHNjcmlwdD5hbGVydCg2KTwvc2NyaXB0Pg==
```

La elección no es casual: **ninguna lleva `<` ni `>`**, porque el validador los
rechaza. Son exactamente las cargas que sí superan el filtro de entrada, que es
lo que había que poner a prueba. La API las aceptó con 200 y las guardó tal cual.

Después se abrió la Sala en la cartelera y en la ficha del evento:

| Qué se midió | Resultado |
| ------------ | --------- |
| Nodos inyectados (`img[onerror]`, `[onmouseover]`, `iframe`, `object`...) | 0 |
| Enlaces con `href` que empiece por `javascript:` | 0 |
| Scripts cargados | `config.js` y `sala.js`, los de siempre |
| Diálogos abiertos | 0 |
| Errores de consola | 0 |

En pantalla el título se lee literalmente `Bernarda " onmouseover="alert(1)` y la
descripción `&lt;img src=x onerror=alert(1)&gt;`. Texto, no marcado. La captura
está en `.impeccable/review/xss-como-texto-escritorio.png`. El evento se devolvió
a su contenido original al terminar la prueba.

### La segunda barrera: la CSP

Aunque fallara todo lo anterior, queda la política de seguridad de contenido que
sirve `/sala/`:

```
default-src 'self'
base-uri 'self'
font-src 'self' https: data:
form-action 'self'
frame-ancestors 'self'
img-src 'self' data:
object-src 'none'
script-src 'self'
script-src-attr 'none'
style-src 'self' https: 'unsafe-inline'
upgrade-insecure-requests
```

`script-src 'self'` sin `'unsafe-inline'` ni `'unsafe-eval'`: el navegador solo
ejecuta guiones servidos desde este mismo origen. Y `script-src-attr 'none'`
bloquea los manejadores escritos en un atributo, que es justo lo que intentaba
la carga del título. El HTML que se sirve no tiene ni un script ni un estilo en
línea: solo dos etiquetas `script` con `src`.

#### La cabecera de arriba ya no es la que sirve /sala

Esa política lleva `style-src ... 'unsafe-inline'`, que es el valor por defecto
de helmet. Al revisarla apareció la pregunta obvia: si la Sala no usa ni un
estilo en línea, ¿por qué lo permite?

La respuesta es que **no se puede quitar para todo el servidor**: se comprobó
que `/api-docs` escribe 3 bloques `<style>` y 4 atributos `style`, así que
Swagger UI dejaría de verse. Quitarlo globalmente habría cambiado una cosa que
funciona por otra que no, en nombre de una directiva más bonita.

La solución fue aplicar una política propia **solo a `/sala`**, con
`helmet.contentSecurityPolicy` montado antes de servir el frontend. Esa cabecera
reemplaza a la global en esas peticiones y deja el resto del servidor como
estaba:

| Directiva | Resto del servidor | `/sala` |
| --------- | ------------------ | ------- |
| `style-src` | `'self' https: 'unsafe-inline'` | `'self'` |
| `font-src` | `'self' https: data:` | `'self'` |
| `img-src` | `'self' data:` | `'self'` |
| `script-src` | `'self'` | `'self'` |
| `script-src-attr` | `'none'` | `'none'` |

También se quitaron `https:` y `data:` de las fuentes y las imágenes: todo está
dentro del proyecto, así que permitir orígenes externos no servía para nada.

Se comprobó en el navegador que la Sala carga sus 2 hojas de estilo con 230
reglas, sus 4 tipografías y sus fotografías **sin una sola violación de CSP**, y
que `/api-docs` sigue pintando sus 46 operaciones en sus 7 etiquetas. Las 248
pruebas siguen pasando.

La lección aquí es que una cabecera de seguridad no se endurece a ciegas: se
mira qué depende de ella y, si hay algo que sí la necesita, se acota el alcance
en vez de rebajar el objetivo.

## Minimización de datos

El plano de butacas necesita saber qué asientos están tomados. La ruta que ya
existía, `GET /api/boletas/funcion/:id`, devuelve las boletas completas: el
código de cada boleta y el `asistenteId` de cada comprador. Usarla habría puesto
esos datos en el navegador de cualquiera que abriera las herramientas de
desarrollo, para una pantalla que solo necesita saber qué butacas no están
libres.

Se añadió `GET /api/funciones/:id/ocupacion`, que devuelve únicamente
`[{ localidadId, fila, numero }]` de las boletas no canceladas. Es el mismo
criterio para el asistente: la Sala **no descarga** `GET /api/asistentes`, que
expondría documentos, correos y teléfonos de todas las personas registradas.

## Identidad: quién es quién

El problema que apareció al probar la compra con calma: alguien que ya había
comprado volvía en otra sesión, escribía su documento, la API respondía 409
"ya existe" y se quedaba **sin poder comprar**. Las salidas fáciles eran malas:
descargar la lista de asistentes expone los datos de todo el mundo, y añadir un
endpoint que responda "¿existe el documento X?" crea un oráculo para enumerar
documentos ajenos.

La solución fue atar el asistente a la cuenta. Se añadió `usuarioId` a los
asistentes y tres rutas que resuelven la identidad **desde el token**, no desde
un id escrito en la dirección:

| Ruta | Qué hace |
| ---- | -------- |
| `GET /api/asistentes/mio` | Los datos de asistente de la cuenta del token, o 404 si aún no tiene |
| `POST /api/asistentes/mio` | Los crea y los liga a esa cuenta. Solo hace falta la primera vez |
| `GET /api/boletas/mias` | Las boletas de esa cuenta, sin ningún id en la dirección |

Comprar exige haber entrado. La segunda compra no pide ni el documento, y en
ningún momento se pregunta si un documento existe.

El campo `usuarioId` **lo pone el servidor desde el token**: no está declarado en
ningún validador, así que `matchedData` lo descarta aunque el cliente lo mande.
Hay una prueba que lo comprueba enviando `usuarioId: 9999` y verificando que se
guarda el id real del token.

## La sesión en el navegador

El JWT vive **solo en una variable de JavaScript**. No se guarda en
`localStorage` ni en `sessionStorage`. La consecuencia visible es que recargar
la página cierra la sesión, y la Sala lo explica con un aviso en vez de dejar al
usuario a oscuras.

Es deliberado. Lo que se guarda en el almacenamiento del navegador sobrevive a
la pestaña y puede leerlo cualquier script de la página: si algún día hubiera un
XSS, el token guardado sería lo primero que se llevaría.

Lo único que la Sala guarda son dos marcas, las dos en `sessionStorage`:

| Clave | Valor | Para qué |
| ----- | ----- | -------- |
| `telon-abierto` | `"si"` | Que el telón se abra una vez por sesión |
| `hubo-sesion` | `"si"` | Saber, tras recargar, que hay que explicar por qué se cerró la sesión |

Un sí y nada más: ni token, ni correo, ni documento, ni id. Se comprobó en el
navegador que, con sesión abierta y una compra hecha, `localStorage` está vacío,
no hay cookies y no hay bases de IndexedDB.

## La API Key del navegador

`GET /sala/config.js` la genera el servidor en cada petición leyendo
`API_KEY_WEB` del `.env`, con `Cache-Control: no-store`. Así la clave **no está
escrita en ningún archivo del repositorio**.

Eso no la vuelve secreta, y es importante no fingir que sí: cualquiera que abra
las herramientas del navegador la ve, porque el navegador tiene que mandarla en
cada petición. En una aplicación web la API Key **identifica a la aplicación, no
la protege**. Lo que protege es el JWT, que identifica a la persona; el límite de
peticiones; y poder revocar ese cliente poniendo `activa: false` sin tocar a los
demás.

## Herramientas

**SAST.** Semgrep sobre `src/` y `frontend/` con `p/javascript`, `p/nodejs`,
`p/owasp-top-ten` y `p/xss`: **74 reglas, 61 archivos, 0 hallazgos**. La salida
completa y la forma exacta de ejecutarlo están en `sast-semgrep-frontend.txt`.
Se usó `--no-git-ignore` para que también se revisaran los archivos que
`.gitignore` excluye: saltárselos sería lo contrario de lo que interesa en una
revisión de seguridad.

**SCA.** `npm audit --omit=dev` da **0 vulnerabilidades**. Con las dependencias
de desarrollo aparecen 3 de severidad alta, todas la misma cadena
`nodemon → chokidar → braces`, que ya estaba documentada: no existe una versión
corregida de `braces` y `npm audit fix --force` bajaría `nodemon` nueve versiones
mayores. El detalle está en `sca-npm-audit-frontend.txt`.

**Revisión manual de la interfaz.** Las 33 combinaciones de vista y ancho (390,
820 y 1440) se comprobaron sin desbordes horizontales, sin contraste por debajo
del mínimo de la WCAG y sin controles menores de 24 px, con foco visible en todo
lo que se recorre con el teclado.

## Qué queda pendiente

**El IDOR de las rutas antiguas.** `GET /api/boletas/asistente/:id` y
`PATCH /api/boletas/:id/estado` no comprueban de quién es la boleta: quien
cambie el id ve o modifica la de otra persona. La Sala ya no las usa, pero
siguen publicadas. El campo `usuarioId` que se añadió es justamente lo que hace
falta para comprobar el dueño; falta decidir qué roles pueden consultar boletas
ajenas, y eso corresponde al laboratorio de autorización.

**La cookie `httpOnly`.** Hoy el token vive en una variable de JavaScript. Lo
correcto en producción sería que el servidor lo entregara en una cookie
`httpOnly; Secure; SameSite=Strict`, que el navegador envía sola y que **ningún
script de la página puede leer**, ni siquiera uno inyectado. Cerraría del todo el
robo de token por XSS y además sobreviviría a la recarga, que es la molestia que
hoy tiene la Sala. Exige HTTPS y añadir protección anti-CSRF, porque una cookie
viaja también en peticiones que nacen en otros sitios.

**El pago es simulado.** No hay pasarela ni cobro: el botón solo cambia el estado
de la boleta, y lo dice en pantalla.

## Lo que nos llevamos

La lección que más se repitió en esta fase es que **filtrar la entrada no es
proteger la salida**. El validador que rechaza `<` y `>` está bien y conviene
dejarlo, pero si mañana entra un dato por otra vía, lo único que sigue
protegiendo es que la Sala nunca trate un texto como marcado.

La segunda es que conviene desconfiar de la comodidad. Guardar el token en
`localStorage` habría ahorrado el aviso de recarga y habría sido más cómodo;
descargar la lista de asistentes habría resuelto en dos líneas el problema de
reconocer a quien vuelve. Las dos salidas cómodas eran las dos inseguras, y en
los dos casos la alternativa correcta resultó ser pedirle al servidor que
responda por la identidad en vez de resolverla en el navegador.
