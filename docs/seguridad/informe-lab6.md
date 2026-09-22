# Laboratorio 6 — Múltiples clientes con API Keys almacenadas como hash

## El problema

Hasta el Lab 5 la API tenía una sola clave global, `API_KEY`, en el `.env`.
Funcionaba, pero tenía dos límites:

- No sabía qué cliente hacía cada petición. Todos usaban la misma clave.
- No podía quitarle el acceso a un cliente sin quitárselo a todos. Cambiar la
  clave dejaba fuera a todo el mundo.

En este laboratorio pasé a tres clientes, cada uno con su propia clave, y dejé
de guardar las claves en claro.

## Los tres clientes

Generé tres claves ejecutando tres veces el mismo comando:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Salieron tres valores distintos, de 64 caracteres cada uno.

[Captura] La terminal con las tres ejecuciones del comando y las tres claves.

En el `.env` quité la `API_KEY` vieja y puse las tres nuevas:

| id | Cliente | Variable | Estado |
| -- | ------- | -------- | ------ |
| 1 | Postman Laboratorio | `API_KEY_POSTMAN` | Activa |
| 2 | Taquilla del Teatro | `API_KEY_TAQUILLA` | Activa |
| 3 | Aplicación Móvil | `API_KEY_MOVIL` | Deshabilitada |

El laboratorio de referencia usa una aplicación administrativa como segundo
cliente. En el teatro lo cambié por la taquilla, que es quien vende boletas en
la puerta.

[Captura] El `.env` con `PORT`, `ALLOWED_ORIGIN`, `RATE_LIMIT_MAX` y las tres
claves.

En `.env.example` van las mismas tres variables con el valor
`REEMPLAZAR_CON_API_KEY_SEGURA`. Ese archivo sí se sube al repositorio, así que
nunca lleva claves reales.

[Captura] El `.env.example` con las tres variables de relleno.

## Por qué guardo el hash y no la clave

Al arrancar, el servidor calcula el hash SHA-256 de cada clave y solo se queda
con el hash. La clave original no se guarda en ningún array.

Un hash no se puede deshacer: del hash no se saca la clave. Si alguien lee
`src/data/apiKeys.js` o los datos en memoria, solo ve tres hashes, y un hash no
sirve como clave. Lo comprobé pasándole a `buscarClientePorApiKey` el hash
guardado de Postman como si fuera la clave: devolvió `null`, que el middleware
convierte en 401. El service calcula el hash de lo que recibe, y el hash de un
hash no coincide con nada.

Para comprobar una petición no hace falta la clave original. Calculo el hash de
lo que llega y lo comparo con los hashes guardados.

SHA-256 sin sal funciona aquí porque las claves son 32 bytes aleatorios:
imposibles de adivinar probando. Con contraseñas escritas por personas no
bastaría.

## Las capas nuevas

**`src/utils/crypto.util.js`**
Tiene `generarHash`, que calcula el SHA-256 de un texto, y `compararSeguro`,
que compara dos valores en tiempo constante con `timingSafeEqual`. Toda la
parte criptográfica quedó en este archivo.

**`src/data/apiKeys.js`**
Simula la tabla que después será PostgreSQL. Primero comprueba que existan las
tres variables del `.env` y después arma los tres registros con `id`,
`cliente`, `hash`, `activa` y `creadaEn`.

**`src/services/apiKeys.service.js`**
Tiene `buscarClientePorApiKey`. Calcula el hash de la clave recibida, lo
compara con cada registro usando `compararSeguro` y devuelve el registro que
coincida, o `null`.

**`src/middlewares/apiKey.middleware.js`**
Lo reescribí entero. Ya no usa `crypto` ni tiene su propia copia de
`compararSeguro`: solo le pregunta al service quién es el cliente y decide qué
responder. En todo `src/` quedó una sola `compararSeguro`, la de
`crypto.util.js`.

El orden de dependencias queda así:

```
app.js → middleware → service → data → crypto.util
```

## Los cuatro estados

| Situación | Código | Mensaje |
| --------- | ------ | ------- |
| No envía la cabecera | 401 | API Key requerida |
| La clave no es de ningún cliente | 401 | API Key inválida |
| La clave es de un cliente deshabilitado | 403 | API Key deshabilitada |
| La clave es de un cliente activo | 200 | La petición sigue |

Probé los cuatro contra `GET /api/asistentes`:

| Cabecera `X-API-Key` | Código | Cuerpo |
| -------------------- | ------ | ------ |
| Ninguna | 401 | `{"mensaje":"API Key requerida"}` |
| `cualquier-cosa` | 401 | `{"mensaje":"API Key inválida"}` |
| Clave de Postman Laboratorio | 200 | Listado de 5 asistentes |
| Clave de Taquilla del Teatro | 200 | Listado de 5 asistentes |
| Clave de Aplicación Móvil | 403 | `{"mensaje":"API Key deshabilitada"}` |

También probé que la API Key no reemplaza lo anterior: con una clave válida,
`DELETE /api/funciones/1` sigue dando 409 porque la función tiene boletas.

La diferencia entre 401 y 403:

- **401** es "no sé quién eres". No llegó clave, o llegó una que no reconozco.
- **403** es "sé quién eres, pero no te dejo pasar". La clave es correcta y sé
  que es de la Aplicación Móvil, pero ese cliente está deshabilitado.

El 403 es nuevo. Hasta el Lab 5 solo había 401. Es lo que permite deshabilitar
un cliente sin tocar a los demás: Postman y la taquilla siguen entrando.

[Captura] Postman: `GET /api/asistentes` sin cabecera, 401 "API Key requerida".

[Captura] Postman: la misma petición con `X-API-Key: cualquier-cosa`, 401 "API
Key inválida".

[Captura] Postman: la misma petición con la clave de un cliente activo, 200.

[Captura] Postman: la misma petición con la clave de la Aplicación Móvil, 403
"API Key deshabilitada".

## Cambio de comportamiento: la configuración se revisa al arrancar

Antes, si faltaba la variable `API_KEY`, el servidor arrancaba igual. El fallo
aparecía con la primera petición: el middleware no encontraba la variable y
respondía 500 "Error de configuración del servidor". Lo vi pasar en este mismo
laboratorio: al quitar `API_KEY` del `.env` y antes de reescribir el
middleware, todo `/api` respondía 500, con clave o sin ella.

Ahora la comprobación está en `src/data/apiKeys.js` y se ejecuta al cargar el
archivo. Si falta alguna de las tres variables, lanza un error y el servidor no
llega a arrancar.

Lo comprobé arrancando la API con `API_KEY_MOVIL` vacía:

```
Error: Faltan variables de entorno para las API Keys
```

El proceso terminó con código 1 y el servidor nunca se puso a escuchar.

Es mejor así. Un servidor mal configurado no debería arrancar y quedarse
esperando a que la primera petición descubra el problema.

Esto depende del orden de carga. `apiKeys.js` lee `process.env` en cuanto se
importa, así que dotenv tiene que haber corrido antes. En `app.js`,
`require("dotenv").config()` es la primera línea de código, antes de cualquier
otro `require`, así que no hubo problema. Lo comprobé también al revés: si
cargo `apiKeys.js` sin dotenv, lanza el error aunque las variables estén bien
en el `.env`.

## El endpoint `/api/seguridad/cliente`

Cuando la clave es válida, el middleware deja en la petición quién es el
cliente:

```js
req.clienteApi = { id: cliente.id, nombre: cliente.cliente };
```

Creé `src/routes/seguridad.routes.js` con una sola ruta, `GET /cliente`, que
devuelve eso. No necesita su propio middleware: como `validarApiKey` está
montado sobre todo `/api`, la ruta queda protegida sola.

Hice cuatro peticiones a la misma URL, cambiando solo la cabecera:

**Clave de Postman Laboratorio → 200**
```json
{
  "mensaje": "Cliente autenticado",
  "cliente": { "id": 1, "nombre": "Postman Laboratorio" }
}
```

**Clave de Taquilla del Teatro → 200**
```json
{
  "mensaje": "Cliente autenticado",
  "cliente": { "id": 2, "nombre": "Taquilla del Teatro" }
}
```

**Clave de Aplicación Móvil → 403**
```json
{ "mensaje": "API Key deshabilitada" }
```

**Sin cabecera → 401**
```json
{ "mensaje": "API Key requerida" }
```

La URL es exactamente la misma en las cuatro. Lo único que cambia es la
cabecera, y el servidor sabe decir quién está pidiendo. Eso es lo que no se
podía hacer con una sola clave global.

[Captura] `GET /api/seguridad/cliente` con la clave de Postman Laboratorio:
`id 1, Postman Laboratorio`.

[Captura] La misma petición con la clave de Taquilla del Teatro: `id 2,
Taquilla del Teatro`.

## `app.js` y Swagger casi no cambiaron

En `app.js` solo añadí dos líneas: la importación del router de seguridad y su
`app.use("/api/seguridad", …)`. El montaje de `validarApiKey` es el mismo del
Lab 5. `app.js` no sabe que ahora hay tres claves, ni que se guardan como hash.

En Swagger no toqué `securitySchemes` ni `security`. La definición sigue
diciendo lo mismo: el cliente manda una API Key en la cabecera `X-API-Key`.
Da igual si detrás hay una clave o trescientas. Solo añadí el tag "Seguridad"
para la ruta nueva.

Eso pasa porque cada capa hace una sola cosa. Todo el cambio quedó dentro de
middleware, service, data y crypto.util.

Después del cambio, `/openapi.json` tiene 39 endpoints en 19 rutas: los 38 que
había más el nuevo. Siguen los 30 schemas.

## Verificación con Semgrep y npm audit

Repetí las dos herramientas al terminar:

```bash
semgrep --config p/javascript --config p/nodejs --config p/owasp-top-ten src/
npm audit
```

| Herramienta | Alcance | Resultado |
| ----------- | ------- | --------- |
| Semgrep 1.172.0 | 73 reglas, 35 archivos | 0 hallazgos |
| `npm audit` | Dependencias del proyecto | 0 vulnerabilidades |

Los cuatro archivos nuevos todavía no tenían commit y aun así entraron en el
escaneo: Semgrep excluye lo que está en `.gitignore`, no lo que falta por
commitear. Lo comprobé sacando la lista de archivos escaneados. Además los
escaneé aparte, con el mismo resultado de 0 hallazgos.

No añadí dependencias. `crypto` viene con Node. `package.json` y
`package-lock.json` no cambiaron.

Salidas guardadas en `sast-semgrep-lab6.txt` y `sca-npm-audit-lab6.txt`.

## Las 224 pruebas

Los 7 scripts de `pruebas/` leían la clave de `process.env.API_KEY`. Al quitar
esa variable del `.env` quedaron sin clave, y además en ese momento todo `/api`
respondía 500 por el middleware viejo.

No los ejecuté en ese estado, así que no tengo un número de pruebas rotas. Los
arreglé antes de correrlos: cambié en los siete `process.env.API_KEY` por
`process.env.API_KEY_POSTMAN`. Ningún script tiene una clave escrita; la leen
del `.env` con dotenv.

Después del cambio pasaron las 224.

| Script | Comprobaciones |
| ------ | -------------- |
| `pruebas.js` | 57 |
| `pruebas-funciones.js` | 52 |
| `pruebas-boletas.js` | 55 |
| `pruebas-limites.js` | 22 |
| `verificar-a.js`, `verificar-b.js`, `verificar-c.js` | 38 |
| **Total** | **224** |

## Lo que todavía no sé

Con esto sé **qué aplicación** consume la API: Postman, la taquilla o la
aplicación móvil. No sé **qué persona** la está usando. Si alguien vende una
boleta desde la taquilla, la API sabe que fue la taquilla, no quién estaba en
la taquilla.

Tampoco hay roles. Un cliente activo puede hacer todo lo que permite la API.

Para saber quién es la persona hacen falta usuarios con contraseña, y después
tokens y roles. Eso queda para el siguiente laboratorio.

## Repositorio

https://github.com/JuanK2550/API-TEATRO

Commit: `57243ec` "Lab 6: múltiples clientes con API Keys almacenadas como
hash". Las salidas de Semgrep y npm audit van en `9b5cc5b`.

Antes de subir comprobé que `.env` no estaba en el repositorio ni en el
historial, y que ninguna de las tres claves aparecía en ningún archivo ni en
ningún commit.
