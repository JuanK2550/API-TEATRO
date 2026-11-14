# API_TEATRO — Teatro Maldonado de Tunja

API REST para programar funciones y vender boletería en el Teatro Maldonado de
Tunja. Hecha con Node.js y Express, con los datos en PostgreSQL sobre Supabase
y documentada con OpenAPI 3.0.3.

## Objetivo y contexto

El teatro programa obras, conciertos, cine y actos institucionales en una sala
única, con localidades a distintas distancias del escenario. La API gestiona el
flujo completo, desde el catálogo de eventos hasta la validación de la boleta en
la puerta. El precio, el código y el estado de las boletas los calcula el
servidor. Es un trabajo académico; los datos viven en una base PostgreSQL
alojada en Supabase. El acceso a `/api` va por capas: la cartelera se lee sin
credenciales, lo que pertenece a alguien exige un JWT, y la API Key se quedó
donde todavía significa algo, las integraciones que no corren en un navegador.

Tiene una sola interfaz, una SPA en React: la cartelera pública, abierta a
cualquiera, y detrás del inicio de sesión un panel para cada rol —el
administrador, la taquilla y el propio asistente—.

## Cómo se construyó · recorrido por los bloques

El proyecto creció por laboratorios, y cada uno dejó algo en pie. La tabla dice
qué añadió cada bloque y en qué archivos vive hoy, para poder ir del enunciado
al código sin buscar.

| Bloque | Qué añadió | Dónde vive |
| ------ | ---------- | ---------- |
| Base (fases 1 a 9) | Los cinco recursos, las reglas de negocio, las máquinas de estado y la documentación OpenAPI | [`src/routes/`](src/routes/), [`src/services/`](src/services/), [`src/docs/swagger.js`](src/docs/swagger.js) |
| Lab. 5 · Integridad referencial y API Key | Relaciones que no se rompen y la primera credencial: `X-API-Key` | [`apiKey.middleware.js`](src/middlewares/apiKey.middleware.js) |
| Lab. 6 · Múltiples clientes | Varios clientes registrados y las claves guardadas como hash SHA-256, nunca en claro | [`src/data/apiKeys.js`](src/data/apiKeys.js), [`crypto.util.js`](src/utils/crypto.util.js) |
| Lab. 7 · Usuarios, hashing y salting | Cuentas con contraseña bajo bcrypt, cost 12 y sal por contraseña | [`password.util.js`](src/utils/password.util.js), [`usuarios.service.js`](src/services/usuarios.service.js) |
| Lab. 8 · Control del rol | El rol lo asigna el servidor; el administrador inicial se siembra desde el entorno | [`usuarios.controller.js`](src/controllers/usuarios.controller.js) |
| Lab. 9 · Sesión con JWT | Token HS256 con caducidad y algoritmo fijo al firmar y al verificar | [`jwt.util.js`](src/utils/jwt.util.js), [`auth.middleware.js`](src/middlewares/auth.middleware.js) |
| La Sala · frontend | La primera interfaz, sin framework: cartelera, plano de butacas y compra. **Retirada en el módulo final**: lo que aportaba pasó al panel | Ya no existe; la historia está en [`informe-frontend.md`](docs/seguridad/informe-frontend.md) |
| Lab. 10 · Autorización | RBAC con `autorizarRoles` y las guardas de propiedad que cierran el IDOR/BOLA | [`roles.middleware.js`](src/middlewares/roles.middleware.js), [`propiedad.middleware.js`](src/middlewares/propiedad.middleware.js) |
| Bloque 7 · Persistencia | PostgreSQL en Supabase con TLS verificado, rol de privilegio mínimo y RLS en todas las tablas | [`database/`](database/), [`src/config/database.js`](src/config/database.js) |
| Bloque 8 · Validación integral | El bootstrap del administrador separado del arranque y la tanda completa de pruebas | [`scripts/`](scripts/), [`pruebas/`](pruebas/) |
| Bloque 11 · Recuperación y credenciales | Versión de sesión para revocar tokens, recuperación administrativa, códigos de respaldo y el reparto de credenciales que saca la API Key del navegador | [`recuperacion.service.js`](src/services/recuperacion.service.js), [`codigosRecuperacion.service.js`](src/services/codigosRecuperacion.service.js), [`publico.middleware.js`](src/middlewares/publico.middleware.js) |
| Módulo final · Interfaz en React | Una SPA en React + Vite + Bootstrap, la única interfaz: cartelera pública, registro, plano de butacas, un panel por rol, la gestión de cuentas y la recuperación de acceso desde el navegador | [`teatro-frontend/`](teatro-frontend/), [`estadisticas.service.js`](src/services/estadisticas.service.js), [`usuarios.service.js`](src/services/usuarios.service.js) |

Cada bloque tiene su informe escrito en [`docs/seguridad/`](docs/seguridad/) y
su PDF de entrega en [`docs/entregas/`](docs/entregas/).

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
| API Key | Cabecera `X-API-Key` en las rutas de integración; cuatro clientes registrados, claves guardadas como hash SHA-256 |
| Contraseñas | Usuarios con bcrypt, cost 12 y sal por contraseña; nunca se guardan ni se devuelven en claro |
| JWT | Token firmado con HS256 y caducidad; algoritmo fijo al firmar y al verificar |
| Autorización por rol | `autorizarRoles` en 36 endpoints: 401 sin sesión, 403 si el rol no corresponde |
| Propiedad del dato | Tres guardas en `propiedad.middleware.js`: un asistente solo ve y toca lo suyo |
| Revocación de sesión | `version_sesion` en el token y en la base: cambiar la contraseña invalida todos los tokens anteriores |
| Recuperación de acceso | Token administrativo de 15 minutos y ocho códigos de respaldo, los dos de un solo uso y guardados como hash SHA-256 |
| Catálogo público | Las nueve lecturas de cartelera no piden credenciales, no muestran datos de nadie y ocultan lo inactivo |
| Persistencia | PostgreSQL en Supabase, con TLS y certificado verificado; las reglas críticas también como restricciones de la base |
| Privilegio mínimo en la base | La API se conecta con `api_teatro`: sin superusuario, sin `BYPASSRLS` y sin poder crear ni borrar tablas |
| Row Level Security | Activo en las once tablas, con once políticas solo para el rol de la aplicación: cualquier otro rol ve cero filas |
| Salvaguarda de la base | `preparar-base.js` compara una huella del host y del usuario antes de abrir la conexión; si no es la del teatro, aborta sin ejecutar nada |
| helmet | Cabeceras de seguridad en todas las respuestas |
| `x-powered-by` | Deshabilitado con `app.disable("x-powered-by")` |
| CORS | Lista de orígenes desde `ALLOWED_ORIGIN`, separados por comas; métodos GET, POST, PUT, PATCH, DELETE |
| Rate limiting | Tres límites por IP cada 15 min: 100 en todo `/api` (`RATE_LIMIT_MAX`), 10 en login y registro (`RATE_LIMIT_ACCESO_MAX`) y 10 en las rutas de recuperación (`RATE_LIMIT_RECUPERACION_MAX`) |
| Límite del cuerpo | `express.json({ limit: "10kb" })` |
| Carácter nulo | `rechazarCaracterNulo` responde 400 ante un `\u0000` en el cuerpo, la consulta o la ruta, antes de que llegue a PostgreSQL |
| express-validator | Tipos, rangos, formatos y listas blancas en `tipo`, `clasificacionEdad`, `tipoDescuento` y estados; textos sin `<` ni `>` |
| Mass Assignment | Los controllers leen solo `matchedData`, nunca `req.body` |
| Campos del servidor | `precio`, `codigo` y `estado` de boletas; `estado` de funciones; `activo` de eventos; `activa` y `capacidad` de localidades; `rol`, `activo` y `version_sesion` de usuarios |
| Manejo de errores | Mensajes genéricos `{ mensaje }`; el detalle solo se registra en consola |

**Autenticación por API Key.** Hasta el bloque 11 la cabecera `X-API-Key` era
obligatoria en todo `/api`. Hoy la exigen solo las rutas de integración, las que
no tienen detrás a una persona con sesión; el reparto completo está en
[Qué credencial pide cada ruta](#qué-credencial-pide-cada-ruta). Donde se exige,
la clave se lee solo de la cabecera, nunca de la query string, porque las URLs
quedan guardadas en historiales, registros del servidor y proxies.

Hay cuatro clientes registrados en `src/data/apiKeys.js`, dos de ellos activos:

| id | Cliente | Variable | Estado |
| -- | ------- | -------- | ------ |
| 1 | Postman Laboratorio | `API_KEY_POSTMAN` | Activa |
| 2 | Taquilla del Teatro | `API_KEY_TAQUILLA` | Activa |
| 3 | Aplicación Móvil | `API_KEY_MOVIL` | Deshabilitada |
| 4 | Aplicación Web | `API_KEY_WEB` | **Desactivada** desde el bloque 11 |

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

Esto autentica al **cliente** que consume la API, no a una persona. Quién es la
persona lo dice el apartado siguiente.

### Autenticación de usuarios

`POST /api/auth/registro` crea un usuario y `POST /api/auth/login` comprueba sus
credenciales. Las dos rutas están bajo `/api`, así que además exigen la API Key:
la clave dice qué aplicación pide y el correo con la contraseña dicen qué
persona.

Roles: `administrador`, `taquilla` y `asistente`.

**El rol lo asigna el servidor.** El registro solo acepta `nombre`, `email` y
`password`, los tres obligatorios. `rol` no forma parte del contrato: todo
usuario creado por el registro público nace como `asistente`, el rol con menos
privilegios. Si la petición envía `"rol": "administrador"`, la respuesta sigue
siendo 201 y el usuario queda como `asistente`.

No responde 400 porque la entrada se filtra por lista blanca: `matchedData`
conserva solo los campos declarados en el validador y descarta el resto sin
discutir. Una lista negra tendría que ir nombrando cada campo peligroso uno por
uno, y siempre se queda corta; la lista blanca también frena los campos que
todavía no existen. Por eso un `"permisos": ["DELETE_ALL", "ADMIN"]` se cae solo,
sin que nadie lo hubiera previsto. Mandar un campo no da derecho a controlarlo.

Además el service no copia lo que llega: arma el usuario campo por campo y fija
`rol` y `activo` por su cuenta. Son dos capas independientes, y cada una basta
por sí sola.

**La contraseña nunca se guarda.** Se guarda su hash, calculado con bcrypt y
cost 12. bcrypt genera una **sal distinta para cada contraseña** y la incluye
dentro del hash, así que no hace falta guardarla aparte. Dos usuarios con la
misma contraseña quedan con hashes distintos:

```
$2b$12$<sal A, 22 caracteres><resultado A>
$2b$12$<sal B, 22 caracteres><resultado B>
```

`$2b$` es la variante de bcrypt, `12$` el cost y lo que sigue son la sal y el
resultado. Un cost alto hace cada comprobación deliberadamente lenta, que es lo
que encarece probar contraseñas en masa. Por eso se usa bcrypt y no SHA-256:
las API Keys son aleatorias, pero una contraseña escrita por una persona se
adivina probando.

**Ni la contraseña ni su hash salen nunca en una respuesta.** Los controllers
arman la respuesta campo por campo: `id`, `nombre`, `email`, `rol` y, en el
registro, `activo`.

| Situación | Código | Mensaje |
| --------- | ------ | ------- |
| Registro correcto | 201 | Usuario registrado correctamente |
| El correo ya está registrado | 409 | Ya existe un usuario con ese correo electrónico |
| Login correcto | 200 | Autenticación correcta |
| Correo desconocido **o** contraseña incorrecta | 401 | Credenciales inválidas |
| Usuario deshabilitado | 403 | Usuario deshabilitado |

El 401 **no distingue** si falló el correo o la contraseña, a propósito. Con un
mensaje del tipo "ese usuario no existe", cualquiera podría averiguar qué
correos están registrados probándolos uno por uno, y esa lista ya es
información útil para un atacante.

### Sesión con JWT

El login, además del usuario, devuelve un **token JWT** en el campo `token`.
Ese token se manda en las siguientes peticiones en la cabecera
`Authorization: Bearer <token>`, y es lo que identifica a la persona.

**Qué lleva el token**: `sub` con el id del usuario, `email`, `rol`, `vs` con la
versión de sesión, `iat` (cuándo se emitió) y `exp` (cuándo caduca). **Qué no
lleva**: la contraseña ni su hash, ni ningún otro dato del usuario.

Se firma con **HS256**, fijado en el código al firmar y al verificar. Al
verificar solo se acepta ese algoritmo, en lugar de fiarse del que anuncia el
propio token: un token que llegue diciendo `"alg": "none"` se rechaza.

**Firmar no es cifrar.** El contenido del token va en base64, así que cualquiera
que lo tenga puede leerlo; de hecho `jwt.decode` lo lee sin la clave. Lo que
impide la firma es **modificarlo**: si alguien cambia el rol dentro del payload,
la firma deja de cuadrar y la API responde 401. Por eso en el token no va nada
que deba permanecer secreto, y por eso nunca se decide nada con `decode`, solo
con `verify`.

Las credenciales del proyecto, cada una en su sitio:

| Credencial | Qué responde | Dónde viaja |
| ---------- | ------------ | ----------- |
| `X-API-Key` | Qué aplicación consume la API | Cabecera, en las rutas de integración |
| email + contraseña | Quién dice ser la persona | Cuerpo de `POST /api/auth/login` |
| JWT | Sesión temporal de esa persona | Cabecera `Authorization: Bearer` |
| `rol` dentro del token | Base de la autorización que vendrá | Dentro del JWT |

`GET /api/auth/perfil` devuelve quién es el usuario y, si la petición llevaba
clave, qué cliente la hizo. Hasta el bloque 11 exigía **las dos credenciales a
la vez**; ahora basta el JWT, porque es lo que identifica a la persona, y
`clienteApi` aparece solo cuando hay clave que informar. Siguen siendo
independientes: el mismo token usado desde dos aplicaciones distintas devuelve
el mismo `usuario` y distinto `clienteApi`.

| Situación | Código | Mensaje |
| --------- | ------ | ------- |
| Sin cabecera `Authorization` | 401 | Token de autenticación requerido |
| Sin `Bearer` delante, u otro esquema | 401 | Formato de token inválido |
| Token caducado | 401 | Token expirado |
| Firma incorrecta, payload alterado o `alg: none` | 401 | Token inválido |

### Revocar una sesión · la versión de sesión

Un JWT es válido porque la firma cuadra, no porque el servidor lo recuerde. Esa
es su ventaja —no hace falta guardar sesiones— y también su problema: hasta el
bloque 11 un token robado servía hasta su `exp`, aunque la víctima cambiara la
contraseña. Cambiarla cerraba la puerta de entrada y dejaba las llaves repartidas.

La solución es un contador. Cada usuario tiene `version_sesion` en la base, que
empieza en cero y **solo sube**. El token se emite con ese valor en el claim
`vs`, y en cada petición autenticada `auth.middleware.js` consulta el usuario y
compara:

| Comprobación | Si falla |
| ------------ | -------- |
| El usuario existe y sigue activo | 401 · Cuenta no disponible |
| `vs` del token = `version_sesion` de la base | 401 · Sesión revocada |

Tres operaciones suben el contador, y las tres significan lo mismo: «esta
contraseña ya no es la de antes».

- `PATCH /api/auth/cambiar-password`, el propio usuario.
- `POST /api/auth/restablecer-password`, con un token de recuperación.
- `POST /api/auth/restablecer-con-codigo`, con un código de respaldo.

El efecto es inmediato y alcanza a **todos** los tokens anteriores, también al
de la terminal donde se hizo el cambio. No hay lista de tokens revocados que
mantener: basta un entero por usuario.

El precio es una consulta por petición autenticada, que es exactamente lo que un
JWT prometía evitar. Se paga a propósito: un token que no se puede revocar no es
una sesión, es una llave sin cerradura. Y de la misma consulta sale el **rol
actual**, no el que se copió en el token al emitirlo, así que degradar a un
usuario también surte efecto en la siguiente petición.

### Recuperar el acceso cuando no hay contraseña

Quien olvida la contraseña no puede entrar, y sin entrar no puede cambiarla. Hay
dos caminos, y ninguno manda nada por correo: el proyecto no tiene servidor de
correo, y fingir que lo tiene sería inventar la mitad del mecanismo.

**1 · Recuperación administrativa.** Un administrador emite un token para una
cuenta con `POST /api/auth/recuperacion/:usuarioId`, y lo entrega por el canal
que corresponda. El token:

- vive **15 minutos**;
- sirve **una sola vez**, y el segundo intento responde 400;
- se guarda como **hash SHA-256**, así que la tabla no contiene nada reutilizable;
- queda registrado con quién lo emitió, y ese rastro no se borra si luego se
  elimina al administrador.

Con él, `POST /api/auth/restablecer-password` fija la contraseña nueva y sube la
versión de sesión.

**2 · Códigos de respaldo.** `POST /api/auth/codigos-recuperacion` genera un lote
de **ocho** códigos de un solo uso, que se devuelven **una única vez**: después
solo quedan sus hashes. `POST /api/auth/restablecer-con-codigo` canjea uno por
una contraseña nueva, y gastar uno deja los otros siete en pie.
`GET /api/auth/codigos-recuperacion/estado` dice cuántos quedan sin revelarlos, y
`/regenerar` emite un lote nuevo invalidando el anterior por completo.

Las dos tablas nuevas, `password_reset_tokens` y `codigos_recuperacion`, se
crearon con el mismo criterio que el resto: RLS activo, privilegios revocados a
los roles públicos y una política solo para `api_teatro`. Las rutas llevan su
propio límite de peticiones, `RATE_LIMIT_RECUPERACION_MAX`, de diez intentos por
ventana. No es lo que impide adivinar un código —cada uno son 128 bits, ocho
grupos de cuatro caracteres hexadecimales, y el token administrativo 256— sino
una defensa más: frena el ruido y el abuso de unas rutas que no piden sesión.

### Autorización: roles y permisos

El token dice quién es la persona y qué rol tiene. La autorización decide qué
puede hacer con él, y son **dos preguntas distintas**:

1. **¿Puede tu rol hacer esta operación?** La responde `autorizarRoles`.
2. **¿Puedes hacerla sobre este registro?** La responden las guardas de
   propiedad de `src/middlewares/propiedad.middleware.js`.

Pasar solo la primera es el agujero que la OWASP llama **BOLA**: un asistente
tiene permiso para leer boletas, pero no las de otra persona.

El orden de cada ruta protegida es siempre el mismo, y no es intercambiable:

```
autenticarJWT -> autorizarRoles -> validadores -> validar -> guarda de propiedad -> controller
```

`autenticarJWT` va primero porque es quien deja `req.usuario`: al revés, el
control de rol se ejecuta sin saber quién pregunta y devuelve 401 donde debía
devolver 403. Y la guarda de propiedad va después de `validar` porque lee el
cuerpo con `matchedData`, que solo tiene contenido cuando la validación corrió.

| Código | Significa |
| ------ | --------- |
| 401 | No sé quién eres. Falta el token, es inválido, está revocado, o la API Key es incorrecta |
| 403 | Sé quién eres y esto no te corresponde |

#### Quién puede hacer qué

Son 60 endpoints en 37 rutas: 46 exigen sesión, 13 son públicos y 1 pide
solo la API Key.

| Método | Ruta | Quién |
| ------ | ---- | ----- |
| GET | `/api/eventos`, `/api/localidades`, `/api/funciones` y sus consultas | **público** |
| POST, PUT, PATCH, DELETE | eventos, localidades y funciones | administrador |
| GET | `/api/asistentes`, `/api/asistentes/:id` | administrador, taquilla |
| POST | `/api/asistentes` | administrador, taquilla |
| PUT, PATCH, DELETE | `/api/asistentes/:id` | administrador |
| GET, POST, PATCH | `/api/asistentes/mio` | asistente |
| GET | `/api/boletas` | administrador |
| GET | `/api/boletas/mias` | asistente |
| GET | `/api/boletas/asistente/:asistenteId` | administrador, taquilla, asistente **si es el suyo** |
| GET | `/api/boletas/funcion/:funcionId` | administrador, taquilla |
| GET | `/api/boletas/:id` | administrador, taquilla, asistente **si es suya** |
| POST | `/api/boletas` | administrador, taquilla, asistente |
| PUT, PATCH | `/api/boletas/:id` | administrador, taquilla |
| PATCH | `/api/boletas/:id/estado` | administrador, taquilla, asistente **si es suya** |
| DELETE | `/api/boletas/:id` | administrador |
| GET, POST | `/api/usuarios`, `/api/usuarios/busqueda-recuperacion` | administrador |
| PUT, PATCH | `/api/usuarios/:id`, `/api/usuarios/:id/estado` | administrador |
| GET | `/api/estadisticas/resumen` | administrador |
| POST | `/api/auth/registro`, `/api/auth/login` | público |
| POST | `/api/auth/restablecer-password`, `/api/auth/restablecer-con-codigo` | público: los protege su secreto de un solo uso |
| GET | `/api/auth/perfil` | cualquier sesión |

**La cartelera sigue pública** a propósito: un teatro publica su programación.
Pedir sesión para consultar un cartel no añadiría seguridad, solo estorbaría.

#### El asistente solo ve y toca lo suyo

Las tres guardas comparten una sola pieza, y es lo que de verdad cierra el
IDOR:

```js
const asistenteDelToken = (req) =>
  asistentesService.buscarAsistentePorUsuario(req.usuario.id);
```

El asistente propio se resuelve **desde `req.usuario.id`**, que lo puso
`autenticarJWT` al verificar la firma. Nunca desde el cuerpo, la dirección o
una cabecera: el id del token viene firmado por el servidor y cualquier otro id
lo escribe el cliente.

| Guarda | Ruta | Qué decide |
| ------ | ---- | ---------- |
| `autorizarAsistentePropio` | `GET /api/boletas/asistente/:asistenteId` | El asistente solo si el id es el suyo |
| `autorizarAccesoBoleta` | `GET /api/boletas/:id` | El asistente solo si la boleta es suya |
| `autorizarCambioEstadoBoleta` | `PATCH /api/boletas/:id/estado` | Igual, y limita al dueño a `pagada` y `cancelada` |

Además, **`POST /api/boletas` ignora el `asistenteId` del cuerpo cuando compra
un asistente**: la boleta sale a nombre del asistente de su cuenta. Sin esto,
cambiar un número bastaría para emitir una boleta a nombre de otra persona y
gastarle su límite de seis. La taquilla y la administración sí lo indican,
porque venden para quien tienen delante.

Un asistente pidiendo un `asistenteId` que no existe recibe **403, no 404**. Si
el código dependiera de que el id existiera, la diferencia entre las dos
respuestas diría cuántos asistentes hay registrados.

#### Estados de una boleta, por rol

| Estado | Quién lo puede pedir |
| ------ | -------------------- |
| `pagada` | el dueño, taquilla, administrador |
| `cancelada` | el dueño, taquilla, administrador |
| `usada` | taquilla, administrador |

Pagar y cancelar son del dueño: el pago lo hace quien compra y la cancelación
es un derecho de quien compró. Marcar `usada` no, porque eso ocurre cuando el
público entra a la sala y lo hace quien revisa en la puerta.

**El permiso no deroga la máquina de estados.** Que la taquilla pueda pedir
`usada` no significa que pueda: sigue haciendo falta que la función esté
`en_curso`, y si no lo está recibe 409, no 403. Son dos controles distintos y
se distinguen en el código de respuesta.

### El administrador inicial

Crear administradores es una operación administrativa, y las operaciones
administrativas exigen un administrador. Con la base de datos vacía no hay
ninguno. El registro público no sirve, porque fuerza el rol `asistente`, y
abrirle una excepción —"si no hay usuarios, el primero es administrador"—
sería regalar el sistema a quien llegue primero.

Se rompe **sembrando** el primer administrador desde el entorno. Las variables
van en el `.env`:

| Variable | Para qué |
| -------- | -------- |
| `ADMIN_NOMBRE` | Nombre de la cuenta sembrada |
| `ADMIN_EMAIL` | Correo con el que entra |
| `ADMIN_PASSWORD` | Su contraseña |

`crearAdministradorInicial()` corre **antes** de `app.listen`. Si la cuenta ya
existe la devuelve sin tocarla, así que reiniciar no duplica nada ni reescribe
la contraseña. Si faltan las variables, avisa y el servidor arranca igual.

La contraseña **vive solo en el `.env`**, que está en `.gitignore`. En
`.env.example` va el marcador `REEMPLAZAR_CON_PASSWORD_SEGURO`. Y **no se
imprime**: el log dice `Administrador inicial creado` y nada más. Un registro
con la contraseña del administrador es tan grave como escribirla en el código,
porque los registros se copian, se comparten para pedir ayuda y se suben a
sistemas de monitoreo.

### Gestión de usuarios · `POST /api/usuarios`

Reservada al rol **administrador**. Es el único camino por el que se otorgan
los roles `taquilla` y `administrador`: el registro público crea siempre
asistentes.

```json
{
  "nombre": "Taquilla Teatro",
  "email": "taquilla@teatro.com",
  "password": "ClaveSegura2026!",
  "rol": "taquilla"
}
```

| Situación | Código | Mensaje |
| --------- | ------ | ------- |
| Usuario creado | 201 | Usuario creado correctamente |
| Rol fuera de la lista blanca | 400 | Datos de entrada inválidos |
| Sin token, o token inválido | 401 | Token de autenticación requerido |
| El rol no es administrador | 403 | No tiene permisos para realizar esta operación |
| El correo ya está registrado | 409 | Ya existe un usuario con ese correo electrónico |

El `rol` llega en el cuerpo pero pasa por una **lista blanca de dos valores**,
`["taquilla", "administrador"]`. Cualquier otro es 400, incluidos `asistente`
—que se obtiene registrándose— y `superadmin`, que no existe.

`crearUsuarioAdministrativo()` va **aparte** de `crearUsuario()`, y no es la
misma función con el rol opcional. Si lo fuera, el día que alguien la llamara
desde una ruta nueva sin limpiar el cuerpo, el rol del cliente entraría: un
olvido se convertiría en una escalada de privilegios. Separadas, el registro
público **no tiene** forma de asignar un rol.

`id`, `activo` y `passwordHash` no se declaran en el validador, así que
`matchedData` los descarta, y el service arma el usuario campo por campo.

### El `usuarioId` solo lo asigna el administrador

El vínculo entre una cuenta y un asistente es el campo `usuarioId`. Lo puede
enviar **solo el administrador**, en `POST /api/asistentes`, `PUT` y `PATCH`.

| Situación | Código |
| --------- | ------ |
| Un rol distinto de administrador lo envía | 403 |
| El usuario no existe | 400 |
| La cuenta no tiene el rol `asistente` | 409 |
| La cuenta ya está asociada a otro asistente | 409 |

**El 403 va antes del 400 y del 409.** Si se comprobara primero si el usuario
existe, la taquilla podría enumerar ids probándolos uno por uno: el 400 ("no
existe") y el 409 ("ya está asociado") son respuestas distintas entre sí, y
esa diferencia ya es información. Primero se decide si el rol puede preguntar.

Y el campo **da 403 en vez de ignorarse en silencio**, al contrario que el
`rol` del registro. No es una contradicción: el `rol` no es parte del contrato
del registro y no se declara, mientras que el `usuarioId` **sí** es un campo
legítimo para el administrador. Descartarlo callando devolvería 201 mintiendo,
diciendo "asistente creado correctamente" sin haber hecho el vínculo que se
pidió. La regla: un campo que nadie puede fijar no se declara; un campo que
solo algunos pueden fijar se declara y se controla por rol.

`PATCH /api/asistentes/mio` deja que un asistente edite su propio perfil **sin
id en la dirección**: la identidad sale del token, así que no hay ningún número
que cambiar para editar a otra persona. Por esa ruta el `usuarioId` también da
403, porque enviarlo sería intentar ligarse a otra cuenta.

## Persistencia · PostgreSQL en Supabase

Hasta el bloque 7 los datos vivían en arreglos de `src/data/`, así que reiniciar
Node devolvía todo a la semilla. Hoy viven en **once tablas** normalizadas de
PostgreSQL: `roles`, `usuarios`, `asistentes`, `eventos`, `localidades`,
`funciones`, `funcion_tarifas`, `funcion_descuentos`, `boletas`,
`password_reset_tokens` y `codigos_recuperacion`. El contrato de la API no
cambió al migrar, y el frontend no necesitó un solo ajuste.

**Sin ORM.** Los services escriben SQL y son los únicos que consultan la base,
siempre con consultas parametrizadas y a través del pool de
[`src/config/database.js`](src/config/database.js). Los identificadores los
genera la base con `GENERATED ALWAYS AS IDENTITY`, no el código.

**TLS verificado.** El pool conecta con `rejectUnauthorized: true` contra el
certificado de `certs/`, que no se versiona. Verificar el certificado es lo que
distingue cifrar de cifrar *con quien se cree*: sin esa comprobación, un
intermediario puede presentar el suyo.

**Dos credenciales, y la diferencia importa.**

| Variable | Rol | Para qué |
| -------- | --- | -------- |
| `DATABASE_URL` | `api_teatro` | La API. Sin superusuario, sin `BYPASSRLS` y sin poder crear ni borrar tablas |
| `DATABASE_URL_ADMIN` | el dueño de las tablas | Solo los scripts de esquema de [`database/`](database/) |

Conectándose como dueño de las tablas, PostgreSQL **ignora las políticas RLS**.
Por eso la API nunca usa `DATABASE_URL_ADMIN`: si lo hiciera, toda la capa de
RLS sería decorativa.

**Row Level Security** está activo en las once tablas, con once políticas que
nombran solo a `api_teatro`. Cualquier otro rol —`anon`, `authenticated`,
`service_role` o uno futuro— ve cero filas, no un error. Las dos vistas,
`v_programacion` y `v_boletas`, se crearon con `security_invoker = true`: sin
esa opción una vista consulta las tablas con los permisos de su dueño, que es
justo el atajo que RLS pretende cerrar.

**La base es la última línea de defensa.** Las reglas críticas no viven solo en
el código: `uq_funciones_sala` y `uq_boletas_butaca` son índices únicos
parciales que impiden programar dos funciones en la misma franja o vender dos
veces la misma butaca, incluso si dos peticiones simultáneas pasaran la
comprobación del service. `manejarError` traduce ese `23505` al 409 que le
corresponde.

**La salvaguarda de la huella.** `scripts/preparar-base.js --reiniciar` borra y
recrea el esquema, y una cadena de conexión no dice a qué proyecto pertenece:
basta pegar la equivocada en el `.env` para arrasar otra base. Ya pasó una vez.
Ahora el script compara una huella SHA-256 del host y del usuario con la
registrada en `database/huella-proyecto.json` **antes de abrir la conexión**, y
aborta con código 1 si no coinciden. Comprobarlo después del primer `DROP` no
serviría de nada.

Lo único que sigue en memoria es `src/data/apiKeys.js`: los clientes
registrados no se gestionan por la API.

## La interfaz · React + Vite

[`teatro-frontend/`](teatro-frontend/) es la interfaz del proyecto: una
aplicación de página única con dos partes. **Fuera de la sesión**, la cartelera
pública y la ficha de cada evento, que cualquiera puede leer, y el registro.
**Dentro**, un panel para cada rol: cuentas, programación, localidades, venta,
el control en la puerta, las boletas propias y la seguridad de cada cuenta.

```text
Navegador → React/Vite (localhost:5173)
          → fetch · HTTP JSON + JWT
          → Express (localhost:3000)
          → rutas → middlewares → controladores → servicios
          → pg.Pool + TLS → PostgreSQL (Supabase)
```

**Pila:** React 19, Vite 8, React Router 7 y Bootstrap 5.3, con ESLint 10. Es un
proyecto aparte con su propio `package.json`: el backend no gana ninguna
dependencia.

### Una sola interfaz

Hasta el módulo final hubo dos: **la Sala**, una página sin framework servida
por el propio Express en `/sala`, con la cartelera, el plano de butacas y la
compra; y este panel. Dos interfaces para un mismo sistema son dos sitios donde
mantener la sesión, los estilos, los textos y las reglas de la compra, y dos
superficies que revisar en cada auditoría. Se dejó una.

Se quedó la de React, porque es la que pide el módulo final. Pero la Sala no se
borró sin más: tenía tres cosas que el panel no tenía, y se trasladaron antes de
retirarla.

| Lo que aportaba la Sala | Dónde está ahora |
| ----------------------- | ---------------- |
| La cartelera pública, con un afiche por evento | `/`, sin cuenta: eventos con su próxima función y el precio más bajo, con filtro por tipo |
| La ficha de un evento con sus funciones y tarifas | `/evento/:id`, con el botón de compra que lleva al panel |
| El registro de asistentes | `/registro`: crea la cuenta, entra y abre «Mi perfil» para completar los datos |
| El plano de butacas | En la compra y en la venta de taquilla, en lugar de dos desplegables |

Con ella se fueron su montaje en `app.js`, su política de contenido propia y la
ruta `/sala/config.js`, que en otro tiempo entregaba la API Key al navegador.
`ALLOWED_ORIGIN` pasa a tener como valor por defecto el origen del panel,
`http://localhost:5173`. La prueba 34 del bloque 11, que comprobaba que esa ruta
ya no entregaba la clave, comprueba ahora que la ruta no existe (404) y que su
respuesta tampoco contiene la clave.

### Un panel por rol

| Rol | Qué ve | Qué puede hacer |
| --- | ------ | --------------- |
| **Administrador** | Indicadores del teatro: ingresos cobrados, boletas, funciones, eventos, asistentes y cuentas; boletas por estado y por mes; próximas funciones | Gestionar cuentas y roles, eventos y funciones con su máquina de estados, asistentes, localidades y boletas; emitir tokens de recuperación |
| **Taquilla** | Funciones en venta, de hoy y de la semana; la agenda en calendario por mes, semana y día | Cobrar reservas, vender en taquilla y registrar la entrada en la puerta cuando la función está en curso |
| **Asistente** | Sus boletas por estado y sus próximas funciones | Comprar, pagar (simulado) y cancelar sus boletas, y completar o editar sus datos |

Los tres tienen además sus códigos de respaldo y el cambio de contraseña.

### La cartelera, el plano y la compra

**La cartelera se lee siempre como público.** Pide eventos y funciones sin
token, aunque haya una sesión abierta: así un administrador que la mira ve lo
mismo que el público, y no las funciones programadas o los eventos inactivos que
su sesión le dejaría ver.

**El plano solo sabe qué butacas están tomadas.** Lo dibuja con
`GET /api/funciones/:id/ocupacion`, que devuelve `localidadId`, `fila` y `numero`
de las boletas no canceladas y nada más. La alternativa,
`GET /api/boletas/funcion/:id`, entrega las boletas completas, con el código y
el comprador de cada una: es minimización de datos. El plano es una rejilla de
botones con una sola parada de tabulación, que dentro se recorre con las
flechas; cada butaca anuncia su fila, su número y si está ocupada.

**El asistente se resuelve desde el token.** Comprar exige entrar, y quién
compra lo decide el servidor: `GET /api/asistentes/mio` devuelve los datos de la
cuenta del token, o 404 si todavía no tiene, y entonces el panel pide
completarlos con `POST /api/asistentes/mio`. El `usuarioId` no está declarado en
ningún validador, así que aunque el cliente lo mande, `matchedData` lo descarta.
Esto evita preguntar «¿existe el documento X?», que sería un oráculo para
enumerar documentos ajenos.

**Si alguien pulsa «Comprar» sin sesión**, entra o se registra y vuelve a esa
misma compra. Si cierra la sesión a propósito, en cambio, no se guarda ningún
destino: quien entre después puede ser otra persona. El
menú y las rutas se ordenan por rol, pero **no son la seguridad**: abrir a mano
`/panel/usuarios` con una cuenta de taquilla devuelve al inicio, y aunque se
forzara la petición, el backend respondería 403. La interfaz solo ofrece lo que
la API va a aceptar: un botón de transición aparece únicamente si esa
transición existe, y «Registrar entrada» está deshabilitado mientras la función
no esté en curso.

### Lo que el panel le pidió al backend

| Endpoint | Para qué |
| -------- | -------- |
| `GET /api/estadisticas/resumen` | Las cifras del inicio del administrador: solo totales, ni un dato personal |
| `GET /api/usuarios` | Listar cuentas con búsqueda, filtro por rol y estado, y páginas de veinte |
| `GET /api/usuarios/busqueda-recuperacion` | Elegir a quién emitir un token: devuelve id, nombre, correo y rol, y nada más |
| `PUT /api/usuarios/:id` | Editar nombre y correo; el rol, la contraseña y el estado se descartan si llegan |
| `PATCH /api/usuarios/:id/estado` | Activar o desactivar; desactivar sube la versión de sesión |

Respetan las capas del proyecto —ruta, validador, controlador, servicio— y
consultas parametrizadas. La búsqueda compara con `POSITION` en lugar de `LIKE`,
así que un `%` es un carácter más y no un comodín. Y el cambio de estado tiene
dos guardas: nadie puede desactivarse a sí mismo, y el último administrador
activo no se puede desactivar. La segunda solo se alcanza si dos
administradores se desactivan a la vez, y por eso corre con un bloqueo
`pg_advisory_xact_lock` y `FOR UPDATE`.

### La sesión en el panel

El JWT vive en **`sessionStorage`**, no en `localStorage`: muere al cerrar la
pestaña y no lo comparten otras. Al recargar, el panel lo confirma con
`GET /api/auth/perfil` y toma el rol de esa respuesta, no de lo que quedó
guardado. Si el servidor dice 401 —token caducado, revocado por un cambio de
contraseña, o cuenta desactivada—, la sesión se cierra y la pantalla de acceso
explica por qué. El cierre por caducidad está programado para el instante del
`exp`, sin esperar a la siguiente petición.

La Sala, que se retiró, lo guardaba solo en memoria y perdía la sesión en cada
recarga. Para una herramienta de trabajo eso empuja a dejar la contraseña
guardada en cualquier sitio. `sessionStorage` está al alcance de un XSS, igual
que la memoria; lo que de verdad protege el token es que no haya XSS, y para eso
están las reglas siguientes.

### Seguridad del cliente

- **Ninguna API Key en el navegador.** El panel no tiene ninguna y no la
  necesita: el catálogo es público, lo personal va con JWT y las dos rutas de
  restablecimiento las protege su propio secreto. La clave del cliente
  «Aplicación Web», que durante varios bloques se sirvió al navegador, está
  desactivada en `src/data/apiKeys.js`: una clave que estuvo a la vista se da
  por conocida y no se reactiva.
- **Nada se escribe como HTML.** Ni `dangerouslySetInnerHTML` ni `innerHTML`.
  React escapa todo lo que llega de la API.
- **Una política de contenido estricta.** El build lleva una CSP con
  `script-src 'self'` y `style-src 'self'` a secas, posible porque el panel no
  tiene un solo estilo en línea: los gráficos son SVG con atributos. Servido con
  `vite preview`, la CSP llega además como cabecera con `frame-ancestors 'none'`,
  que en un `<meta>` no tiene efecto, junto a `X-Frame-Options`,
  `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` y
  `Cross-Origin-Opener-Policy`.
- **El precio nunca sale del navegador.** Comprar o vender envía función,
  localidad, butaca y descuento. El precio que se ve antes es una previsión; el
  definitivo lo calcula el servidor.

### Cómo arrancarlo

Dos terminales, con la API configurada:

```bash
npm run dev                                   # terminal 1, raíz del proyecto

cd teatro-frontend                            # terminal 2
copy .env.example .env                        # VITE_API_URL=http://localhost:3000
npm ci
npm run lint && npm run build
npm run dev                                   # http://localhost:5173
```

La cartelera queda en <http://localhost:5173/> y el panel en
<http://localhost:5173/panel>. `GET http://localhost:3000/` sigue devolviendo
`{"mensaje":"API Teatro funcionando"}`: el backend ya no sirve ninguna página.

El backend solo responde a los orígenes de `ALLOWED_ORIGIN`, así que tiene que
incluir `http://localhost:5173`. Si el panel se publica en otro origen, ese
origen va ahí también: si no, el navegador bloquea las respuestas, que es
exactamente lo que CORS debe hacer.

El detalle de la anatomía, los módulos y las variables está en
[`teatro-frontend/README.md`](teatro-frontend/README.md).

## Qué credencial pide cada ruta

Tres capas, y cada una por un motivo distinto.

| Capa | Rutas | Por qué |
| ---- | ----- | ------- |
| **Público** | `POST /api/auth/login`, `POST /api/auth/registro`, las dos de restablecimiento y las nueve lecturas del catálogo | No contienen un solo dato personal; quien entra o se registra todavía no tiene credenciales, y quien restablece las perdió |
| **Solo JWT** | `/api/auth/perfil`, `/cambiar-password`, `/recuperacion/{id}`, `/codigos-recuperacion*`, y todo lo de asistentes, boletas, usuarios, estadísticas y las escrituras del catálogo | Lo que es de alguien necesita saber quién pregunta |
| **Solo API Key** | `/api/seguridad/cliente` | Una integración sin sesión que no corre en un navegador |

Las nueve lecturas públicas son `GET` de `/api/eventos`, `/api/funciones` y
`/api/localidades`, con sus variantes por id, más las tarifas y la ocupación de
una función. Es la cartelera del teatro: títulos, fechas, horas, precios y qué
butacas quedan libres. Lo mismo que cualquier taquilla enseña en la calle.

Con tres límites, que no son adorno:

- **La ocupación no dice de quién es cada butaca.** Devuelve `localidadId`,
  `fila` y `numero`, y nada más: ni el asistente, ni la boleta, ni su código.
- **Lo inactivo no se anuncia.** Un evento desactivado no sale en la lista y
  responde 404 por id; una función solo aparece en `en_venta`, `agotada` o
  `en_curso`. Al mostrador se le enseña todo, porque lo administra.
- **Las escrituras siguen exigiendo JWT de administrador**, sin excepción.

Lo decide `sesionOpcional`, un middleware que reconoce el token si viene y
nunca responde 401. En una ruta pública un token caducado no es un error: se
ignora y la petición sigue como anónima.

**Las dos rutas de restablecimiento se abrieron en el módulo final.** En el
bloque 11 pedían API Key, y quedó escrito que se decidiría cuando existiera una
interfaz de página única. Ya existe: el panel las llama desde el navegador, y el
navegador no tiene clave ni debe tenerla. Pedírsela habría obligado a servirle
una, que es justo el error que el bloque 11 corrigió.

Abrirlas no las deja sin protección, porque nunca dependieron de la clave. Lo
que las protege es el secreto de un solo uso: el token administrativo son 256
bits y caduca a los quince minutos; cada código de respaldo son 128 bits y va
ligado al correo de la cuenta. Ninguno se puede adivinar, ni con clave ni sin
ella. Encima sigue el límite de diez intentos por ventana.

## Instalación y ejecución

Requisitos: Node.js 18 o superior (probado en 24.15.0) y npm.

```bash
npm install
cp .env.example .env

node scripts/preparar-base.js --reiniciar   # esquema, RLS, semilla y vistas
npm run seed:admin                          # crea el primer administrador

npm run dev     # desarrollo (nodemon)
npm start       # producción
```

Los comandos se ejecutan desde la raíz del proyecto. El servidor queda en
`http://localhost:3000`.

**`npm start` y `npm run dev` no crean ninguna cuenta.** El primer administrador
se crea solo con `npm run seed:admin`, un paso explícito que se ejecuta una vez
al instalar. Montar el servicio y entregar la primera llave maestra son dos
operaciones distintas, y la segunda no debe repetirse en cada despliegue.

El bootstrap es idempotente: si ya existe cualquier cuenta con rol
`administrador`, no inserta ni modifica nada. Tampoco convierte en administradora
una cuenta de otro rol, aunque se le pase su correo. El detalle está en
[`docs/seguridad/informe-bloque8.md`](docs/seguridad/informe-bloque8.md).

| Variable | Por defecto | Uso |
| -------- | ----------- | --- |
| `PORT` | `3000` | Puerto |
| `ALLOWED_ORIGIN` | `http://localhost:5173` | Orígenes permitidos por CORS, separados por comas: el de la interfaz en React. Al publicarla, se añade aquí su origen |
| `RATE_LIMIT_MAX` | `100` | Peticiones por ventana de 15 min en todo `/api` |
| `RATE_LIMIT_ACCESO_MAX` | `10` | Intentos de login y registro por ventana |
| `RATE_LIMIT_RECUPERACION_MAX` | `10` | Intentos en las rutas de recuperación |
| `API_KEY_POSTMAN` | sin valor | Clave del cliente Postman Laboratorio |
| `API_KEY_TAQUILLA` | sin valor | Clave del cliente Taquilla del Teatro |
| `API_KEY_WEB` | sin valor | Clave del cliente Aplicación Web, **desactivado** desde el bloque 11 |
| `API_KEY_MOVIL` | sin valor | Clave del cliente Aplicación Móvil (deshabilitado) |
| `JWT_SECRET` | sin valor | Clave con la que se firman y verifican los JWT |
| `JWT_EXPIRES_IN` | `1h` | Cuánto dura un token |
| `ADMIN_NOMBRE` | sin valor | Nombre del primer administrador. **Solo lo usa `seed:admin`** |
| `ADMIN_EMAIL` | sin valor | Su correo |
| `ADMIN_PASSWORD` | sin valor | Su contraseña, de 12 caracteres o más. **Solo vive aquí y nunca se imprime** |
| `DATABASE_URL` | sin valor | Conexión de la API: rol `api_teatro`, solo datos |
| `DATABASE_URL_ADMIN` | sin valor | Conexión del dueño, solo para crear o reiniciar la base |
| `DATABASE_URL_PRUEBAS_ADMIN` | sin valor | Opcional. Proyecto **aparte** para las pruebas BA08 y BA09 |

`.env` está en `.gitignore`; `.env.example` es la plantilla y nunca lleva las
claves reales: solo trae marcadores. **Cada integrante genera su propio
`JWT_SECRET` en su `.env`**, igual que sus API Keys y la contraseña del
administrador. Las tres API Keys son obligatorias: sin ellas el servidor no
arranca.

En `.env.example` las tres variables del administrador van con marcador, el
correo incluido:

```
ADMIN_NOMBRE=REEMPLAZAR_CON_EL_NOMBRE_DEL_ADMINISTRADOR
ADMIN_EMAIL=REEMPLAZAR_CON_UN_CORREO_REAL_Y_NO_PUBLICADO
ADMIN_PASSWORD=REEMPLAZAR_CON_PASSWORD_SEGURO_DE_12_O_MAS
```

El correo lleva marcador por el mismo motivo que la contraseña: es la mitad de
unas credenciales. Un ejemplo que parece utilizable acaba copiado tal cual, y
entonces la dirección del administrador queda publicada en el repositorio.

Genera cada API Key con:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Y el `JWT_SECRET`, más largo, con:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

La contraseña del administrador se escribe a mano en el `.env` y no se comparte
por ningún otro canal. Al arrancar, el servidor imprime `Administrador inicial
creado` la primera vez y nada más: ni el correo ni la contraseña aparecen en el
log.

Para probar desde Swagger UI hay que pulsar **Authorize**, arriba a la derecha,
y pegar una de las claves activas. Sin ese paso todos los endpoints responden
401. En ese mismo diálogo se pega el token del login para las rutas que además
piden `BearerAuth`.

## Estructura

```
API_TEATRO/
├── .env.example
├── .gitignore
├── README.md
├── package.json
├── certs/                       # certificado TLS de Supabase (no se versiona)
├── database/                    # esquema SQL, roles, semilla y verificación
├── scripts/                     # preparar-base.js, probar-conexion.js y comprobar-proyecto.js
├── docs/entregas/                # informes de entrega en PDF
├── docs/seguridad/               # salidas de las herramientas e informes por laboratorio
├── teatro-frontend/              # la interfaz: cartelera pública y panel, en React + Vite
│   ├── index.html
│   ├── vite.config.js            # CSP del build y cabeceras de seguridad
│   ├── eslint.config.js
│   ├── .env.example              # solo VITE_API_URL
│   ├── CREDITOS-IMAGENES.md      # autoría de las fotografías
│   └── src/
│       ├── main.jsx · App.jsx    # arranque y rutas protegidas por rol
│       ├── navegacion.js         # módulos de cada rol
│       ├── context/              # AuthContext: sesión, caducidad y revocación
│       ├── hooks/                # useAuth, useDashboardData, useDatos
│       ├── pages/                # cartelera, evento, acceso, registro, panel y recuperación
│       ├── components/           # módulos de gestión y piezas compartidas
│       ├── services/             # un fetch, y una función por operación
│       └── utils/                # formato, afiches y reglas de contraseña
├── pruebas/                      # scripts de prueba contra el servidor
│   ├── correr.sh                 # lanza las trece baterías y suma el total
│   ├── pruebas.js
│   ├── pruebas-funciones.js
│   ├── pruebas-boletas.js
│   ├── pruebas-limites.js
│   ├── pruebas-cuenta.js
│   ├── pruebas-autorizacion.js
│   ├── pruebas-recuperacion.js
│   ├── pruebas-bloque11.js
│   ├── pruebas-panel.js          # lo que el panel pidió al backend
│   ├── pruebas-acceso.js         # los tres límites de peticiones
│   ├── sesion.js                 # API Key y token del administrador
│   ├── verificar-a.js
│   ├── verificar-b.js
│   └── verificar-c.js
└── src/
    ├── app.js
    ├── config/
    │   └── database.js           # pool de PostgreSQL con TLS
    ├── controllers/
    │   ├── asistentes.controller.js
    │   ├── auth.controller.js
    │   ├── boletas.controller.js
    │   ├── estadisticas.controller.js
    │   ├── eventos.controller.js
    │   ├── funciones.controller.js
    │   ├── localidades.controller.js
    │   └── usuarios.controller.js
    ├── data/
    │   └── apiKeys.js            # lo único que no vive en PostgreSQL
    ├── docs/
    │   └── swagger.js
    ├── middlewares/
    │   ├── apiKey.middleware.js
    │   ├── asistentes.validator.js
    │   ├── auth.middleware.js
    │   ├── auth.validator.js
    │   ├── boletas.validator.js
    │   ├── entrada.middleware.js     # rechaza el carácter nulo
    │   ├── errores.middleware.js
    │   ├── eventos.validator.js
    │   ├── funciones.validator.js
    │   ├── localidades.validator.js
    │   ├── propiedad.middleware.js   # guardas de propiedad (IDOR/BOLA)
    │   ├── publico.middleware.js     # sesión opcional y filtros del catálogo
    │   ├── roles.middleware.js       # autorizarRoles
    │   ├── usuarios.validator.js
    │   └── validar.middleware.js
    ├── routes/
    │   ├── asistentes.routes.js
    │   ├── auth.routes.js
    │   ├── boletas.routes.js
    │   ├── estadisticas.routes.js
    │   ├── eventos.routes.js
    │   ├── funciones.routes.js
    │   ├── localidades.routes.js
    │   ├── seguridad.routes.js
    │   └── usuarios.routes.js
    ├── services/
    │   ├── apiKeys.service.js
    │   ├── asistentes.service.js
    │   ├── boletas.service.js
    │   ├── codigosRecuperacion.service.js
    │   ├── estadisticas.service.js
    │   ├── eventos.service.js
    │   ├── funciones.service.js
    │   ├── localidades.service.js
    │   ├── recuperacion.service.js
    │   └── usuarios.service.js
    └── utils/
        ├── crypto.util.js            # SHA-256 para las API Keys
        ├── jwt.util.js               # firma y verificación de los JWT
        └── password.util.js          # bcrypt para las contraseñas
```

Flujo: `routes → validadores → controllers → services → base de datos`. Los
controllers no acceden a los datos: los services son los únicos que consultan
PostgreSQL, siempre con consultas parametrizadas y a través del pool de
[`src/config/database.js`](src/config/database.js). La excepción es
`apiKeys.service.js`, que sigue leyendo `src/data/apiKeys.js` porque los
clientes registrados no se gestionan por la API.

## Endpoints

60 endpoints en 37 rutas, con 43 schemas. El reparto que declara Swagger: **46**
exigen el JWT, **13** no piden credenciales y **1** pide la API Key. Hasta el
bloque 11 los endpoints con sesión llevaban `ApiKeyAuth` y `BearerAuth` en el
mismo objeto, porque hacían falta las dos a la vez; ahora cada uno declara solo
lo que de verdad exige. Swagger UI:
<http://localhost:3000/api-docs> · OpenAPI:
<http://localhost:3000/openapi.json>

La columna **Quién** repite la tabla de
[Autorización: roles y permisos](#autorización-roles-y-permisos).

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
| GET | `/api/asistentes/mio` | Datos de asistente de la cuenta del token |
| POST | `/api/asistentes/mio` | Los crea y los liga a esa cuenta |
| PATCH | `/api/asistentes/mio` | El asistente edita su propio perfil, sin id en la dirección |
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
| GET | `/api/funciones/:id/ocupacion` | Butacas tomadas, solo `localidadId`, `fila` y `numero` |
| POST | `/api/funciones` | Crea una función en estado `programada` |
| PUT | `/api/funciones/:id` | Reemplaza una función, conserva el estado |
| PATCH | `/api/funciones/:id` | Actualiza parcialmente una función |
| PATCH | `/api/funciones/:id/estado` | Cambia el estado de una función |
| DELETE | `/api/funciones/:id` | Elimina una función sin boletas vendidas |

**Boletas**

| Método | Ruta | Descripción |
| ------ | ---- | ----------- |
| GET | `/api/boletas` | Lista las boletas |
| GET | `/api/boletas/mias` | Boletas de la cuenta del token |
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

**Usuarios**

| Método | Ruta | Descripción |
| ------ | ---- | ----------- |
| GET | `/api/usuarios` | Lista las cuentas con búsqueda, filtro por rol y estado, de veinte en veinte |
| GET | `/api/usuarios/busqueda-recuperacion` | Cuentas activas para la recuperación: id, nombre, correo y rol |
| POST | `/api/usuarios` | Crea una cuenta de `taquilla` o de `administrador` |
| PUT | `/api/usuarios/:id` | Edita nombre y correo; el rol y la contraseña no se tocan |
| PATCH | `/api/usuarios/:id/estado` | Activa o desactiva una cuenta y revoca sus sesiones |

Las cinco, solo el administrador.

**Estadísticas**

| Método | Ruta | Descripción |
| ------ | ---- | ----------- |
| GET | `/api/estadisticas/resumen` | Totales del teatro para el panel administrativo, sin datos personales |

**Autenticación**

| Método | Ruta | Descripción |
| ------ | ---- | ----------- |
| POST | `/api/auth/registro` | Registra un usuario como `asistente`; la contraseña se guarda con bcrypt |
| POST | `/api/auth/login` | Comprueba email y contraseña y devuelve un JWT |
| GET | `/api/auth/perfil` | Devuelve el usuario del JWT y, si llegó clave, su cliente |
| PATCH | `/api/auth/cambiar-password` | Cambia la propia contraseña y revoca las sesiones anteriores |
| POST | `/api/auth/recuperacion/:usuarioId` | El administrador emite un token de 15 minutos para una cuenta |
| POST | `/api/auth/restablecer-password` | Canjea ese token por una contraseña nueva, una sola vez |
| POST | `/api/auth/codigos-recuperacion` | Genera ocho códigos de un solo uso; se muestran una única vez |
| GET | `/api/auth/codigos-recuperacion/estado` | Cuántos códigos quedan, sin revelarlos |
| POST | `/api/auth/codigos-recuperacion/regenerar` | Lote nuevo; invalida el anterior por completo |
| POST | `/api/auth/restablecer-con-codigo` | Canjea un código de respaldo por una contraseña nueva |

## Análisis de seguridad

Las capturas de cada prueba están en los informes PDF de
[`docs/entregas/`](docs/entregas/). En [`docs/seguridad/`](docs/seguridad/) están
las salidas de las herramientas, una por laboratorio, y el informe escrito de
cada bloque:

| Informe | Tema |
| ------- | ---- |
| [`informe-lab5.md`](docs/seguridad/informe-lab5.md) | Integridad referencial y API Key |
| [`informe-lab6.md`](docs/seguridad/informe-lab6.md) | Múltiples clientes con API Keys como hash |
| [`informe-lab7.md`](docs/seguridad/informe-lab7.md) | Usuarios, hashing y salting con bcrypt |
| [`informe-lab8.md`](docs/seguridad/informe-lab8.md) | Control del rol y escalada de privilegios |
| [`informe-lab9.md`](docs/seguridad/informe-lab9.md) | Autenticación con JWT |
| [`informe-frontend.md`](docs/seguridad/informe-frontend.md) | La Sala, la primera interfaz, hoy retirada: XSS, minimización de datos y sesión en memoria |
| [`informe-lab10.md`](docs/seguridad/informe-lab10.md) | Autorización, RBAC e IDOR/BOLA |
| [`informe-bloque7.md`](docs/seguridad/informe-bloque7.md) | Supabase y PostgreSQL: persistencia, rol de privilegio mínimo y RLS |
| [`informe-bloque8.md`](docs/seguridad/informe-bloque8.md) | Validación integral: bootstrap separado y las 53 pruebas del laboratorio |
| [`informe-bloque11.md`](docs/seguridad/informe-bloque11.md) | Recuperación de acceso, versión de sesión y reparto de credenciales |
| [`informe-modulo-final.md`](docs/seguridad/informe-modulo-final.md) | El panel de gestión en React y la estrategia de pruebas: API, SCA, SAST y DAST |

| Técnica | Herramienta | Alcance | Resultado |
| ------- | ----------- | ------- | --------- |
| SCA | `npm audit` | 159 paquetes | 0 vulnerabilidades |
| SAST | Semgrep 1.172.0 | 73 reglas, 43 archivos | 0 hallazgos |
| SAST manual | Revisión de código | `src/` completo | 2 hallazgos, corregidos |
| DAST | OWASP ZAP 2.17.0 | 39 URLs, Active Scan sobre `/api` | 2 alertas, ambas falsos positivos |
| SCA, cierre del frontend | `npm audit --omit=dev` | lo que se despliega | 0 vulnerabilidades |
| SAST, cierre del frontend | Semgrep con `p/javascript`, `p/nodejs`, `p/owasp-top-ten` y `p/xss` | 74 reglas, 61 archivos de `src/` y `frontend/` | 0 hallazgos |
| XSS manual | Carga guardada en un evento desde la API | Cartelera y ficha del evento | Se muestra como texto; 0 nodos inyectados |
| SCA, Lab 10 | `npm audit` | 159 paquetes, incluidas las de desarrollo | 3 altas, todas de `nodemon` |
| SCA, Lab 10 | `npm audit --omit=dev` | 136 paquetes, lo que se despliega | 0 vulnerabilidades |
| SAST, Lab 10 | Semgrep 1.179.0 con `p/javascript`, `p/nodejs` y `p/owasp-top-ten` | 74 reglas, 66 archivos de `src/` y `frontend/` | 0 hallazgos |
| IDOR manual | Asistente A y B con boletas propias | `/boletas/asistente/:id`, `/boletas/:id`, `/estado` | Ajenas 403; propias 200 |
| SCA, Bloque 8 | `npm audit` y `npm audit --omit=dev` | todas las dependencias | 0 vulnerabilidades |
| SAST, Bloque 8 | Semgrep con `p/javascript`, `p/nodejs` y `p/owasp-top-ten` | 76 reglas, 78 archivos de `src/`, `scripts/`, `frontend/` y `pruebas/` | 0 hallazgos |
| SCA, Bloque 11 | `npm audit` | todas las dependencias | 4 moderadas, todas en `glob` y `minimatch` |
| SCA, Bloque 11 | `npm audit --omit=dev` | lo que se despliega | 3 moderadas, por la misma vía |
| SAST, Bloque 11 | Semgrep con `p/javascript`, `p/nodejs` y `p/owasp-top-ten` | 76 reglas, 85 archivos | 0 hallazgos |
| SCA, módulo final | `npm audit`, backend y panel | todas las dependencias | Backend 4 moderadas (las del bloque 11); **panel 0**, tras actualizar ESLint a 10.15.0 |
| SCA, módulo final | `npm audit --omit=dev` | lo que se despliega | Backend 3 moderadas; **panel 0** |
| SAST, módulo final | Semgrep con `p/javascript`, `p/nodejs`, `p/owasp-top-ten` y `p/react` | 75 reglas, 133 archivos, incluida la interfaz en React | 0 hallazgos |
| Pruebas de API, módulo final | Swagger UI con Authorize y `BearerAuth` | sin token, rol que no corresponde, cuerpo inválido, operación correcta y restablecimiento sin API Key | 401, 403, 400 con el error de cada campo, 200 y 400 |
| DAST, módulo final | OWASP ZAP 2.17.0, escaneo activo **autenticado** | 61 URLs del OpenAPI y 27 de la interfaz compilada, ya unificada | 4 informativas; 0 altas, medias o bajas; 0 respuestas 5xx tras corregir DAST-04 |

**SCA.** Sin vulnerabilidades. `npm audit fix` no modificó el
`package-lock.json`. Aviso de obsolescencia, sin vulnerabilidad asociada, en
`glob@11.1.0` (dependencia transitiva de `swagger-jsdoc`).

**SCA en el Lab 10: tres vulnerabilidades altas, y por qué no se arreglan.**
Son nuevas, y hasta este laboratorio siempre reportamos cero. No vienen del
código ni de ninguna dependencia de la API: vienen de `braces`, que entra por
`chokidar`, que entra por `nodemon`, la única dependencia de desarrollo. Es una
denegación de servicio por agotamiento de pila con patrones muy anidados. Con
`--omit=dev`, que es lo que corre en producción, el resultado es **0 sobre 136
paquetes**. No se arregla porque el arreglo es peor: `npm audit fix --force`
instala `nodemon@1.14.10`, de 2018, con sus propios problemas. Preferimos dejar
constancia del hallazgo, acotado a desarrollo, antes que empeorar el proyecto
para que una tabla diga cero.

**SCA en el Bloque 11: cuatro moderadas, y por qué tampoco se arreglan.** Están
en `glob` y en `minimatch`, que entran por `swagger-jsdoc` y por `nodemon`. El
bloque 11 no añadió ninguna dependencia: todo lo nuevo usa `crypto` de Node, `pg`
y `express-rate-limit`, que ya estaban. No se arreglan por dos razones. La
primera es que la única corrección que ofrece npm es **degradar** `swagger-jsdoc`
de 6.3.0 a 6.2.8, una versión anterior, cambiando un aviso por el riesgo real de
romper el spec. La segunda es que ninguna es alcanzable desde una petición: los
dos paquetes resuelven patrones de rutas de archivos, y el único patrón del
proyecto es la constante `apis: ["./src/routes/*.js"]`, evaluada una vez al
arrancar. Si algún día un patrón saliera de la entrada del usuario, la
valoración cambiaría.

**Nota de ejecución de Semgrep.** En el equipo de desarrollo, Smart App Control
de Windows bloquea `semgrep-core.exe` (evento 3077 de CodeIntegrity). El
escaneo del Lab 10 se hizo con la imagen oficial, que ejecuta el mismo análisis
en Linux, sin desactivar ninguna protección del equipo:

```bash
docker run --rm -v "$(pwd):/src" -w /src semgrep/semgrep \
  semgrep --config p/javascript --config p/nodejs --config p/owasp-top-ten src/ frontend/
```

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
| SEC-02 | Una petición desde un origen no permitido por CORS respondía 500 y se registraba como fallo del servidor | El `origin` de CORS responde `false` en vez de lanzar un `Error`: sale sin `Access-Control-Allow-Origin` y el navegador bloquea la lectura | Origen ajeno → 200 sin la cabecera; origen del panel → la recibe |
| DAST-04 | Un carácter nulo (`\u0000`) en la entrada llegaba hasta PostgreSQL, que lo rechaza en un texto, y la API respondía 500. Lo encontró el escaneo autenticado en `GET /api/usuarios?q=`, y afectaba también al registro | `rechazarCaracterNulo`, montado tras `express.json`, responde 400 ante un nulo en el cuerpo, la consulta o la ruta; `manejarError` traduce además el código `22021` a 400 | `pruebas-panel.js` 37 a 39; segundo escaneo sin un solo 5xx |

### Pruebas automatizadas

| Suite | Comprobaciones |
| ----- | -------------- |
| Asistentes, eventos y localidades | 57 |
| Funciones, incluida la ocupación del plano | 58 |
| Boletas | 55 |
| Límites de venta y regresión | 22 |
| Asistente ligado a la cuenta | 22 |
| Autorización, RBAC e IDOR/BOLA | 104 |
| Recuperación de acceso y códigos de respaldo | 44 |
| Versión de sesión y reparto de credenciales | 35 |
| Los tres límites de peticiones | 5 |
| Panel: acceso, resumen, cuentas, recuperación sin clave, carácter nulo y CORS | 43 |
| Checklist de seguridad (35 casos) | 38 |
| **Total** | **483, 0 fallos** |

## Pruebas

Los scripts de `pruebas/` lanzan peticiones reales contra el servidor y
comparan el código de respuesta y el cuerpo con lo esperado. No usan ninguna
librería de test: son scripts de Node con `fetch`.

| Script | Qué cubre | Comprobaciones |
| ------ | --------- | -------------- |
| `pruebas.js` | CRUD de asistentes, eventos y localidades: validaciones, unicidad, estados y campos calculados | 57 |
| `pruebas-funciones.js` | Funciones: las ocho reglas de negocio, el cuadro de tarifas, la ocupación y la máquina de estados | 58 |
| `pruebas-boletas.js` | Boletas: precio y código calculados por el servidor, butaca única, descuentos y estados | 55 |
| `pruebas-limites.js` | Aforo, límite de 6 boletas por asistente y borrado protegido de funciones | 22 |
| `pruebas-cuenta.js` | Asistente ligado a la cuenta: token obligatorio, aislamiento entre cuentas, edición del perfil propio y Mass Assignment de `usuarioId` | 22 |
| `pruebas-autorizacion.js` | Autorización: los tres roles, el administrador inicial, la lista blanca del rol, el IDOR de boletas con dos asistentes y las 30 pruebas obligatorias del laboratorio | 104 |
| `pruebas-recuperacion.js` | Recuperación: token administrativo de un solo uso, caducidad, los ocho códigos de respaldo, el canje y la regeneración del lote | 44 |
| `pruebas-bloque11.js` | Versión de sesión, revocación al cambiar la contraseña y el reparto de credenciales: catálogo público, ocupación sin datos ajenos y escrituras cerradas | 35 |
| `pruebas-panel.js` | El módulo final: login fallido sin enumerar cuentas, el resumen del panel, listar, buscar, editar y desactivar cuentas, la recuperación desde el navegador sin API Key, el carácter nulo, CORS y el contrato en Swagger | 43 |
| `pruebas-acceso.js` | Los tres límites de peticiones: `/api`, login y registro, y las rutas de recuperación | 5 |
| `verificar-a.js` | Casos 1 a 16 del checklist: validación de entrada y Mass Assignment | 16 |
| `verificar-b.js` | Casos 17 a 31: reglas de negocio e integridad | 16 |
| `verificar-c.js` | Casos 32 a 35: cuerpo grande, límite de peticiones, cabeceras y error interno sin stack | 6 |

### Cómo ejecutarlos

Con el `.env` configurado y el servidor en marcha en otra terminal:

```bash
npm run dev                    # terminal 1
node pruebas/pruebas.js        # terminal 2
```

Para la tanda completa hay un lanzador que reinicia la base, corre las trece
baterías en orden y suma el total. Comprueba la huella del proyecto antes de
borrar nada, y termina con código 1 si alguna prueba falla:

```bash
bash pruebas/correr.sh
```

`pruebas/sesion.js` centraliza la identidad: carga el `.env` con dotenv, envía
la cabecera `X-API-Key` en todas las peticiones y entra como el administrador
del `.env` cuando la batería necesita escribir. Ni la clave ni la contraseña
están escritas en el código de las pruebas.

Por eso las baterías necesitan `ADMIN_EMAIL` y `ADMIN_PASSWORD` en el `.env`:
sin el administrador inicial no hay con qué crear un evento.

Dos avisos:

- Las pruebas crean y borran registros, y desde la migración a PostgreSQL esos
  cambios **sobreviven al reinicio del servidor**. Para partir siempre de los
  datos semilla hay que reiniciar la base antes de cada script:

```bash
node scripts/preparar-base.js --reiniciar
```

  Reiniciar Node ya no basta: ese era justamente el objetivo del bloque 7.
- Salvo `verificar-c.js` y `pruebas-acceso.js`, los scripts superan los límites
  por ventana y chocan con ellos. Se lanzan con los tres subidos:

```bash
RATE_LIMIT_MAX=100000 RATE_LIMIT_ACCESO_MAX=100000 \
RATE_LIMIT_RECUPERACION_MAX=100000 npm run dev
```

`verificar-c.js` y `pruebas-acceso.js` son la excepción: comprueban
precisamente que los límites salten, y necesitan los valores de servicio. Eso
es lo que hace `correr.sh`, que arranca el servidor con los valores que cada
batería necesita.

## Limitaciones conocidas

- Los clientes de la API Key son lo único que queda en memoria. Deshabilitar o
  añadir uno exige editar `src/data/apiKeys.js` y reiniciar; no hay endpoint
  para gestionarlos. El resto de los datos vive en PostgreSQL.
- Por el registro público no se puede crear un administrador, ni siquiera a
  propósito. El primero sale de `crearAdministradorInicial()`, que lo siembra
  desde el `.env` al arrancar; los demás, de `POST /api/usuarios`.
- `JWT_SECRET` se comprueba cuando se usa, no al arrancar. Si falta, el servidor
  arranca igual y falla al primer login, con un 500.
- Revocar una sesión exige cambiar la contraseña. Desde el bloque 11 eso
  invalida todos los tokens anteriores, y una cuenta desactivada deja de pasar
  en la siguiente petición, pero no hay un endpoint de «cerrar mis otras
  sesiones» que suba la versión sin tocar la contraseña.
- La revocación cuesta una consulta por petición autenticada, que es justo lo
  que un JWT prometía evitar. Se paga a propósito, y en una base con más carga
  sería el primer sitio donde mirar una caché corta.
- Las cuatro vulnerabilidades moderadas de `npm audit` están en `glob` y
  `minimatch`, por `swagger-jsdoc` y `nodemon`. Ninguna es alcanzable desde una
  petición, y el único arreglo que ofrece npm es degradar `swagger-jsdoc`.
- El panel guarda el JWT en `sessionStorage`. Un XSS podría leerlo, como
  podría leer la memoria; la defensa real es que no haya XSS, y por eso el panel
  no escribe HTML y su CSP no admite scripts ni estilos en línea. La alternativa
  completa sería una cookie `httpOnly`, que exige HTTPS y protección anti-CSRF.
- Las confirmaciones del panel usan el `confirm()` del navegador: accesible y
  sin dependencias, pero con el aspecto del sistema y no el del teatro.
- En pantallas estrechas las tablas largas se desplazan en horizontal dentro de
  su tarjeta. La página no se desborda, pero hay que deslizar para ver las
  acciones.
- `GET /api/boletas/:id` responde 404 antes de mirar el rol, así que cualquier
  sesión puede distinguir una boleta inexistente de una ajena. Es la decisión
  de la guía del laboratorio y se mantuvo, pero lo coherente con el resto sería
  responder 403 también ahí, como ya se hace en
  `GET /api/boletas/asistente/:asistenteId`.
- La taquilla no puede cambiar el estado de una función. Pasar una a `en_curso`
  o a `finalizada` es trabajo de sala y no de programación, pero hoy exige un
  administrador. Hacerlo bien pide un control por transición, no por endpoint.
- No se puede quitar un vínculo `usuarioId`: se puede asignar y reasignar, pero
  no dejar un asistente sin cuenta, porque el `PUT` conserva el valor cuando no
  llega en lugar de borrarlo. Es deliberado: anular el vínculo por omisión
  convertiría cualquier edición de un nombre en una desvinculación silenciosa.
- Los asistentes de la semilla siguen con `usuarioId: null` y solo el
  administrador los puede asociar a una cuenta. Es deliberado: dejar que
  cualquiera reclame un documento ajeno sería justo el agujero que se quería
  evitar.
- No hay registro de auditoría. Un administrador puede crear usuarios y asociar
  cuentas, pero no queda constancia de quién lo hizo ni cuándo.
- Sin HTTPS: `Strict-Transport-Security` solo tiene efecto sobre TLS.
- Concurrencia: las comprobaciones de negocio y la escritura ocurren en dos
  consultas distintas, así que dos peticiones simultáneas podrían pasar ambas
  la comprobación. Quien impide el duplicado es la base: `uq_boletas_butaca` y
  `uq_funciones_sala` hacen que la segunda escritura falle en lugar de vender
  dos veces la misma butaca, y `manejarError` traduce ese `23505` al 409 que
  le corresponde. Sigue siendo una red y no una reserva: la butaca no se
  bloquea mientras el cliente decide.

## Documentación de entregas — Lab. No.5, No.6, No.7, No.8, No.9, No.10 y Bloques 7, 8 y 11

- [Pruebas SCA + SAST + DAST y levantamiento de la API](docs/entregas/LEVANTAMIENTO%20DE%20LA%20API%20MAS%20PRUEBAS.pdf)
- [Laboratorio 5: integridad referencial y API Keys](docs/entregas/Integridad%20referencial%20%2B%20API%20Keys.pdf)
- [Laboratorio 6: múltiples clientes y API Keys como hash](docs/entregas/M%C3%BAltiples%20clientes%20%2B%20API%20Keys%20almacenadas%20como%20hash.pdf)
- [Laboratorio 7: usuarios, hashing y salting](docs/entregas/Usuarios%20%2B%20Hashing%20%2B%20Salting%20%C2%B7%20API_TEATRO.pdf)
- [Laboratorio 8: control del rol y escalada de privilegios](docs/entregas/Control%20del%20rol%20y%20prevenci%C3%B3n%20de%20escalada%20de%20privilegios%20%C2%B7%20API_TEATRO.pdf)
- [Laboratorio 9: autenticación con JWT](docs/entregas/Autenticaci%C3%B3n%20con%20JWT%20-%20API_TEATRO.pdf)
- [Laboratorio 10: autorización segura, RBAC e IDOR/BOLA](docs/entregas/Autorizaci%C3%B3n%20Segura%20en%20APIs%20REST%20-%20API%20-%20TEATRO.pdf)
- [Bloque 7: Supabase, PostgreSQL y persistencia segura](docs/entregas/Bloque%207%20-%20Supabase%20y%20PostgreSQL%20-%20persistencia%20segura%20-%20API_TEATRO.pdf)
- [Bloque 8: bootstrap del administrador y validación integral](docs/entregas/BLOQUE%208%20-%20bootstrap%20validacion%20API_TEATRO.pdf)
- [Bloque 11: recuperación de acceso y reparto de credenciales](docs/entregas/Bloque11%20-%20Recuperacion%20-%20Credenciales%20-%20API_TEATRO.pdf)

## Integrantes

- Juan Sebastián Bonilla León
- Juan Camilo Calderón Delgado
- Silvana Sofia Siza Soriano
- Cristian Emanuel Hernández Araque
- Cristian Rodrigo Amaya Torres
