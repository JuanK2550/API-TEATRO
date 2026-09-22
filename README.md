# API_TEATRO — Teatro Maldonado de Tunja

API REST para programar funciones y vender boletería en el Teatro Maldonado de
Tunja. Hecha con Node.js y Express, con datos en memoria y documentada con
OpenAPI 3.0.3.

## Objetivo y contexto

El teatro programa obras, conciertos, cine y actos institucionales en una sala
única, con localidades a distintas distancias del escenario. La API gestiona el
flujo completo, desde el catálogo de eventos hasta la validación de la boleta en
la puerta. El precio, el código y el estado de las boletas los calcula el
servidor. Es un trabajo académico, sin base de datos. El acceso a `/api` exige una
API Key.

## Recursos

| Recurso | Qué representa |
| ------- | -------------- |
| **Asistentes** | Personas que compran boletas. Documento y email únicos. |
| **Eventos** | Espectáculos: obra, concierto, cine o institucional. Pueden desactivarse. |
| **Localidades** | Zonas de la sala (Platea Preferencial, Platea General, Balcón). El `orden` indica la cercanía al escenario: 1 es la más cercana. |
| **Funciones** | Presentación de un evento en una fecha y hora, con tarifas por localidad, descuentos habilitados y estado. |
| **Boletas** | Venta de una butaca a un asistente para una función. El servidor calcula el precio, genera el código y controla el estado. |

## Relaciones

```
   ┌────────────┐
   │  EVENTOS   │
   └─────┬──────┘
         │ 1
         │
         │ N
   ┌─────┴──────┐        tarifas        ┌──────────────┐
   │  FUNCIONES │◄─────────────────────►│ LOCALIDADES  │
   └─────┬──────┘   (precio por zona)   └──────┬───────┘
         │ 1                                   │ 1
         │                                     │
         │ N                                   │ N
   ┌─────┴──────────────────────────────────────┴───────┐
   │                     BOLETAS                        │
   └────────────────────────┬───────────────────────────┘
                            │ N
                            │
                            │ 1
                     ┌──────┴───────┐
                     │  ASISTENTES  │
                     └──────────────┘
```

## Reglas de negocio

**Agenda**
- No puede haber dos funciones con la misma fecha y hora (sala única).
- Una función cancelada libera su franja.
- No se programan funciones con fecha pasada ni de eventos inactivos.

**Tarifas y precios**
- Cada función tiene tarifa para todas las localidades activas, sin duplicados.
- Cada localidad de las tarifas debe existir y estar activa.
- A menor `orden`, precio estrictamente mayor. Se comparan todos los pares de localidades.
- El precio de la boleta es la tarifa de su localidad menos el descuento, redondeado a entero.
- Descuentos: `ninguno` 0 %, `estudiante` 20 %, `infantil` 50 %, `adultoMayor` 30 %.
- El descuento aplicado debe estar habilitado en la función.

**Venta**
- La combinación función + localidad + fila + número es única.
- Una boleta cancelada libera su butaca.
- Solo se venden boletas de funciones `en_venta`.
- La butaca debe existir dentro de la localidad.
- No se supera el aforo de la localidad en una función.
- Máximo 6 boletas no canceladas por asistente y función.
- `documento` y `email` de asistente únicos; `codigo` y `orden` de localidad únicos.
- `capacidad` = `filas × butacasPorFila`, calculada por el servidor.

**Estados**

```
Funciones: programada → en_venta, cancelada
           en_venta   → agotada, en_curso, cancelada
           agotada    → en_curso, cancelada
           en_curso   → finalizada
Boletas:   reservada  → pagada, cancelada
           pagada     → usada, cancelada
```

- `finalizada`, `cancelada` y `usada` son estados terminales.
- Pasar una función a `en_venta` exige tarifas completas y coherentes.
- Una boleta solo pasa a `usada` si la función está `en_curso`.
- No se modifican funciones `en_curso`, `finalizada` ni `cancelada`.
- Solo se modifican boletas `reservada`; solo se eliminan `reservada` o `cancelada`.

## Integridad referencial

Ningún `DELETE` puede dejar registros huérfanos, igual que haría una base de
datos con `FOREIGN KEY ... ON DELETE RESTRICT`.

| Recurso | No se elimina si | Respuesta |
| ------- | ---------------- | --------- |
| Asistente | Tiene boletas | 409 |
| Evento | Tiene funciones | 409 |
| Localidad | Tiene boletas, o aparece en las tarifas de alguna función | 409 |
| Función | Tiene boletas | 409 |

Cada `DELETE` comprueba primero que el recurso exista (404), después sus
relaciones (409) y solo entonces borra (200). El id inválido lo rechaza antes
el validador con un 400.

**Una boleta cancelada sigue bloqueando el borrado.** Cancelar y eliminar no
son lo mismo: la cancelación libera la butaca para que se pueda revender, pero
la boleta permanece como registro histórico y sigue apuntando a su función, su
localidad y su asistente. Si se borrara cualquiera de los tres, esa referencia
quedaría rota. Por eso las comprobaciones de integridad cuentan **todas** las
boletas, sin mirar su estado, mientras que la regla de reventa de butacas sí
distingue las canceladas.

## Medidas de seguridad

| Medida | Implementación |
| ------ | -------------- |
| API Key | Cabecera `X-API-Key` obligatoria en todo `/api`; tres clientes, claves guardadas como hash SHA-256 |
| helmet | Cabeceras de seguridad en todas las respuestas |
| `x-powered-by` | Deshabilitado con `app.disable("x-powered-by")` |
| CORS | Origen único desde `ALLOWED_ORIGIN`; métodos GET, POST, PUT, PATCH, DELETE |
| Rate limiting | 100 peticiones cada 15 min por IP en `/api` (`RATE_LIMIT_MAX`) |
| Límite del cuerpo | `express.json({ limit: "10kb" })` |
| express-validator | Tipos, rangos, formatos y listas blancas en `tipo`, `clasificacionEdad`, `tipoDescuento` y estados; textos sin `<` ni `>` |
| Mass Assignment | Los controllers leen solo `matchedData`, nunca `req.body` |
| Campos del servidor | `precio`, `codigo` y `estado` de boletas; `estado` de funciones; `activo`, `activa` y `capacidad` |
| Manejo de errores | Mensajes genéricos `{ mensaje }`; el detalle solo se registra en consola |

**Autenticación por API Key.** Toda petición a `/api` debe llevar la cabecera
`X-API-Key` con la clave de un cliente registrado. La clave se lee solo de la
cabecera, nunca de la query string, porque las URLs quedan guardadas en
historiales, registros del servidor y proxies.

Hay tres clientes registrados en `src/data/apiKeys.js`:

| id | Cliente | Variable | Estado |
| -- | ------- | -------- | ------ |
| 1 | Postman Laboratorio | `API_KEY_POSTMAN` | Activa |
| 2 | Taquilla del Teatro | `API_KEY_TAQUILLA` | Activa |
| 3 | Aplicación Móvil | `API_KEY_MOVIL` | Deshabilitada |

Las claves **no se guardan en claro**. Al arrancar, el servidor calcula el hash
SHA-256 de cada una y solo conserva ese hash. En cada petición calcula el hash
de la clave recibida y lo compara con los registrados. La clave original nunca
se recupera ni hace falta recuperarla.

| Situación | Código | Mensaje |
| --------- | ------ | ------- |
| No envía la cabecera | 401 | API Key requerida |
| La clave no corresponde a ningún cliente | 401 | API Key inválida |
| La clave es de un cliente deshabilitado | 403 | API Key deshabilitada |
| La clave es de un cliente activo | 200 | La petición sigue su curso |

401 quiere decir que no se reconoce la clave. 403 quiere decir que se reconoce,
se sabe de qué cliente es, pero ese cliente no tiene permitido pasar.

Si la petición pasa, el middleware deja en `req.clienteApi` el `id` y el
`nombre` del cliente. `GET /api/seguridad/cliente` lo devuelve: la URL es la
misma para todos y la respuesta cambia según la clave enviada.

Un fallo de configuración impide que el servidor arranque. Si falta alguna de
las tres variables, `src/data/apiKeys.js` lanza "Faltan variables de entorno
para las API Keys" al cargarse y el proceso termina. El error aparece al
arrancar, no con la primera petición.

La comparación de hashes usa `crypto.timingSafeEqual` y no `===`. Una comparación normal
de cadenas se detiene en el primer carácter distinto, así que tarda un poco más
cuantos más caracteres iniciales acierte el atacante; midiendo esos tiempos se
puede deducir la clave carácter a carácter. `timingSafeEqual` compara siempre
todos los bytes, en tiempo constante. Antes se comprueba que ambas claves midan
lo mismo, porque esa función exige buffers del mismo tamaño.

Esto autentica al **cliente** que consume la API, no a una persona.

## Instalación y ejecución

Requisitos: Node.js 18 o superior (probado en 24.15.0) y npm.

```bash
npm install
cp .env.example .env
npm run dev     # desarrollo (nodemon)
npm start       # producción
```

Los comandos se ejecutan desde la raíz del proyecto. El servidor queda en
`http://localhost:3000`.

| Variable | Por defecto | Uso |
| -------- | ----------- | --- |
| `PORT` | `3000` | Puerto |
| `ALLOWED_ORIGIN` | `http://localhost:3000` | Origen permitido por CORS |
| `RATE_LIMIT_MAX` | `100` | Peticiones por ventana de 15 min |
| `API_KEY_POSTMAN` | sin valor | Clave del cliente Postman Laboratorio |
| `API_KEY_TAQUILLA` | sin valor | Clave del cliente Taquilla del Teatro |
| `API_KEY_MOVIL` | sin valor | Clave del cliente Aplicación Móvil (deshabilitado) |

`.env` está en `.gitignore`; `.env.example` es la plantilla y nunca lleva las
claves reales. Las tres son obligatorias: sin ellas el servidor no arranca.
Genera cada una con:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Para probar desde Swagger UI hay que pulsar **Authorize**, arriba a la derecha,
y pegar una de las claves activas. Sin ese paso todos los endpoints responden
401.

## Estructura

```
API_TEATRO/
├── .env.example
├── .gitignore
├── README.md
├── package.json
├── docs/entregas/                # informes de entrega en PDF
├── pruebas/                      # scripts de prueba contra el servidor
│   ├── pruebas.js
│   ├── pruebas-funciones.js
│   ├── pruebas-boletas.js
│   ├── pruebas-limites.js
│   ├── verificar-a.js
│   ├── verificar-b.js
│   └── verificar-c.js
└── src/
    ├── app.js
    ├── controllers/
    │   ├── asistentes.controller.js
    │   ├── boletas.controller.js
    │   ├── eventos.controller.js
    │   ├── funciones.controller.js
    │   └── localidades.controller.js
    ├── data/
    │   ├── asistentes.js
    │   ├── boletas.js
    │   ├── eventos.js
    │   ├── apiKeys.js
    │   ├── funciones.js
    │   └── localidades.js
    ├── docs/
    │   └── swagger.js
    ├── middlewares/
    │   ├── apiKey.middleware.js
    │   ├── asistentes.validator.js
    │   ├── boletas.validator.js
    │   ├── errores.middleware.js
    │   ├── eventos.validator.js
    │   ├── funciones.validator.js
    │   ├── localidades.validator.js
    │   └── validar.middleware.js
    ├── routes/
    │   ├── asistentes.routes.js
    │   ├── boletas.routes.js
    │   ├── eventos.routes.js
    │   ├── funciones.routes.js
    │   ├── localidades.routes.js
    │   └── seguridad.routes.js
    ├── services/
    │   ├── apiKeys.service.js
    │   ├── asistentes.service.js
    │   ├── boletas.service.js
    │   ├── eventos.service.js
    │   ├── funciones.service.js
    │   └── localidades.service.js
    └── utils/
        └── crypto.util.js            # generarHash y compararSeguro
```

Flujo: `routes → validadores → controllers → services → data`. Los controllers
no acceden a los datos; solo los services importan desde `src/data/`.

## Endpoints

39 endpoints en 19 rutas. Swagger UI: <http://localhost:3000/api-docs> ·
OpenAPI: <http://localhost:3000/openapi.json>

**Generales**

| Método | Ruta | Descripción |
| ------ | ---- | ----------- |
| GET | `/` | Estado de la API |
| GET | `/api-docs` | Swagger UI |
| GET | `/openapi.json` | Definición OpenAPI 3.0.3 |

**Asistentes**

| Método | Ruta | Descripción |
| ------ | ---- | ----------- |
| GET | `/api/asistentes` | Lista los asistentes |
| GET | `/api/asistentes/:id` | Obtiene un asistente |
| POST | `/api/asistentes` | Crea un asistente |
| PUT | `/api/asistentes/:id` | Reemplaza un asistente |
| PATCH | `/api/asistentes/:id` | Actualiza parcialmente un asistente |
| DELETE | `/api/asistentes/:id` | Elimina un asistente |

**Eventos**

| Método | Ruta | Descripción |
| ------ | ---- | ----------- |
| GET | `/api/eventos` | Lista los eventos |
| GET | `/api/eventos/:id` | Obtiene un evento |
| POST | `/api/eventos` | Crea un evento activo |
| PUT | `/api/eventos/:id` | Reemplaza un evento, conserva `activo` |
| PATCH | `/api/eventos/:id` | Actualiza parcialmente un evento |
| PATCH | `/api/eventos/:id/estado` | Activa o desactiva un evento |
| DELETE | `/api/eventos/:id` | Elimina un evento |

**Localidades**

| Método | Ruta | Descripción |
| ------ | ---- | ----------- |
| GET | `/api/localidades` | Lista las localidades |
| GET | `/api/localidades/:id` | Obtiene una localidad |
| POST | `/api/localidades` | Crea una localidad y calcula su capacidad |
| PUT | `/api/localidades/:id` | Reemplaza una localidad y recalcula su capacidad |
| PATCH | `/api/localidades/:id` | Actualiza parcialmente una localidad |
| PATCH | `/api/localidades/:id/estado` | Activa o desactiva una localidad |
| DELETE | `/api/localidades/:id` | Elimina una localidad |

**Funciones**

| Método | Ruta | Descripción |
| ------ | ---- | ----------- |
| GET | `/api/funciones` | Lista las funciones |
| GET | `/api/funciones/evento/:eventoId` | Funciones de un evento |
| GET | `/api/funciones/:id` | Obtiene una función |
| GET | `/api/funciones/:id/tarifas` | Tarifas ordenadas por cercanía y descuentos habilitados |
| POST | `/api/funciones` | Crea una función en estado `programada` |
| PUT | `/api/funciones/:id` | Reemplaza una función, conserva el estado |
| PATCH | `/api/funciones/:id` | Actualiza parcialmente una función |
| PATCH | `/api/funciones/:id/estado` | Cambia el estado de una función |
| DELETE | `/api/funciones/:id` | Elimina una función sin boletas vendidas |

**Boletas**

| Método | Ruta | Descripción |
| ------ | ---- | ----------- |
| GET | `/api/boletas` | Lista las boletas |
| GET | `/api/boletas/asistente/:asistenteId` | Boletas de un asistente |
| GET | `/api/boletas/funcion/:funcionId` | Boletas de una función |
| GET | `/api/boletas/:id` | Obtiene una boleta |
| POST | `/api/boletas` | Vende una boleta; el servidor calcula precio y código |
| PUT | `/api/boletas/:id` | Reemplaza una boleta reservada y recalcula el precio |
| PATCH | `/api/boletas/:id` | Actualiza parcialmente una boleta reservada |
| PATCH | `/api/boletas/:id/estado` | Cambia el estado de una boleta |
| DELETE | `/api/boletas/:id` | Elimina una boleta reservada o cancelada |

**Seguridad**

| Método | Ruta | Descripción |
| ------ | ---- | ----------- |
| GET | `/api/seguridad/cliente` | Devuelve el cliente dueño de la API Key enviada |

## Análisis de seguridad

Las evidencias y capturas de cada prueba están en el informe PDF entregado.

| Técnica | Herramienta | Alcance | Resultado |
| ------- | ----------- | ------- | --------- |
| SCA | `npm audit` | 143 paquetes | 0 vulnerabilidades |
| SAST | Semgrep 1.172.0 | 73 reglas, 30 archivos | 0 hallazgos |
| SAST manual | Revisión de código | `src/` completo | 2 hallazgos, corregidos |
| DAST | OWASP ZAP 2.17.0 | 39 URLs, Active Scan sobre `/api` | 2 alertas, ambas falsos positivos |

**SCA.** Sin vulnerabilidades. `npm audit fix` no modificó el
`package-lock.json`. Aviso de obsolescencia, sin vulnerabilidad asociada, en
`glob@11.1.0` (dependencia transitiva de `swagger-jsdoc`).

**SAST.** Semgrep con `p/javascript`, `p/nodejs` y `p/owasp-top-ten`. La revisión
manual comprobó el uso de `req.body`, concatenaciones de entrada, secretos, fugas
en errores y endpoints sin validación. Un barrido de 419 peticiones hostiles no
produjo ningún 5xx ni fuga de stack trace.

**DAST.** Escaneo del 16/09/2026 importando `openapi.json`, con
`RATE_LIMIT_MAX=100000` solo durante el escaneo. 41 % de respuestas 2xx, 58 %
4xx y ningún 5xx. La regla DOM XSS no se ejecutó porque no aplica a una API que
devuelve JSON.

### Hallazgos

| ID | Hallazgo | Corrección | Verificación |
| -- | -------- | ---------- | ------------ |
| SEC-01 | Un cuerpo mayor de 10 kb devolvía 500 en vez de 413 | `manejarError` respeta el código 4xx de los errores de `express.json` (413, 400, 415) con mensaje fijo | 12 kb → 413; JSON mal formado → 400 |
| SAST-01 | `nombre`, `titulo` y `descripcion` aceptaban HTML | Validación `.matches(/^[^<>]*$/)` en los campos de texto libre | `<img src=x onerror=...>` → 400; nombres con tildes y apóstrofos → 201 |
| SAST-02 | Las peticiones rechazadas se registraban como `Error no controlado` | Errores 4xx con `console.warn` (código, método y ruta); 5xx con `console.error` | Barrido repetido: 0 errores, 45 avisos |
| DAST-01 | Path Traversal (High, confianza Low) en `PUT /api/eventos/{id}` | Falso positivo: la diferencia de respuesta viene de la validación; la API no accede al sistema de archivos | `../../../../etc/passwd` → 400 |
| DAST-02 | User Agent Fuzzer (Informational) en `POST /api/eventos` | Falso positivo: cada POST crea un id distinto | GET con 3 User-Agent → mismo cuerpo |

### Pruebas automatizadas

| Suite | Comprobaciones |
| ----- | -------------- |
| Asistentes, eventos y localidades | 57 |
| Funciones | 52 |
| Boletas | 55 |
| Límites de venta y regresión | 22 |
| Checklist de seguridad (35 casos) | 38 |
| **Total** | **224, 0 fallos** |

## Pruebas

Los scripts de `pruebas/` lanzan peticiones reales contra el servidor y
comparan el código de respuesta y el cuerpo con lo esperado. No usan ninguna
librería de test: son scripts de Node con `fetch`.

| Script | Qué cubre | Comprobaciones |
| ------ | --------- | -------------- |
| `pruebas.js` | CRUD de asistentes, eventos y localidades: validaciones, unicidad, estados y campos calculados | 57 |
| `pruebas-funciones.js` | Funciones: las ocho reglas de negocio, el cuadro de tarifas y la máquina de estados | 52 |
| `pruebas-boletas.js` | Boletas: precio y código calculados por el servidor, butaca única, descuentos y estados | 55 |
| `pruebas-limites.js` | Aforo, límite de 6 boletas por asistente y borrado protegido de funciones | 22 |
| `verificar-a.js` | Casos 1 a 16 del checklist: validación de entrada y Mass Assignment | 16 |
| `verificar-b.js` | Casos 17 a 31: reglas de negocio e integridad | 16 |
| `verificar-c.js` | Casos 32 a 35: cuerpo grande, límite de peticiones, cabeceras y error interno sin stack | 6 |

### Cómo ejecutarlos

Con el `.env` configurado y el servidor en marcha en otra terminal:

```bash
npm run dev                    # terminal 1
node pruebas/pruebas.js        # terminal 2
```

Cada script carga el `.env` con dotenv y envía la cabecera `X-API-Key` en todas
sus peticiones: la clave nunca está escrita en el código.

Dos avisos:

- Los datos están en memoria y las pruebas crean y borran registros, así que
  **el servidor se reinicia antes de cada script** para partir de los datos
  semilla.
- Salvo `verificar-c.js`, los scripts superan las 100 peticiones por ventana y
  chocan con el límite. Se lanzan con el límite subido:

```bash
RATE_LIMIT_MAX=100000 npm run dev
```

`verificar-c.js` es la excepción: comprueba precisamente que el límite salte, y
necesita el valor normal.

## Limitaciones conocidas

- Sin persistencia: los datos se reinician con el servidor.
- Autenticación de cliente con API Key, pero sin autenticación de usuario:
  se sabe qué aplicación hace la petición, no qué persona la usa. No hay
  cuentas, ni roles, ni permisos: un cliente activo puede hacer todo.
- Los clientes están en memoria. Deshabilitar o añadir uno exige editar
  `src/data/apiKeys.js` y reiniciar; no hay endpoint para gestionarlos.
- Sin HTTPS: `Strict-Transport-Security` solo tiene efecto sobre TLS.
- Concurrencia: Node procesa las peticiones en un solo hilo y las operaciones
  sobre los arrays son síncronas. Con una base de datos haría falta una
  transacción o un índice único para asignar butacas.

## Documentación de entregas

- [Pruebas SCA + SAST + DAST y levantamiento de la API](docs/entregas/LEVANTAMIENTO%20DE%20LA%20API%20MAS%20PRUEBAS.pdf)
- [Laboratorio 5: integridad referencial y API Keys](docs/entregas/Integridad%20referencial%20%2B%20API%20Keys.pdf)

## Integrantes

- Juan Sebastián Bonilla León
- Juan Camilo Calderón Delgado
- Silvana Sofia Siza Soriano
- Cristian Emanuel Hernández Araque
- Cristian Rodrigo Amaya Torres
