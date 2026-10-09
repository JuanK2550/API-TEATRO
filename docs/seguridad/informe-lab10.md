# Laboratorio 10 — Autorización, RBAC e IDOR/BOLA

## De dónde venimos

El laboratorio 9 nos dejó la API con dos credenciales que convivían. La API Key
decía **qué aplicación** pedía, y el JWT decía **quién era la persona**. El rol
del usuario viajaba dentro del token, firmado, imposible de alterar sin que la
firma dejara de cuadrar.

Pero ahí se quedaba. En el informe anterior lo escribimos con estas palabras:
*"El rol todavía no restringe nada. Viaja dentro del token, pero ningún endpoint
lo mira para decidir. Un asistente autenticado puede llamar a lo mismo que un
administrador."*

Este laboratorio es exactamente eso: hacer que el rol decida. Y después de
hacerlo, descubrir que no basta.

## Autenticación y autorización no son lo mismo

Es la distinción que organiza todo el laboratorio, y la confundimos al empezar.

- **Autenticación** responde *¿quién eres?*. La resuelve `autenticarJWT`:
  verifica la firma del token y deja `req.usuario` con el id, el correo y el
  rol. Si falla, responde **401**.
- **Autorización** responde *¿puedes hacer esto?*. La resuelven
  `autorizarRoles` y las guardas de propiedad. Si falla, responde **403**.

Los dos códigos dicen cosas distintas y hay que elegirlos bien. El 401 significa
"no sé quién eres, identifícate". El 403 significa "sé perfectamente quién eres,
y esto no te corresponde". Enviar un 403 a quien no presentó credenciales le
está diciendo que vuelva a intentarlo con las mismas, y enviar un 401 a quien sí
las presentó le está diciendo que su sesión falló cuando lo que falló fue su
permiso.

Esta distinción nos costó un error real. Al proteger las rutas propias del
asistente pusimos `autorizarRoles` **antes** de `autenticarJWT`. El resultado:
el control de rol se ejecutaba sin que nadie hubiera dejado `req.usuario`, caía
en la primera comprobación de la guarda y devolvía 401 en lugar de 403. Las
pruebas lo encontraron, pero el orden es tan fácil de invertir que ahora lo
comprobamos con un guion sobre las 36 rutas protegidas.

Y la autorización tiene **dos capas**, no una. Es la lección que nos llevamos:

1. **¿Puede tu rol hacer esta operación?** La responde el RBAC. Es una pregunta
   sobre el tipo de acción.
2. **¿Puedes hacerla sobre este registro concreto?** La responden las guardas de
   propiedad. Es una pregunta sobre el dato.

Pasar solo la primera es el agujero que la OWASP llama **BOLA**, *Broken Object
Level Authorization*. Un asistente autenticado tiene permiso para leer boletas.
Lo que no tiene es permiso para leer *las de otra persona*. Sin la segunda capa,
el rol parece protegernos y no protege nada: basta cambiar un número en la
dirección.

## Las piezas nuevas

| Archivo | Qué hace |
| ------- | -------- |
| `src/middlewares/roles.middleware.js` | `autorizarRoles(...roles)`: 401 si no hay usuario, 403 si su rol no está en la lista |
| `src/middlewares/propiedad.middleware.js` | Las tres guardas de propiedad |
| `src/middlewares/usuarios.validator.js` | Reglas de la creación administrativa, con la lista blanca del rol |
| `src/controllers/usuarios.controller.js` | `POST /api/usuarios` |
| `src/routes/usuarios.routes.js` | La ruta y su documentación |
| `crearAdministradorInicial()` | En `usuarios.service.js`: siembra el primer administrador al arrancar |
| `crearUsuarioAdministrativo()` | En `usuarios.service.js`: el único camino que otorga `taquilla` y `administrador` |
| `actualizarMiAsistente()` | En `asistentes.controller.js`: `PATCH /api/asistentes/mio` |

El orden de la cadena en cada ruta protegida es siempre el mismo:

```
autenticarJWT  ->  autorizarRoles  ->  validadores  ->  validar  ->  guarda de propiedad  ->  controller
```

La guarda de propiedad va **después** de `validar` por una razón concreta:
`autorizarCambioEstadoBoleta` necesita saber a qué estado se quiere pasar, y lo
lee con `matchedData`, que solo tiene contenido cuando la validación ya corrió.
Ponerla antes la dejaría decidiendo con un cuerpo sin validar.

## El administrador inicial

Hay un problema de arranque que no vimos venir hasta que las pruebas dejaron de
pasar. Crear administradores es una operación administrativa, y las operaciones
administrativas exigen un administrador. Con la base de datos vacía no hay
ninguno, así que no hay forma de crear el primero.

El registro público no sirve: desde el laboratorio 8 fuerza el rol `asistente`,
y ese es precisamente el control que no queremos debilitar. Abrirle una
excepción —"si no hay usuarios, el primer registro es administrador"— sería
regalar el sistema a quien llegue primero.

Lo rompimos **sembrando** el primer administrador desde el entorno:

```
ADMIN_NOMBRE=Administrador Teatro
ADMIN_EMAIL=admin@teatro.com
ADMIN_PASSWORD=REEMPLAZAR_CON_PASSWORD_SEGURO
```

`crearAdministradorInicial()` corre **antes** de `app.listen`. Si la cuenta ya
existe, la devuelve sin tocarla, así que reiniciar el servidor no duplica nada
ni reescribe la contraseña. Si faltan las variables, avisa con `console.warn` y
sigue: el servidor arranca sin administrador en lugar de no arrancar.

Tres cosas que cuidamos aquí, y que son el motivo de que esta sección exista:

**La contraseña vive solo en el `.env`.** No está en el código, no está en
`.env.example` —ahí va el marcador `REEMPLAZAR_CON_PASSWORD_SEGURO`— y el `.env`
está en `.gitignore` desde el primer laboratorio.

**No se imprime.** El log dice `Administrador inicial creado` y nada más. Un
registro con la contraseña del administrador es tan grave como escribirla en el
código, y peor en un sentido: los registros se copian, se comparten en un chat
para pedir ayuda y se suben a sistemas de monitoreo donde los ve gente que nunca
tuvo que verlos.

**Se guarda como hash.** Pasa por el mismo bcrypt con cost 12 que cualquier otra
contraseña. La cuenta sembrada no es una cuenta de segunda.

## La gestión de usuarios

`POST /api/usuarios` es el único camino por el que se otorgan los roles
`taquilla` y `administrador`. Lo reserva `autorizarRoles("administrador")`.

La decisión de diseño es que `crearUsuarioAdministrativo()` va **aparte** de
`crearUsuario()`, y no es una función con el rol como parámetro opcional:

```js
const crearUsuario = async (datos) => { ...  rol: ROL_POR_DEFECTO ... };
const crearUsuarioAdministrativo = async (datos) => { ... rol: datos.rol ... };
```

Si fueran la misma función con `rol = datos.rol ?? ROL_POR_DEFECTO`, el día que
alguien llamara a esa función desde una ruta nueva sin acordarse de limpiar el
cuerpo, el rol del cliente entraría. Un olvido se convertiría en una escalada de
privilegios. Separándolas, el registro público **no tiene** forma de asignar un
rol: la función que usa no lo acepta.

El `rol` sí llega en el cuerpo, pero pasa por una **lista blanca de dos valores**
que vive en el service, `ROLES_ADMINISTRATIVOS = ["taquilla", "administrador"]`.
Cualquier otro valor es un 400, incluidos `asistente` —que se obtiene
registrándose, no otorgándolo— y `superadmin`, que no existe. Una lista blanca
rechaza lo que no conoce; una lista negra tendría que ir nombrando lo peligroso
uno por uno y siempre se queda corta.

El `id`, el `activo` y el `passwordHash` no se declaran en el validador, así que
`matchedData` los descarta. Y aunque los declarara, el service arma el usuario
campo por campo. Son dos capas y cada una basta sola.

Lo comprobamos enviando los cuatro a la vez —`id: 9999`, `activo: false`,
`passwordHash: "hash-falso"`, `esSuperAdmin: true`— y verificando que ninguno
tuvo efecto. Aquí aprendimos algo sobre cómo se prueba esto: **la respuesta no
sirve como evidencia**, porque se arma campo por campo y ocultaría igual un
campo que sí se hubiera guardado. Hubo que mirarlo por otras vías:

| Campo colado | Cómo se comprueba que no entró |
| ------------ | ------------------------------ |
| `activo: false` | La cuenta puede entrar. Si estuviera inactiva, el login daría 403 |
| `passwordHash` | Entra con la contraseña real, y `"hash-falso"` como contraseña da 401 |
| `id: 9999` | El usuario siguiente es `id + 1` del creado, no 10000 |
| `esSuperAdmin` | No se ve por HTTP: se inspeccionó el registro guardado llamando al service directamente, saltándose el validador |

## La tabla de permisos

Son 48 endpoints en 26 rutas. 36 exigen sesión.

| Método | Ruta | Quién | Guarda de propiedad |
| ------ | ---- | ----- | ------------------- |
| GET | `/api/eventos` | público | — |
| GET | `/api/eventos/:id` | público | — |
| POST, PUT, PATCH, DELETE | `/api/eventos` y `/api/eventos/:id` | administrador | — |
| PATCH | `/api/eventos/:id/estado` | administrador | — |
| GET | `/api/localidades`, `/api/localidades/:id` | público | — |
| POST, PUT, PATCH, DELETE | `/api/localidades` y `/api/localidades/:id` | administrador | — |
| PATCH | `/api/localidades/:id/estado` | administrador | — |
| GET | `/api/funciones` y sus consultas | público | — |
| POST, PUT, PATCH, DELETE | `/api/funciones` y `/api/funciones/:id` | administrador | — |
| PATCH | `/api/funciones/:id/estado` | administrador | — |
| GET | `/api/asistentes` | administrador, taquilla | — |
| GET | `/api/asistentes/:id` | administrador, taquilla | — |
| POST | `/api/asistentes` | administrador, taquilla | — |
| PUT, PATCH, DELETE | `/api/asistentes/:id` | administrador | — |
| GET, POST, PATCH | `/api/asistentes/mio` | asistente | identidad desde el token |
| GET | `/api/boletas` | administrador | — |
| GET | `/api/boletas/mias` | asistente | identidad desde el token |
| GET | `/api/boletas/asistente/:asistenteId` | administrador, taquilla, asistente | `autorizarAsistentePropio` |
| GET | `/api/boletas/funcion/:funcionId` | administrador, taquilla | — |
| GET | `/api/boletas/:id` | administrador, taquilla, asistente | `autorizarAccesoBoleta` |
| POST | `/api/boletas` | administrador, taquilla, asistente | `asistenteId` desde el token |
| PUT, PATCH | `/api/boletas/:id` | administrador, taquilla | — |
| PATCH | `/api/boletas/:id/estado` | administrador, taquilla, asistente | `autorizarCambioEstadoBoleta` |
| DELETE | `/api/boletas/:id` | administrador | — |
| POST | `/api/usuarios` | administrador | — |
| POST | `/api/auth/registro`, `/api/auth/login` | público | — |
| GET | `/api/auth/perfil` | cualquier sesión | — |

**La cartelera sigue pública** a propósito. Eventos, localidades, funciones,
tarifas y ocupación no piden JWT, porque un teatro publica su programación: es
información que quiere que se vea. Pedir sesión para consultar la cartelera no
añadiría seguridad, solo estorbaría, y obligaría a la Sala a exigir una cuenta
para mirar un cartel.

## IDOR y BOLA: las tres guardas

Un **IDOR**, *Insecure Direct Object Reference*, es cuando el identificador de
un registro viaja en la petición y el servidor lo usa sin comprobar si quien
pregunta tiene derecho a ese registro. No hace falta ninguna herramienta: se
cambia un número en la barra de direcciones.

Nuestra API tenía dos:

- `GET /api/boletas/asistente/:asistenteId` devolvía las boletas de cualquiera.
- `PATCH /api/boletas/:id/estado` dejaba pagar y cancelar la boleta de cualquiera.

Y uno que no habíamos visto: `POST /api/boletas` aceptaba el `asistenteId` del
cuerpo, así que se podía **emitir una boleta a nombre de otra persona** y
gastarle su límite de seis.

`src/middlewares/propiedad.middleware.js` los cierra con tres guardas. Todas
comparten la misma pieza:

```js
const asistenteDelToken = (req) =>
  asistentesService.buscarAsistentePorUsuario(req.usuario.id);
```

Esa línea es el laboratorio entero. El asistente propio se resuelve **desde
`req.usuario.id`**, que lo puso `autenticarJWT` al verificar la firma. Nunca
desde el cuerpo, nunca desde la dirección, nunca desde una cabecera. Es la
diferencia entre autorizar y confiar: el id del token viene firmado por nosotros
y cualquier otro id lo escribe el cliente.

| Guarda | Ruta | Qué decide |
| ------ | ---- | ---------- |
| `autorizarAsistentePropio` | `GET /api/boletas/asistente/:asistenteId` | Mostrador pasa; el asistente solo si el id es el suyo |
| `autorizarAccesoBoleta` | `GET /api/boletas/:id` | 404 si no existe; mostrador pasa; el asistente solo si la boleta es suya |
| `autorizarCambioEstadoBoleta` | `PATCH /api/boletas/:id/estado` | Igual, y además limita al dueño a `pagada` y `cancelada` |

El vínculo entre una cuenta y un asistente es el campo `usuarioId`, que ya
existía desde la fase del frontend. Este laboratorio le añade que el
administrador lo pueda asignar, con tres comprobaciones: el usuario debe existir
(400), debe tener el rol `asistente` (409) y no puede estar ya asociado a otro
asistente (409).

## Las decisiones de seguridad

### El 403 va antes que el 400 y el 409

En la asociación de un asistente con una cuenta, el orden de las comprobaciones
es: primero el rol, después el dato.

```js
if (datos.usuarioId === undefined) return null;
if (rol !== "administrador") return { status: 403, ... };
const usuario = usuariosService.obtenerUsuarioPorId(datos.usuarioId);
if (!usuario) return { status: 400, mensaje: "El usuario asociado no existe" };
```

Si comprobáramos primero si el usuario existe, la taquilla podría **enumerar
ids de usuario** probándolos uno por uno: el 400 ("no existe") y el 409 ("ya
está asociado") son respuestas distintas entre sí, y esa diferencia ya es
información que no le corresponde. Primero se decide si el rol puede preguntar,
y solo entonces se mira el dato.

Es la misma idea que ya aplicábamos en el login, donde el 401 no distingue si
falló el correo o la contraseña.

### El 403 en vez del 404

Cuando un asistente pide `GET /api/boletas/asistente/9999`, con un id que no
existe, respondemos **403** y no 404.

La tentación es responder 404, porque es verdad: no existe. Pero si el código
dependiera de que el id existiera, la diferencia entre las dos respuestas sería
un **oráculo**: probando ids se sabría cuántos asistentes hay registrados y
cuáles. La guarda corre antes del controlador y responde 403 a todo lo que no
sea el propio id, exista o no.

En `GET /api/boletas/:id` sí respondemos 404 primero, y es una decisión
distinta a propósito. Ahí el 404 lo ve cualquier sesión, y aceptamos que revela
qué ids de boleta existen. Lo dejamos así porque es lo que hace la guía y porque
un id de boleta no es un dato personal; lo anotamos abajo como algo mejorable.

### El `usuarioId` da 403 en vez de ignorarse

En el laboratorio 8 aprendimos que un campo que el cliente no puede fijar es
mejor **no declararlo**: `matchedData` lo descarta y la respuesta sigue siendo
201. Por eso el registro público devuelve 201 aunque le manden `rol`.

Aquí hicimos lo contrario, y conviene explicar por qué no es una contradicción.

El `usuarioId` **sí es un campo legítimo** del contrato: el administrador lo
usa para asociar un asistente a una cuenta. Está declarado en el validador y
documentado en el schema. Lo que cambia según quién pregunta no es si el campo
existe, sino si ese rol puede usarlo.

Descartarlo en silencio para la taquilla devolvería **201 mintiendo**: la
respuesta diría "asistente creado correctamente" y el vínculo que pidió no
estaría hecho, sin que nada avisara. El 403 dice la verdad: lo que pediste no te
corresponde.

La regla que sacamos: **un campo que nadie puede fijar no se declara; un campo
que solo algunos pueden fijar se declara y se controla por rol.**

Lo mismo vale en `PATCH /api/asistentes/mio`, donde un asistente que manda
`usuarioId` recibe 403. Por esa ruta el vínculo sale del token, así que enviarlo
es intentar ligarse a otra cuenta.

### El precio y el código siguen siendo del servidor

Nada de esto debilitó lo anterior. `POST /api/boletas` sigue calculando el
precio desde la tarifa de la función y generando el código; `precio`, `codigo` y
`estado` no están declarados en el validador. Lo que este laboratorio añade es
que tampoco el `asistenteId` lo decide el cliente cuando quien compra es un
asistente.

### El permiso no deroga la máquina de estados

Son dos controles distintos y se ven en el código de respuesta. Que la taquilla
tenga permiso para marcar una boleta como `usada` no significa que pueda:
sigue haciendo falta que la función esté `en_curso`. La taquilla pasa el control
de rol y choca con la validación en la puerta, y recibe **409**, no 403.

Al revés también: el dueño de una boleta `cancelada` no la revive, aunque sea
suya. 409.

## Las desviaciones frente a la guía

La guía está escrita sobre un sistema de **citas médicas** con pacientes y
médicos. El teatro no se traduce campo por campo, y donde no se traduce lo
decidimos a conciencia en lugar de forzar la analogía.

### El médico posee citas; la taquilla no posee boletas

Es la diferencia estructural. En la guía, un médico **es** una entidad con citas
propias: tiene sentido preguntar por "sus" citas y comprobar que no ve las de
otro médico. En el teatro, `taquilla` es **solo un rol de una cuenta**. No hay
una tabla de taquilleros, ni una boleta tiene un campo que diga quién la vendió.

Por eso las pruebas 15 a 18 y la 23 no tienen equivalente, y abajo decimos qué
pruebas ocupan su lugar.

Lo que sí modela la taquilla es su vista de trabajo:
`GET /api/boletas/funcion/:funcionId`, las boletas de una función, que es lo que
necesita quien atiende la puerta de una sala.

### El asistente compra; el paciente no agenda

En la guía, crear una cita es una operación administrativa y el paciente recibe
403. En el teatro **el asistente compra su propia boleta**: es el caso de uso
central del proyecto y la Sala entera existe para eso. Responder 403 convertiría
la taquilla en línea en una pantalla de solo lectura.

La protección no es prohibirlo, es **quitarle la decisión de a nombre de quién**.
Cuando compra un asistente, el `asistenteId` del cuerpo se ignora y la boleta
sale a nombre del asistente de su cuenta. La taquilla y la administración sí lo
indican, porque venden para quien tienen delante.

### El asistente cambia el estado de su boleta

En la guía, cambiar el estado de una cita es administrativo. En el teatro, pagar
y cancelar **son del dueño**: el pago lo hace quien compra y la cancelación es un
derecho de quien compró.

Lo que no es del dueño es marcar una boleta como `usada`. Eso ocurre cuando el
público entra a la sala, lo hace quien revisa en la puerta, y permitirlo desde el
móvil del espectador rompería el control de acceso. El reparto quedó así:

| Estado | Quién lo puede pedir |
| ------ | -------------------- |
| `pagada` | el dueño, taquilla, administrador |
| `cancelada` | el dueño, taquilla, administrador |
| `usada` | taquilla, administrador |

### Las transiciones de sala son solo del administrador

`PATCH /api/funciones/:id/estado` lo reservamos al administrador completo. Lo
razonable a futuro sería que la taquilla pudiera pasar una función a `en_curso`
y a `finalizada`, que son operaciones de sala y no de programación, pero eso
exige un control **por transición** y no por endpoint. Queda anotado como
mejora.

## La tabla de las 30 pruebas obligatorias

Las 101 comprobaciones de `pruebas/pruebas-autorizacion.js` cubren las 30. La
columna de la derecha dice cuál las comprueba.

| # | Prueba de la guía | Equivalente en el teatro | Comprobación | Resultado |
| - | ----------------- | ------------------------ | ------------ | --------- |
| 1 | Sin JWT → recurso protegido: 401 | igual | "Escribir sin token es 401, no 403", "Leer una boleta sin JWT es 401", "Crear un usuario sin token es 401" | correcto |
| 2 | JWT inválido o alterado: 401 | igual | "Un token con la firma roto es 401" | correcto |
| 3 | Paciente → operación de admin: 403 | asistente | "Un asistente no crea eventos", "Un asistente no borra el evento de prueba" | correcto |
| 4 | Médico → operación de admin: 403 | taquilla | "La taquilla no crea usuarios", "La taquilla no asocia un asistente a una cuenta" | correcto |
| 5 | Admin → operación administrativa: 200/201 | igual | "El administrador sí crea eventos" (201), "El administrador crea una cuenta de taquilla" (201) | correcto |
| 6 | Registro con `rol:"administrador"` → queda paciente: 201 | queda asistente | "Registrarse con rol administrador devuelve 201 y la cuenta queda asistente" | correcto |
| 7 | Registro con `activo:false` → queda activo: 201 | igual | "Registrarse con activo:false devuelve 201 y la cuenta queda activa" | correcto |
| 8 | Registro con `passwordHash` → ignorado: 201 | igual | "Registrarse con passwordHash devuelve 201 y el hash enviado se ignora" | correcto |
| 9 | Registro con `esSuperAdmin:true` → ignorado: 201 | igual | "Registrarse con esSuperAdmin:true devuelve 201 y el campo no existe" | correcto |
| 10 | Médico → crear usuario privilegiado: 403 | taquilla | "La taquilla no crea usuarios" | correcto |
| 11 | Paciente A → sus citas: 200 | asistente A → `/asistente/A` | "A lee sus propias boletas por su asistenteId" | correcto |
| 12 | Paciente A → citas de B: 403 | igual | "A NO lee las de B cambiando el número", "B tampoco lee las de A" | correcto |
| 13 | Paciente A → su cita individual: 200 | `GET /boletas/:id` propia | "A lee su propia boleta" | correcto |
| 14 | Paciente A → cita individual de B: 403 | igual | "A NO lee la boleta de B", "B NO lee la boleta de A" | correcto |
| 15 | Médico A → sus citas: 200 | **sin equivalente** | sustituida por "La taquilla también: atiende a quien tiene delante" (200 sobre el asistenteId de cualquiera) | correcto |
| 16 | Médico A → citas de B: 403 | **sin equivalente** | sustituida por "La taquilla tampoco" en `/mias` (403) y por `GET /api/boletas/funcion/:funcionId`, que es su vista real | correcto |
| 17 | Médico A → cita individual propia: 200 | **sin equivalente** | sustituida por "La taquilla lee cualquier boleta" (200) | correcto |
| 18 | Médico A → cita individual ajena: 403 | **sin equivalente** | no aplica: la taquilla puede leer cualquier boleta por diseño, porque atiende al público. Lo que no puede es listar toda la boletería: "La taquilla tampoco" (403 en `GET /api/boletas`) | correcto |
| 19 | Paciente → `/mis-citas`: 200, solo propias | asistente → `/boletas/mias` | "A ve en /mias solo sus boletas", "B ve en /mias solo las suyas" | correcto |
| 20 | Médico → `/mis-citas`: 403 | taquilla → `/mias` | "La taquilla tampoco" | correcto |
| 21 | Admin → `/mis-citas`: 403 | igual | "El administrador no tiene /mias" | correcto |
| 22 | Paciente sin perfil → `/mis-citas`: 403 | igual | "Una cuenta de asistente sin perfil no llega a sus boletas", "Un asistente sin perfil recibe 403 en /mias" | correcto |
| 23 | Médico sin perfil | **sin equivalente**, igual que 15-18 | sustituida por la misma de la 22: lo que decide es tener perfil de asistente, no el rol | correcto |
| 24 | Admin → todas las citas: 200 | `GET /api/boletas` | "El administrador sí" | correcto |
| 25 | Paciente → todas: 403 | asistente | "A no lista toda la boletería" | correcto |
| 26 | Médico → todas: 403 | taquilla | "La taquilla tampoco: para eso están las consultas por asistente y por función" | correcto |
| 27 | Paciente/Médico → POST citas: 403 | **desviación** | el asistente compra (201) y la taquilla vende (201). Protegido por "Comprar a nombre de otro acaba a nombre propio" | correcto |
| 28 | Paciente/Médico → PUT/PATCH/DELETE: 403 | asistente 403; taquilla PUT/PATCH sí, DELETE 403 | "Un asistente no modifica una boleta con PUT", "Ni la suya propia", "La taquilla sí pasa el control de rol del PUT", "La taquilla tampoco: borrar es solo del administrador" | correcto |
| 29 | Paciente/Médico → PATCH estado: 403 | **desviación** | el dueño paga y cancela (200); `usada` es 403 para él: "A sí paga su propia boleta", "Y la cancela", "A no marca su propia boleta como usada" | correcto |
| 30 | Sin `X-API-Key`: 401 | igual | "GET /api/eventos sin API Key responde 401", "Leer una boleta sin X-API-Key es 401" | correcto |

### Por qué las 15 a 18 y la 23 se sustituyen así

Las cuatro pruebas del médico comprueban que **un rol intermedio no vea los
datos de otro del mismo rol**. En el teatro ese aislamiento no existe porque la
taquilla no posee boletas: su permiso no es "las mías", es "las de cualquiera,
porque atiendo al público".

Lo que sí hay que comprobar, y comprobamos, es que ese permiso amplio **tenga un
techo**. La taquilla puede leer cualquier boleta y las boletas de cualquier
asistente, pero no puede listar toda la boletería del teatro
(`GET /api/boletas`, 403), no tiene ruta `/mias` (403), no crea usuarios (403) y
no borra boletas (403). Esas cuatro son las que ocupan el lugar de las 15 a 18.

La 23 cae por el mismo motivo, y además su contenido real ya está cubierto: lo
que decide el acceso a `/mias` no es el rol sino **tener perfil de asistente**,
y eso lo prueba la 22.

## Semgrep y npm audit

```bash
semgrep --config p/javascript --config p/nodejs --config p/owasp-top-ten src/ frontend/
npm audit
npm audit --omit=dev
```

| Herramienta | Lab 9 | Lab 10 |
| ----------- | ----- | ------ |
| Semgrep: archivos escaneados | 43 | 66 |
| Semgrep: reglas aplicadas | — | 74 de 563 cargadas |
| Semgrep: hallazgos | 0 | 0 |
| `npm audit`: paquetes | 159 | 159 |
| `npm audit`: vulnerabilidades | 0 | **3 altas** |
| `npm audit --omit=dev`: vulnerabilidades | — | 0 |

**Las tres vulnerabilidades altas son nuevas en este laboratorio y conviene
explicarlas, porque hasta ahora siempre reportamos cero.**

No vienen de nuestro código ni de ninguna dependencia de la API. Vienen de
`braces`, que entra por `chokidar`, que entra por `nodemon`, nuestra única
dependencia de desarrollo. Es una denegación de servicio por agotamiento de pila
con patrones muy anidados.

Con `--omit=dev`, que es lo que de verdad corre en producción, el resultado es
**0 vulnerabilidades** sobre 136 paquetes. `nodemon` solo se usa con `npm run
dev`, en la máquina de quien programa, y el patrón que lo haría fallar tendría
que escribirlo quien lo ejecuta.

No lo arreglamos porque el arreglo es peor: `npm audit fix --force` instala
`nodemon@1.14.10`, una versión de 2018, siete años más vieja y con sus propios
problemas. Preferimos dejar constancia del hallazgo, acotado a desarrollo, antes
que aceptar un cambio que empeora el proyecto para que una tabla diga cero.

### Nota de ejecución

En este equipo **Smart App Control de Windows bloquea `semgrep-core.exe`**,
el binario nativo que hace el análisis (evento 3077 de
`Microsoft-Windows-CodeIntegrity/Operational`). En los laboratorios anteriores el
bloqueo era sobre el lanzador `semgrep.exe` y bastaba invocar el punto de entrada
de Python; ahora el bloqueo alcanza al binario y ese atajo ya no sirve.

El escaneo se hizo con la imagen oficial, que ejecuta el mismo análisis en Linux:

```bash
docker run --rm -v "$(pwd):/src" -w /src semgrep/semgrep \
  semgrep --config p/javascript --config p/nodejs --config p/owasp-top-ten src/ frontend/
```

No desactivamos Smart App Control: es una protección del equipo y bajarla para
que pase una herramienta de análisis sería exactamente el tipo de decisión que
este curso enseña a no tomar.

Salidas completas en `sast-semgrep-lab10.txt` y `sca-npm-audit-lab10.txt`.

## Las pruebas

| Batería | Comprobaciones |
| ------- | -------------- |
| `pruebas.js` | 57 |
| `pruebas-funciones.js` | 58 |
| `pruebas-boletas.js` | 55 |
| `pruebas-limites.js` | 22 |
| `pruebas-cuenta.js` | 22 |
| `pruebas-autorizacion.js` | 101 |
| `verificar-a.js`, `verificar-b.js`, `verificar-c.js` | 16 + 16 + 6 |
| **Total** | **353, 0 fallos** |

`pruebas/sesion.js` centraliza la identidad: pone la API Key en cada petición y
entra como el administrador del `.env` cuando la batería necesita escribir. Las
credenciales nunca están en el código de las pruebas.

Las baterías **no son independientes**: cada una cuenta con los datos semilla
intactos, así que el servidor se reinicia antes de cada una. `verificar-c.js` es
la única que necesita el límite de peticiones en su valor normal, porque
comprueba precisamente que el 429 salte.

Y la Sala se recorrió completa como asistente —cartelera, plano, compra, pago
simulado, "Mis boletas" y cancelación— en 1440 y en 390 píxeles, con la
autorización puesta.

## Lo que este laboratorio no resuelve

**`GET /api/boletas/:id` revela qué ids existen.** Responde 404 antes de mirar el
rol, así que cualquier sesión puede distinguir una boleta inexistente de una
ajena. Es la decisión de la guía y la mantuvimos, pero lo coherente con el resto
sería responder 403 también ahí.

**La taquilla no tiene transiciones de sala.** Pasar una función a `en_curso` o a
`finalizada` es trabajo de sala, no de programación, y hoy exige un
administrador. Hacerlo bien pide un control por transición, no por endpoint.

**Un token conserva el rol con el que se emitió.** Si a alguien le cambian el rol
o lo deshabilitan, su token viejo sigue diciendo el anterior hasta que expire.
Ahora importa más que antes, porque el rol ya decide. Arreglarlo exige consultar
el usuario en cada petición, o tokens de refresco con vida corta.

**No hay forma de revocar un token.** Lo mismo del laboratorio 9, con más
consecuencias ahora que el token abre puertas distintas.

**No se puede quitar un vínculo `usuarioId`.** Se puede asignar y reasignar, pero
no dejar un asistente sin cuenta, porque el `PUT` conserva el valor cuando no
llega en lugar de borrarlo. Lo dejamos así a propósito: anular el vínculo por
omisión convertiría cualquier edición de un nombre en una desvinculación
silenciosa.

**Los asistentes de la semilla no se pueden reclamar desde la cuenta.** Siguen
con `usuarioId: null` y ahora solo el administrador los puede asociar. Es
deliberado: dejar que cualquiera reclame un documento ajeno sería el agujero que
queríamos cerrar.

**No hay registro de auditoría.** Sabemos que un administrador puede asociar
cuentas y crear usuarios, pero no queda constancia de quién lo hizo ni cuándo.
Con permisos de verdad, un registro de quién hizo qué es el paso siguiente.

**Sigue todo en memoria.** Los usuarios, incluido el administrador sembrado,
desaparecen al reiniciar. El bootstrap lo vuelve a crear, pero los demás no.

## Repositorio

https://github.com/JuanK2550/API-TEATRO
