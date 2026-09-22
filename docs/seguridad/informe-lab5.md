# Laboratorio 5 — Bloques 1 y 3

## 1. Introducción

El laboratorio pedía dos cosas sobre la API que ya teníamos: integridad
referencial en los borrados y protección de `/api` con una API Key. La
referencia es el proyecto API HOSPITAL y lo que se hizo fue llevar ese mismo
patrón a API_TEATRO, que guarda los datos en memoria y tiene cinco recursos
relacionados entre sí: eventos, funciones, localidades, asistentes y boletas.
El Bloque 2, la auditoría SCA + SAST + DAST, se entregó el 16 de septiembre de
2026 y se adjunta de nuevo como informe aparte. De su checkpoint quedaba un
punto a medias: el de "DELETE protegido". En esa entrega solo estaba protegido
el `DELETE` de funciones, y con el Bloque 1 quedan protegidos los cuatro.

---

## 2. Bloque 1 — Integridad referencial

### El problema

Los datos están en arrays en memoria, sin base de datos que vigile las
relaciones. Antes de este bloque se podía borrar un evento que tenía funciones,
o un asistente que tenía boletas. Los hijos quedaban apuntando a un id que ya no
existía: registros huérfanos. Es lo que una base de datos evita con
`FOREIGN KEY ... ON DELETE RESTRICT`, y aquí había que hacerlo a mano.

### Qué DELETE se protegieron

| Recurso | No se elimina si | Código |
| ------- | ---------------- | ------ |
| Asistente | Tiene boletas | 409 |
| Evento | Tiene funciones | 409 |
| Localidad | Tiene boletas, o aparece en las tarifas de alguna función | 409 |
| Función | Tiene boletas | 409 |

La localidad tiene dos comprobaciones porque se referencia desde dos sitios:
desde las boletas y desde el cuadro de tarifas de cada función.

### Cancelar no es eliminar

El proyecto ya tenía `existenBoletasActivasDeFuncion`, que **excluye** las
boletas canceladas. Sirve para la regla de negocio: una boleta cancelada libera
su butaca y esa butaca se puede revender.

Para la integridad referencial hace falta lo contrario. Una boleta cancelada
sigue siendo un registro histórico y sigue apuntando a su función, su localidad
y su asistente. Si se borrara cualquiera de los tres, esa referencia quedaría
rota. Por eso las funciones nuevas cuentan **todas** las boletas, sin mirar el
estado.

Son dos preguntas distintas sobre los mismos datos, así que se dejaron las dos.
`existenBoletasActivasDeFuncion` sigue en el service, sin tocar.

Esto cambió el comportamiento del `DELETE` de funciones. Antes, una función
cuya única boleta estaba cancelada se podía borrar y devolvía 200. Ahora
devuelve 409. Con ese cambio se rompieron 4 pruebas de las 224:

- 3 seguían esperando el mensaje anterior, "No se puede eliminar una función
  con boletas vendidas". El código seguía siendo 409.
- 1 era un cambio real: `DELETE /api/funciones/7` esperaba 200 y ahora da 409.

Las cuatro se actualizaron al comportamiento nuevo.

### Las cinco funciones nuevas

En `src/services/boletas.service.js`:

| Función | Devuelve |
| ------- | -------- |
| `asistenteTieneBoletas(asistenteId)` | `true` si alguna boleta apunta a ese asistente |
| `funcionTieneBoletas(funcionId)` | `true` si alguna boleta apunta a esa función |
| `localidadTieneBoletas(localidadId)` | `true` si alguna boleta apunta a esa localidad |

En `src/services/funciones.service.js`:

| Función | Devuelve |
| ------- | -------- |
| `eventoTieneFunciones(eventoId)` | `true` si alguna función apunta a ese evento |
| `localidadTieneTarifas(localidadId)` | `true` si alguna función tiene tarifa para esa localidad |

Todas usan `some(...)` comparando con `Number(id)`, sin filtrar por estado.

Comprobación con los datos semilla, donde la boleta 7 es la única cancelada y
pertenece a la función 7:

| Llamada | Resultado |
| ------- | --------- |
| `existenBoletasActivasDeFuncion(7)` | `false`, la cancelada no cuenta |
| `funcionTieneBoletas(7)` | `true`, la cancelada sí cuenta |

### Orden de comprobaciones

Los cuatro controllers siguen el mismo orden:

1. El recurso no existe → **404**
2. El recurso tiene relaciones → **409** con un mensaje que dice cuáles
3. No tiene relaciones → se borra y devuelve **200**

El id inválido (`abc`, `-5`, `2.7`) lo rechaza antes el validador, con **400**.

[Captura] Postman con los cuatro 409: el DELETE de un asistente con boletas, de
un evento con funciones, de una localidad con boletas y de una función con
boletas, con el mensaje de cada uno.

[Captura] Postman con un DELETE que sí borra: 200 y "eliminado correctamente".

### Checkpoint de los siete puntos

| # | Punto | Petición | Esperado | Obtenido | Pasa |
| - | ----- | -------- | -------- | -------- | ---- |
| 1 | Padre con hijos | `DELETE /api/asistentes/1` | 409 | 409 | Sí |
| 1 | Padre con hijos | `DELETE /api/eventos/1` | 409 | 409 | Sí |
| 1 | Padre con hijos | `DELETE /api/localidades/1` | 409 | 409 | Sí |
| 1 | Padre con hijos | `DELETE /api/funciones/1` | 409 | 409 | Sí |
| 2 | Sin relaciones | `DELETE /api/funciones/8` | 200 | 200 | Sí |
| 2 | Sin relaciones | `DELETE /api/asistentes/6` | 200 | 200 | Sí |
| 2 | Sin relaciones | `DELETE /api/eventos/6` | 200 | 200 | Sí |
| 2 | Sin relaciones | `DELETE /api/localidades/4` | 200 | 200 | Sí |
| 3 | Id inexistente | `DELETE /api/asistentes/9999` | 404 | 404 | Sí |
| 3 | Id inexistente | `DELETE /api/eventos/9999` | 404 | 404 | Sí |
| 3 | Id inexistente | `DELETE /api/localidades/9999` | 404 | 404 | Sí |
| 3 | Id inexistente | `DELETE /api/funciones/9999` | 404 | 404 | Sí |
| 4 | Id inválido | `DELETE /api/asistentes/abc` | 400 | 400 | Sí |
| 4 | Id inválido | `DELETE /api/eventos/-5` | 400 | 400 | Sí |
| 4 | Id inválido | `DELETE /api/localidades/2.7` | 400 | 400 | Sí |
| 4 | Id inválido | `DELETE /api/funciones/abc` | 400 | 400 | Sí |
| 5 | 404 antes que 409 | `DELETE /api/asistentes/6` ya borrado | 404 | 404 | Sí |
| 5 | 404 antes que 409 | `DELETE /api/funciones/8` ya borrada | 404 | 404 | Sí |
| 6 | Relación cancelada | `GET /api/boletas/funcion/7` | — | boleta 7, cancelada | Sí |
| 6 | Relación cancelada | `DELETE /api/funciones/7` | 409 | 409 | Sí |
| 7 | Sin huérfanos | Boletas que apunten al asistente 6 | 0 | 0 | Sí |
| 7 | Sin huérfanos | Funciones que apunten al evento 6 | 0 | 0 | Sí |
| 7 | Sin huérfanos | Boletas que apunten a la localidad 4 | 0 | 0 | Sí |
| 7 | Sin huérfanos | Tarifas que apunten a la localidad 4 | 0 | 0 | Sí |
| 7 | Sin huérfanos | Boletas que apunten a la función 8 | 0 | 0 | Sí |
| 7 | Sin huérfanos | Barrido de todas las referencias | 0 | 0 | Sí |

26 comprobaciones, 0 fallos.

Tres aclaraciones sobre cómo se probaron:

- Los recursos del punto 2 se crearon durante la prueba, porque todos los de los
  datos semilla tienen relaciones. La función 8 se borró primero, ya que
  incluía la localidad 4 en sus tarifas.
- El punto 5 no se puede probar con un id que a la vez no exista y tenga
  relaciones. Lo que se comprueba es que un id que ya no está devuelve 404 y no
  entra en la rama de relaciones. En el código, los cuatro controllers hacen el
  `obtener...PorId` antes de consultar las relaciones.
- El último caso del punto 7 recorre todas las boletas y funciones y comprueba
  que cada `asistenteId`, `funcionId`, `localidadId` y `eventoId` apunte a un
  registro existente. Ninguna referencia quedó rota.

---

## 3. Bloque 3 — API Key

### Objetivo

Antes, cualquiera que llegara a `/api` podía operar. Ahora toda petición a
`/api` exige la cabecera `X-API-Key`. Esto autentica al **cliente** que consume
la API, no a una persona: no hay cuentas, ni roles, ni permisos.

### Generación de la clave

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Son 32 bytes aleatorios en hexadecimal, 64 caracteres. La clave no se inventó ni
se eligió a mano.

### `.env` y `.env.example`

En `.env` va la clave real:

```
# Clave requerida para consumir los endpoints protegidos de /api
API_KEY=<64 caracteres hexadecimales>
```

En `.env.example` va la misma línea con un valor de relleno:

```
API_KEY=REEMPLAZAR_CON_API_KEY_SEGURA
```

`.env.example` se sube al repositorio y sirve de plantilla, así que nunca puede
llevar la clave real. `.env` está en `.gitignore`.

[Captura] El `.env` con la clave, el `.env.example` con el valor de relleno y el
`.gitignore` con `.env` y `node_modules/`.

### El middleware

Archivo `src/middlewares/apiKey.middleware.js`, con dos funciones:

**`compararSeguro(valorRecibido, valorEsperado)`**
Convierte las dos cadenas a Buffer. Si miden distinto devuelve `false`, porque
`timingSafeEqual` exige buffers del mismo tamaño. Si miden igual, devuelve
`crypto.timingSafeEqual(recibido, esperado)`.

**`validarApiKey(req, res, next)`**

| Situación | Respuesta |
| --------- | --------- |
| `API_KEY` no está configurada | 500 `{ mensaje: "Error de configuración del servidor" }` y aviso con `console.error` |
| No llega la cabecera | 401 `{ mensaje: "API Key requerida" }` |
| La cabecera no coincide | 401 `{ mensaje: "API Key inválida" }` |
| Coincide | `next()` |

La clave que falta es un fallo del servidor, no del cliente: por eso es 500 y no
401. La clave se lee solo con `req.get("X-API-Key")`, nunca de la query.

### Por qué `timingSafeEqual` y no `===`

Comparar dos cadenas con `===` se detiene en el primer carácter distinto. Si el
atacante acierta el primer carácter, la comparación tarda un poquito más que si
falla en el primero. Repitiendo miles de intentos y midiendo esos tiempos se
puede ir deduciendo la clave carácter a carácter. Eso es un timing attack.
`timingSafeEqual` recorre siempre todos los bytes, tarde lo que tarde, así que
el tiempo de respuesta no dice nada sobre cuánto se acertó.

### Dónde se montó

En `src/app.js`, después del límite de peticiones y antes de los routers:

```js
app.use("/api", validarApiKey);
```

La cadena completa queda así:

1. helmet
2. CORS
3. `express.json({ limit: "10kb" })`
4. Límite de peticiones
5. **API Key**
6. Routers de `/api`
7. Validadores
8. Controllers
9. Services

La ruta raíz `/`, Swagger UI en `/api-docs` y el spec en `/openapi.json` quedan
fuera de `/api`, así que siguen públicos.

### Swagger

En `src/docs/swagger.js` se agregó dentro de `components`:

```js
securitySchemes: {
  ApiKeyAuth: {
    type: "apiKey",
    in: "header",
    name: "X-API-Key",
    description: "API Key requerida para consumir los endpoints protegidos."
  }
}
```

y en la raíz de la definición:

```js
security: [{ ApiKeyAuth: [] }]
```

Efecto: aparece el botón **Authorize** arriba a la derecha y un candado en cada
operación, 38 de 38. Después del cambio siguen estando los 30 schemas, las 18
rutas y los 38 endpoints: no se perdió nada al fusionar con los bloques
`@openapi` de las rutas.

Detalle menor: al ejecutar sin autorizar, Swagger muestra "401 Undocumented",
porque el 401 no está declarado dentro de cada operación. El código y el cuerpo
son los correctos.

[Captura] Swagger UI con el botón Authorize y los candados en los endpoints.

[Captura] El diálogo de Authorize con el campo de la API Key.

[Captura] Swagger: `POST /api/asistentes` autorizado, respuesta 201.

[Captura] Swagger: el mismo POST tras pulsar Logout, respuesta 401.

### Checkpoint del bloque

| Caso | Esperado | Obtenido | Mensaje |
| ---- | -------- | -------- | ------- |
| `GET /api/asistentes` sin cabecera | 401 | 401 | API Key requerida |
| Con `X-API-Key` incorrecta | 401 | 401 | API Key inválida |
| Con clave incorrecta del mismo largo | 401 | 401 | API Key inválida |
| Con la clave real | 200 | 200 | Array de asistentes |
| `?apiKey=LA_CLAVE` sin cabecera | 401 | 401 | API Key requerida |
| `GET /` | 200 | 200 | API Teatro funcionando |
| `GET /api-docs/` | 200 | 200 | Swagger UI |
| `GET /openapi.json` | 200 | 200 | El spec |
| `DELETE /api/funciones/1` con clave válida | 409 | 409 | Tiene boletas asociadas |
| Swagger tras Authorize | 200 | 200 | Array de asistentes |
| Swagger tras Logout | 401 | 401 | API Key requerida |

El caso de la clave incorrecta del mismo largo se agregó para llegar de verdad a
`timingSafeEqual`: si las longitudes no coinciden, la comparación se corta antes.

El último 409 muestra que la API Key no reemplaza las defensas anteriores. La
petición está autenticada y aun así la integridad referencial la rechaza.

La clave en la query string se rechaza a propósito. Las URLs quedan guardadas en
el historial del navegador, en los registros del servidor y en los proxies por
los que pase la petición. Una cabecera no aparece en esos sitios.

[Captura] Postman: `GET /api/asistentes` sin cabecera, 401 "API Key requerida".

[Captura] Postman: la misma petición con una clave incorrecta, 401 "API Key
inválida".

[Captura] Postman: la clave puesta en la URL como `?apiKey=...`, 401.

[Captura] Postman: la petición con la cabecera `X-API-Key` puesta, 200 con el
listado.

También se probó el caso de `API_KEY` sin configurar, llamando al middleware
suelto: responde 500 "Error de configuración del servidor" y deja el aviso en
consola.

---

## 4. Verificación posterior

### SAST y SCA

Se repitieron las dos herramientas después del Bloque 3.

```bash
semgrep --config p/javascript --config p/nodejs --config p/owasp-top-ten src/
npm audit
```

| Herramienta | Alcance | Resultado |
| ----------- | ------- | --------- |
| Semgrep 1.172.0 | 73 reglas, 31 archivos | 0 hallazgos |
| `npm audit` | Dependencias del proyecto | 0 vulnerabilidades |

El middleware nuevo entró en el escaneo aunque todavía no estaba en ningún
commit: Semgrep excluye lo que está en `.gitignore`, no lo que falta por
commitear. Se ve en el conteo, que pasó de 30 a 31 archivos. Además se escaneó
el archivo aparte, indicándolo directamente, con el mismo resultado de 0
hallazgos. Las dos salidas están en `sast-semgrep-bloque3.txt`.

No se agregó ninguna dependencia. `crypto` viene incluido en Node, no se instala
con npm. Las dependencias siguen siendo las mismas ocho, más `nodemon` en
desarrollo.

Salidas guardadas en esta carpeta, sin borrar las anteriores:

- `sast-semgrep-bloque3.txt`
- `sca-npm-audit-bloque3.txt`

### Las 224 pruebas

Al montar el middleware se rompieron **218 de 224**. Todas las que pegan contra
`/api` empezaron a recibir 401. De hecho los scripts fallaban en la primera
petición y ni llegaban a imprimir resultados.

Las 6 que seguían pasando son las de `verificar-c.js`, porque comprueban cosas
que ocurren antes del middleware: el cuerpo de más de 10kb (413), el JSON mal
formado (400), el límite de peticiones (429), las cabeceras de seguridad y el
error interno sin stack trace.

El arreglo fue agregar a los 7 scripts una cabecera que lee la clave del `.env`
con dotenv y la inyecta en cada petición. La clave no está escrita en ningún
script. Después del cambio: **224 de 224 correctas**.

| Script | Comprobaciones |
| ------ | -------------- |
| `pruebas.js` | 57 |
| `pruebas-funciones.js` | 52 |
| `pruebas-boletas.js` | 55 |
| `pruebas-limites.js` | 22 |
| `verificar-a.js`, `verificar-b.js`, `verificar-c.js` | 38 |
| **Total** | **224** |

---

## 5. Repositorio

https://github.com/JuanK2550/API-TEATRO

| Commit | Contenido |
| ------ | --------- |
| `1d2f616` Bloque 1: integridad referencial en los DELETE | Las cinco funciones nuevas en los services y los cuatro DELETE protegidos en los controllers |
| `71bd251` Bloque 3: autenticación por API Key | `apiKey.middleware.js`, el montaje en `app.js`, `securitySchemes` y `security` en `swagger.js`, `.env.example` y el README |
| `b8e4ce7` Añadir scripts de pruebas al repositorio | Los 7 scripts en `pruebas/` y la sección del README |

Antes de subir se comprobó:

- `git log --all --full-history -- .env` no devuelve nada: el `.env` nunca
  estuvo en el historial.
- `git ls-files` solo muestra `.env.example`, con el valor
  `REEMPLAZAR_CON_API_KEY_SEGURA`.
- La clave real no aparece en ninguna línea de los commits ni en ningún archivo
  del proyecto fuera del `.env`.
