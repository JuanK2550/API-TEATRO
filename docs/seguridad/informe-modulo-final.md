# Módulo final · Panel de gestión en React

**Proyecto:** API_TEATRO — Teatro Maldonado de Tunja
**Fecha:** 13 de noviembre de 2026
**Alcance:** frontend SPA en React + Vite + Bootstrap, el backend que necesita,
y la estrategia de pruebas SCA, SAST, DAST y pruebas de API.

---

## 1. Qué pedía el módulo

La guía de cierre pide una aplicación cliente-servidor desacoplada: una SPA en
**React 19 + Vite 8 + React Router 7 + Bootstrap 5.3** que consuma la API REST
en Express, con autenticación JWT, autorización por roles, control de propiedad
(BOLA/IDOR), recuperación de acceso, un panel de indicadores y una vista de
agenda. El navegador no debe contener ninguna API Key privada, y las variables
`VITE_` no pueden llevar secretos porque terminan en el JavaScript público.

La estrategia de pruebas de la guía son cuatro técnicas:

| Técnica | Herramienta | Propósito |
| ------- | ----------- | --------- |
| SCA | `npm audit` | Identificar dependencias vulnerables |
| SAST | Semgrep | Analizar vulnerabilidades potenciales en el código |
| DAST | OWASP ZAP | Evaluar la aplicación mediante solicitudes HTTP |
| Pruebas de API | Swagger UI | Verificar autenticación, autorización y validaciones |

## 2. Adaptación al teatro

La guía describe un dominio con tres roles: quien administra, un profesional
que atiende una agenda, y un usuario final que reserva para sí. El teatro tiene
exactamente esa forma, así que cada pieza tiene su equivalente.

| Elemento de la guía | En el teatro |
| ------------------- | ------------ |
| Rol administrador | **Administrador** |
| Rol profesional, con agenda propia | **Taquilla**: la agenda de funciones y el control en la puerta |
| Rol de usuario final | **Asistente**: sus boletas y sus datos |
| Gestión de usuarios y roles | Usuarios y roles |
| Catálogo y profesionales, en dos pestañas | Eventos y funciones, en dos pestañas |
| Fichas de usuarios finales | Asistentes |
| Espacios de atención | Localidades de la sala |
| Reservas, con su máquina de estados | Boletas: `reservada → pagada → usada`, o `cancelada` |
| Agenda interactiva por mes, semana y día | Agenda de funciones por mes, semana y día |
| Panel de indicadores | Resumen del teatro, según el rol |
| Recuperación administrativa y códigos de respaldo | Los mismos, sobre las tablas del bloque 11 |

Dos diferencias de fondo, y las dos por el dominio:

- **La agenda no es de una persona, es de la sala.** En el teatro hay una sola
  sala y la taquilla no «atiende» funciones propias: todas son de la casa. Por
  eso su agenda muestra la programación completa y su trabajo está en el
  control de boletas de cada función.
- **El usuario final compra, no solicita.** El asistente reserva una butaca y
  la paga; no hay un profesional que la confirme. La confirmación del teatro es
  el pago, y la del día de la función es la entrada en la puerta.

## 3. Arquitectura

```text
Navegador → React/Vite (localhost:5173)
          → fetch · HTTP JSON + JWT
          → Express (localhost:3000)
          → rutas → middlewares → controladores → servicios
          → pg.Pool + TLS → PostgreSQL (Supabase)
```

El panel vive en `teatro-frontend/`, con su propio `package.json`. El backend no
ganó ninguna dependencia y la Sala, la interfaz pública, sigue sin framework.

## 4. Lo que se añadió al backend

| Endpoint | Rol | Para qué |
| -------- | --- | -------- |
| `GET /api/estadisticas/resumen` | administrador | Cifras del inicio: cuentas, eventos, funciones, localidades, asistentes, boletas e ingresos cobrados; boletas por estado y por mes |
| `GET /api/usuarios` | administrador | Listado con búsqueda, filtro por rol y estado, y páginas de veinte |
| `GET /api/usuarios/busqueda-recuperacion` | administrador | Hasta veinte cuentas activas, con id, nombre, correo y rol, para emitir un token |
| `PUT /api/usuarios/:id` | administrador | Editar nombre y correo |
| `PATCH /api/usuarios/:id/estado` | administrador | Activar o desactivar una cuenta |

Cada uno respeta las capas del proyecto: ruta, validador con
`express-validator`, controlador que lee con `matchedData` y servicio con SQL
parametrizado. La guía de referencia resolvía parte de esto con consultas SQL
escritas dentro del archivo de rutas; aquí no, porque la regla del proyecto es
que solo el servicio toca la base.

Las decisiones que importan:

- **El resumen no lleva un solo dato personal**: solo conteos y una suma.
- **La búsqueda usa `POSITION` y no `LIKE`.** Un `%` o un `_` escritos por el
  administrador son caracteres, no comodines.
- **La edición descarta rol, contraseña y estado.** Solo están declarados
  `nombre` y `email`; lo demás no llega al servicio.
- **Desactivar sube `version_sesion`.** Los tokens de esa cuenta dejan de
  servir en la siguiente petición, y el login responde 403.
- **Dos guardas en el cambio de estado.** Nadie puede desactivarse a sí mismo,
  y el último administrador activo no se puede desactivar. La segunda solo se
  alcanza si dos administradores se desactivan a la vez, así que la operación
  corre en una transacción con `pg_advisory_xact_lock` y `FOR UPDATE`.

Y una decisión sobre rutas que ya existían:

- **`POST /api/auth/restablecer-password` y `/restablecer-con-codigo` dejaron de
  pedir API Key.** El bloque 11 las dejó con clave y escribió que se decidiría
  cuando existiera una interfaz de página única. El panel es esa interfaz, y el
  navegador no tiene ni debe tener clave. Abrirlas no las desprotege: nunca
  dependieron de la clave, sino del secreto de un solo uso —256 bits el token,
  que caduca a los quince minutos; 128 bits cada código, ligado además al
  correo—, más el límite de diez intentos por ventana.

## 5. La interfaz

### Una sola interfaz

El proyecto llegó a este módulo con dos interfaces: **la Sala**, una página sin
framework que servía el propio Express en `/sala` —cartelera, plano de butacas
y compra—, y el panel en React. Dos interfaces son dos sitios donde mantener la
sesión, los estilos y las reglas de la compra, y dos superficies que revisar en
cada auditoría. Se dejó una: la de React, que es la que pide el módulo.

La Sala no se borró sin más. Antes se trasladó a React lo que el panel no tenía:

| Lo que aportaba la Sala | Dónde está ahora |
| ----------------------- | ---------------- |
| La cartelera pública con un afiche por evento | `/`, sin cuenta, con filtro por tipo |
| La ficha de un evento con sus funciones y tarifas | `/evento/:id`, con el botón de compra |
| El registro de asistentes | `/registro`, que entra y abre «Mi perfil» |
| El plano de butacas | En la compra y en la venta de taquilla |

Después se retiraron `frontend/`, su montaje y su CSP en `app.js`, y la ruta
`/sala/config.js`. La cartelera se pide **sin token** aunque haya sesión, para
mostrar siempre la vista del público, y el plano usa
`GET /api/funciones/:id/ocupacion`, que solo dice qué butacas están tomadas.

La prueba 34 de `pruebas-bloque11.js` comprobaba que `/sala/config.js` ya no
entregaba la clave. La ruta ya no existe, así que ahora comprueba eso: 404, y
sin la clave en la respuesta.

Dentro del panel se buscó además código muerto con un script que cruza cada
exportación con sus usos: solo había dos exportaciones innecesarias, que se
quitaron, y dos paquetes de tipos de TypeScript en un proyecto JavaScript, que
se desinstalaron.

### Un panel por rol

| Rol | Módulos |
| --- | ------- |
| Administrador | Inicio, usuarios y roles, eventos y funciones, asistentes, localidades, boletas, recuperación administrativa, códigos y contraseña |
| Taquilla | Inicio, agenda de funciones, control de boletas, mi perfil, códigos y contraseña |
| Asistente | Inicio, mis boletas, mi perfil, seguridad de la cuenta y contraseña |

Cada módulo es una ruta propia protegida por rol con `RutaProtegida`. No es la
seguridad, solo la navegación: el backend vuelve a decidir en cada petición. La
interfaz solo ofrece lo que la API va a aceptar —un botón de transición aparece
si esa transición existe, y «Registrar entrada» está deshabilitado mientras la
función no esté en curso—, pero si alguien forzara la petición, la respuesta
sería la de la API.

### La sesión

El JWT se guarda en `sessionStorage`, como pide la guía, y no en
`localStorage`: muere al cerrar la pestaña y no lo comparten otras. Al recargar
se confirma con `GET /api/auth/perfil`, y el rol que se usa es el que devuelve
el servidor. Cualquier 401 —token caducado, revocado o cuenta desactivada—
cierra la sesión y la pantalla de acceso explica el motivo. El cierre por
caducidad se programa para el instante del `exp`.

La Sala guarda el token solo en memoria, y la diferencia es deliberada: la Sala
se usa para una compra y perder la sesión al recargar no cuesta nada; el panel
es una herramienta de trabajo, y forzar el acceso en cada recarga empuja a
guardar la contraseña en cualquier sitio. Frente a un XSS, `sessionStorage` y
la memoria son igual de alcanzables; lo que protege el token es que no haya
XSS.

### Seguridad del cliente

- **Ninguna API Key.** Comprobado en el build: `X-API-Key`, `API_KEY`,
  `DATABASE_URL`, `JWT_SECRET`, `supabase.co` y `postgres` no aparecen ni una vez.
- **Nada se escribe como HTML.** Cero `dangerouslySetInnerHTML` e `innerHTML`.
- **Cero estilos en línea.** Los gráficos son SVG con atributos, y así la CSP
  puede ser `style-src 'self'` a secas.
- **CSP en el build**, y en `vite preview` también como cabecera con
  `frame-ancestors 'none'` —que en un `<meta>` no tiene efecto—, junto a
  `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: no-referrer`, `Permissions-Policy` y
  `Cross-Origin-Opener-Policy`.
- **El precio nunca sale del navegador.** Comprar o vender envía función,
  localidad, butaca y descuento; el precio que se ve antes es una previsión.

## 6. Estrategia de pruebas

### 6.1 Pruebas de API

La guía propone Swagger UI, y se hicieron en Swagger UI: con el diálogo
**Authorize** y `BearerAuth`, se ejecutó una operación sin token (401), otra con
el token de un asistente donde hace falta un administrador (403), una con el
cuerpo inválido (400, con el error de cada campo), la misma lectura como
administrador (200) y un restablecimiento sin API Key, que llega al validador
(400). En las capturas el token aparece como `eyJhbGci…` también en el bloque
Curl.

Además, las pruebas de este proyecto van un paso más allá:
son scripts que lanzan peticiones reales y comprueban el código, el cuerpo y,
donde hace falta, el efecto en PostgreSQL. Swagger sigue documentando cada
endpoint en `/api-docs`, y la propia batería comprueba que el contrato
declarado coincide con el que la API exige.

| Batería | Pruebas | Resultado |
| ------- | ------- | --------- |
| `pruebas-panel.js`, nueva | 43 | 43 correctas |
| La tanda completa, trece baterías | 483 | 483 correctas |

Las 43 del panel cubren el login fallido sin enumerar cuentas, el resumen y sus
permisos, el listado y sus filtros, la búsqueda para la recuperación, la
edición con campos colados, el cambio de estado con sus dos guardas y su efecto
en `version_sesion`, la recuperación completa desde el navegador sin API Key, el
carácter nulo que encontró el DAST, CORS con un origen propio y uno ajeno, y el
contrato en Swagger.

Las pruebas finales que sugiere la guía, una por una:

| Prueba de la guía | Resultado esperado | Dónde se comprueba | Resultado |
| ----------------- | ------------------ | ------------------ | --------- |
| Login correcto | JWT y usuario autenticado | `pruebas-bloque11.js` · 1 | 200 |
| Login con contraseña incorrecta | Acceso rechazado | `pruebas-panel.js` · 1 y 2 | 401, sin token y sin revelar si el correo existe |
| El usuario final consulta lo propio | 200, solo lo autorizado | `pruebas-bloque11.js` · 17 | 200 |
| El usuario final consulta lo ajeno | 403 o 404, nunca datos ajenos | `pruebas-bloque11.js` · 18 | 403 |
| El rol operativo consulta lo que le corresponde | 200, solo lo autorizado | `pruebas-autorizacion.js`, taquilla | 200 |
| Una operación que no corresponde al rol | Rechazada | `pruebas-autorizacion.js`: el asistente no marca su boleta como usada | 403 |
| El administrador consulta el panel | Indicadores | `pruebas-panel.js` · 3 a 8 | 200, sin datos personales |
| Reservar algo ya ocupado | Conflicto, por lógica e índice único | `pruebas-funciones.js` (sala única) y `pruebas-boletas.js` (butaca) | 409 |
| JWT expirado o revocado | 401 y cierre de sesión | `pruebas-panel.js` · 27 y 35; `AuthContext` | 401; el panel cierra la sesión |
| Cambiar la contraseña | Revoca los tokens anteriores | `pruebas-bloque11.js` · 5 | 401 con el token viejo |
| Un código de recuperación usado | No se reutiliza | `pruebas-bloque11.js` · 16 | 400 |
| `npm run lint` y `npm run build` | Sin errores | El panel | 0 errores, 0 avisos; build correcto |

### 6.2 SCA · `npm audit`

| Proyecto | Todo | Lo que se despliega |
| -------- | ---- | ------------------- |
| Backend | 4 moderadas, en `glob` y `minimatch` | 3 moderadas, por `swagger-jsdoc` |
| Panel | **0** | **0** |

**El panel empezó con cuatro moderadas** en `minimatch`, dentro de ESLint 10.14.0
y solo en desarrollo. En ese momento el único arreglo de npm era `--force`, que
bajaba ESLint a la 9, y no se aplicó. Al repetir el análisis antes de cerrar,
npm ofrecía ya una corrección sin `--force`: ESLint 10.15.0 trae el `minimatch`
corregido. Se aplicó, y `lint` y `build` siguen limpios. Es la diferencia entre
degradar una herramienta y actualizarla.

El backend no ganó ninguna dependencia: sus cuatro moderadas son las del bloque
11. La única corrección sigue siendo bajar `swagger-jsdoc` de 6.3.0 a 6.2.8, y el
único patrón que resuelven esos paquetes es la constante
`apis: ["./src/routes/*.js"]`, evaluada al arrancar. Se deja constancia en lugar
de degradarla.
Salida completa en [`sca-npm-audit-modulo-final.txt`](sca-npm-audit-modulo-final.txt).

### 6.3 SAST · Semgrep

Con la imagen oficial en Docker, porque Smart App Control de Windows bloquea el
binario nativo. Conjuntos `p/javascript`, `p/nodejs`, `p/owasp-top-ten` y,
nuevo en este módulo, `p/react`, sobre `src/`, `scripts/`, `pruebas/` y la
interfaz en React.

**0 hallazgos en 133 archivos.** El conjunto de React se lanzó también por
separado para confirmar que de verdad analizó la interfaz: 4 reglas sobre sus
55 archivos, 0 hallazgos. Salida en
[`sast-semgrep-modulo-final.txt`](sast-semgrep-modulo-final.txt).

### 6.4 DAST · OWASP ZAP

OWASP ZAP 2.17.0 sin interfaz, con su marco de automatización: importa el
OpenAPI (61 URLs), recorre el panel compilado servido con `vite preview` (27
URLs) y lanza el escaneo activo sobre la API **autenticado como
administrador**. El JWT entra por las variables `ZAP_AUTH_HEADER*` y no se
escribe en ningún archivo.

| Riesgo | Alertas |
| ------ | ------- |
| Alto | 0 |
| Medio | 0 |
| Bajo | 0 |
| Informativo | 4 |

Las cuatro informativas, con su explicación completa en
[`dast-zap-modulo-final.txt`](dast-zap-modulo-final.txt): ZAP reconoce que es una
SPA; la CSP está en cabecera y en `<meta>` a la vez, y coinciden; un
«comentario sospechoso» que es el texto «todo público» de la clasificación G
(ZAP buscaba la palabra inglesa *TODO*); y las peticiones que llevan correo y
contraseña.

El escaneo dejó dos lecciones, las dos en el apartado 7:

- **El primero no iba autenticado.** Una petición de control que exige 200 en
  `/api/estadisticas/resumen` lo destapó (devolvió 401), y un servidor de eco
  mostró que la cabecera no llegaba. Sin esa comprobación, el informe habría
  dicho «0 alertas» sobre una API que ZAP solo había visto desde la puerta.
- **El autenticado encontró un 500 que ZAP no listó como alerta**: lo mostró el
  registro del servidor. Corregido, el segundo escaneo autenticado, de 9 min
  24 s, terminó **sin un solo 5xx**; el filtro nuevo rechazó con 400 los 21
  intentos de colar un carácter nulo.

El escaneo se hizo antes de unificar la interfaz (apartado 5). La unificación
no añadió nada al backend: le quitó la ruta `/sala/config.js` y los archivos
estáticos de la Sala. Las páginas nuevas de la interfaz —cartelera, ficha,
registro y plano— consumen las mismas rutas públicas que ya se escanearon y se
sirven con las mismas cabeceras.

### 6.5 Revisión en el navegador

Un recorrido automático en Edge sin ventana entra con cada rol, abre todos sus
módulos y registra cualquier error de consola, respuesta HTTP fallida o
desborde horizontal. **26 pantallas —la cartelera, la ficha, el registro y la
compra con el plano incluidos—, a 1440 y a 390 píxeles de ancho, sin un solo
problema**, y lo mismo sobre el build con su CSP estricta en cabecera,
donde una violación de la política habría aparecido como error. También
comprueba que una cuenta de taquilla o de asistente que abre `/panel/usuarios`
vuelve al inicio.

## 7. Hallazgos y correcciones

| ID | Hallazgo | Corrección | Verificación |
| -- | -------- | ---------- | ------------ |
| SEC-02 | Una petición desde un origen no permitido por CORS respondía **500** y se registraba como error del servidor | El `origin` de CORS responde `false` en lugar de lanzar un `Error`: la respuesta sale sin `Access-Control-Allow-Origin` y el navegador bloquea la lectura | `pruebas-panel.js`: origen ajeno → 200 sin la cabecera; origen del panel → la recibe |
| DAST-03 | El primer escaneo activo **no iba autenticado**: la regla de sustitución de ZAP no inyectó el token, y solo probó la API desde fuera | Se pasó a las variables `ZAP_AUTH_HEADER*`, con el sitio como nombre de host sin puerto | Una petición de control a `/api/estadisticas/resumen` exige 200 antes de escanear |
| DAST-04 | Un carácter nulo (`\u0000`) llegaba hasta PostgreSQL, que lo rechaza en un texto (código `22021`), y la API respondía **500**. Lo encontró el escaneo autenticado en `GET /api/usuarios?q=`; con un nulo en el nombre, `POST /api/auth/registro` también daba 500, y ese fallo era **anterior** a este módulo | `rechazarCaracterNulo`, montado tras `express.json`, responde 400 ante un nulo en el cuerpo, la consulta o la ruta; `manejarError` traduce además el `22021` a 400 como red de seguridad | `pruebas-panel.js` 37 a 39; segundo escaneo autenticado sin ningún 5xx |
| DOC-01 | El README decía que un código de respaldo de «ocho caracteres» se podía adivinar | Son 128 bits —ocho grupos de cuatro hexadecimales— y el token 256 | Corregido en el README |
| UI-01 | En las tablas, los códigos de boleta se partían en tres líneas y las acciones se apilaban; la cifra de ingresos desbordaba su tarjeta; la agenda decía «Febrero **De** 2027» | Códigos y acciones sin cortes, descuento bajo el precio, la tarjeta destacada ocupa dos columnas, mayúscula solo en la primera letra | Segunda pasada de capturas |
| UI-02 | El administrador veía «Registrar entrada» activo con la función sin abrir; la API habría respondido 409 | Deshabilitado con su explicación, igual que en la taquilla | Captura del módulo de boletas |
| UI-04 | **Comprar desde el panel no funcionaba.** La función que arma el pedido dejaba fuera el `asistenteId`, que el validador exige, así que toda compra del asistente y toda venta de la taquilla respondía 400. Ninguna revisión anterior lo vio porque ninguna llegaba a pulsar «Reservar» | El pedido incluye el `asistenteId`; cuando compra un asistente, el servidor lo ignora y usa el de su token | Compra del asistente → 201 con precio y código del servidor; venta de taquilla → «Boleta BOL-2026-0012 reservada» |
| UI-05 | Ante un error de validación el panel solo decía «Datos de entrada inválidos», sin el campo: leía `item.msg`, el formato de la guía de referencia, y el validador del proyecto devuelve `{ campo, mensaje }` | Lee `item.mensaje` | Lo destapó la prueba del 409, que mostraba un 400 sin explicación |
| UI-06 | Tras un 409 por butaca ocupada, la elección seguía marcada sobre una butaca que ya no estaba libre | Ante un 409 la elección se suelta y el plano se vuelve a pedir | Captura 47 |
| DOC-02 | En Swagger, 35 respuestas 401 decían «o la API Key es incorrecta» en rutas que solo usan JWT desde el bloque 11, y el ejemplo del esquema `Error`, compartido por todas, era «Boleta no encontrada» | Descripciones al día y un ejemplo neutro | El spec ya no contiene la frase; capturas 35 a 40 |
| UI-03 | Al cerrar sesión, **la siguiente persona que entraba aparecía en la última página de la anterior**: la ruta protegida guardaba esa página como destino de vuelta, pensado para retomar una compra tras iniciar sesión | La sesión distingue el cierre voluntario de la caducidad: si fue voluntario no se guarda destino; si caducó, la misma persona sí vuelve donde estaba | El recorrido comprueba que cada rol entra en `/panel` tras el cierre del anterior |

**Un cambio de contrato que hay que declarar.** La prueba 35 de
`pruebas-bloque11.js` comprobaba que las dos rutas de restablecimiento
respondían 401 sin API Key. Con el módulo final dejaron de pedirla, y la prueba
falló, como debía. No se aprobó cambiando el número esperado: se reescribió
para comprobar el contrato nuevo, que sin clave un token y un código falsos los
rechaza **la lógica** con su mensaje —«Token inválido, ya utilizado o expirado»
y «Código o cuenta inválidos»—, y no la puerta.

## 8. Limitaciones

- El JWT del panel está en `sessionStorage`. La alternativa completa es una
  cookie `httpOnly`, que exige HTTPS y protección anti-CSRF.
- Las confirmaciones usan el `confirm()` del navegador: accesible y sin
  dependencias, con el aspecto del sistema.
- En pantallas estrechas las tablas largas se desplazan dentro de su tarjeta.
- El origen donde se publique el panel tiene que añadirse a `ALLOWED_ORIGIN`;
  sin él, CORS bloquea las respuestas, que es lo correcto.
- Las cuatro moderadas de `npm audit` del backend, descritas en el apartado 6.2.
