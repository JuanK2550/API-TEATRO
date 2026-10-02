# Laboratorio 9 — Bloque 5: autenticación con JWT

## De dónde venimos

Hasta el Lab 8 el login solo respondía "Autenticación correcta" y ahí se
acababa. La API confirmaba las credenciales y las olvidaba: la petición
siguiente volvía a ser anónima.

En este laboratorio el login entrega un **JWT**, una credencial temporal
firmada. El cliente la guarda y la presenta en cada petición.

La comparación que usamos para entenderlo es la manilla de un concierto. En la
entrada se muestra la cédula una sola vez, y a cambio se recibe una manilla.
Después nadie vuelve a pedir la cédula: basta con enseñar la manilla. La manilla
no se puede falsificar, dice a qué zona se puede entrar y sirve solo esa noche.
El JWT es eso: la contraseña se escribe una vez, en el login, y el token la
reemplaza durante una hora.

## Qué lleva el token

El payload que genera el proyecto tiene cinco claims:

| Claim | Qué es |
| ----- | ------ |
| `sub` | El id del usuario, como texto. Es el claim estándar para el sujeto |
| `email` | Correo del usuario |
| `rol` | `administrador`, `taquilla` o `asistente` |
| `iat` | Momento en que se emitió |
| `exp` | Momento en que caduca |

No lleva la contraseña ni el `passwordHash`, ni ningún otro dato del usuario.

La cabecera es `{"alg":"HS256","typ":"JWT"}`. El algoritmo está fijado en el
código al firmar, y al verificar se pasa una lista cerrada con HS256 como único
valor aceptado.

## Firmar no es cifrar

Esta es la idea que más se presta a confusión. El token va en base64, no
cifrado: cualquiera que lo tenga puede leer su contenido, sin la clave y sin
permiso. Lo comprobamos decodificando el payload a mano, con un simple
`Buffer.from(parte, "base64url")`.

Lo que impide la firma es **modificarlo**. Si se cambia un carácter del payload,
la firma deja de corresponder y la verificación falla.

De ahí salen dos reglas prácticas:

- En el token no va nada que deba permanecer secreto.
- Nunca se decide nada con `jwt.decode`, solo con `jwt.verify`.

## Las piezas nuevas

**`src/utils/jwt.util.js`**
`generarToken` firma con HS256, pone el id en `sub` y toma la duración de
`JWT_EXPIRES_IN`. `verificarToken` comprueba la firma aceptando solo HS256. Si
falta `JWT_SECRET`, lanza un error.

**`src/middlewares/auth.middleware.js`**
`autenticarJWT` lee la cabecera `Authorization`, exige el formato
`Bearer <token>`, verifica y deja en `req.usuario` el `id`, el `email` y el
`rol` que venían dentro.

**`GET /api/auth/perfil`**
Única ruta con JWT por ahora. Devuelve `req.usuario` y `req.clienteApi`, o sea
las dos identidades a la vez.

**El login** ahora responde `{ mensaje, usuario, token }`. El registro no
cambia: registrarse no es iniciar sesión.

El secreto se generó con `crypto.randomBytes(64)`, que son 128 caracteres
hexadecimales, y vive en `.env`. En `.env.example` solo va el marcador: cada
integrante genera el suyo.

## La mejora sobre el laboratorio de referencia

El PDF convierte cualquier error del bloque `try` en un 401 "Token inválido".
Eso tiene un problema: si falta `JWT_SECRET` en el servidor, el fallo es
nuestro, y responder 401 le estaría diciendo al cliente que su token está mal.
Además escondería el problema, porque un 401 no se registra como error.

Es el mismo fallo que corregimos en el Lab 2 con SAST-02: el código tiene que
decir de quién es la culpa. Así que el middleware responde 401 solo ante los
tres errores de la propia librería, `TokenExpiredError`, `JsonWebTokenError` y
`NotBeforeError`, y cualquier otro lo pasa a `next(error)`, donde `manejarError`
lo convierte en un 500 genérico y lo deja registrado en consola.

## Dos identidades que conviven

| Credencial | Pregunta que responde | Dónde viaja |
| ---------- | --------------------- | ----------- |
| `X-API-Key` | ¿Qué aplicación consume la API? | Cabecera, en todo `/api` |
| email + contraseña | ¿Quién dice ser la persona? | Cuerpo del login |
| JWT | ¿Qué persona está autenticada ahora? | `Authorization: Bearer` |
| `rol` dentro del token | Base de la autorización que vendrá | Dentro del JWT |

Son independientes. Se comprobó pidiendo `GET /api/auth/perfil` dos veces con el
mismo token y distinta API Key:

```json
{ "usuario": { "id": 1, "email": "asistente@teatro.com", "rol": "asistente" },
  "clienteApi": { "id": 1, "nombre": "Postman Laboratorio" } }

{ "usuario": { "id": 1, "email": "asistente@teatro.com", "rol": "asistente" },
  "clienteApi": { "id": 2, "nombre": "Taquilla del Teatro" } }
```

Misma persona, aplicación distinta. Y al revés: un token válido sin API Key no
pasa, porque el middleware de la clave va antes.

[Captura] Las dos peticiones a `/api/auth/perfil`, con la misma persona y
distinto cliente.

## Las pruebas

Todas contra el servidor en marcha.

| # | Prueba | Esperado | Obtenido |
| - | ------ | -------- | -------- |
| 1 | API Key + token válido | 200 | 200, usuario y clienteApi |
| 2 | Sin cabecera `Authorization` | 401 | Token de autenticación requerido |
| 3 | Token sin `Bearer` delante | 401 | Formato de token inválido |
| 4 | Esquema `Basic` en vez de `Bearer` | 401 | Formato de token inválido |
| 5 | Firma manipulada | 401 | Token inválido |
| 6 | Token firmado con otro secreto | 401 | Token inválido |
| 7 | Token caducado | 401 | Token expirado |
| 8 | Token con `alg: "none"` | 401 | Token inválido |
| 9 | Token válido pero sin API Key | 401 | API Key requerida |
| 10 | Mismo token desde otra aplicación | 200 | Mismo usuario, otro clienteApi |
| 11 | Payload editado, firma original | 401 | Token inválido |
| 12 | Caducidad real con `JWT_EXPIRES_IN=20s` | 401 tras 20 s | Token expirado |

Durante las pruebas el servidor no registró ningún error 500.

### Dos ataques que conviene distinguir

**`alg: "none"`.** El atacante quita la firma y pone en la cabecera que el token
no está firmado, esperando que la librería se crea esa cabecera. Se firmó uno
así, con `rol: "administrador"`, y la API respondió 401. Funciona porque al
verificar se pasa `algorithms: ["HS256"]`: el algoritmo lo decide el servidor,
no el token.

**Payload editado con la firma original.** Aquí el atacante no quita nada.
Toma un token legítimo, cambia el payload y deja la firma tal cual, confiando en
que nadie la revise.

```
antes:   {"email":"asistente@teatro.com","rol":"asistente","iat":…,"exp":…,"sub":"1"}
después: {"email":"asistente@teatro.com","rol":"administrador","iat":…,"exp":…,"sub":"1"}
```

La firma se reutilizó sin tocarla y la API respondió **401 Token inválido**.
`jwt.verify` lanza `JsonWebTokenError: invalid signature`, porque la firma se
calcula sobre cabecera y payload: cambiar el payload la invalida.

[Captura] El token alterado rechazado con 401.

### Decodificar no es verificar

Sobre esos dos tokens se probó `jwt.decode`, que no usa la clave:

```
jwt.decode(token válido)   -> {"email":"asistente@teatro.com","rol":"asistente", …}
jwt.decode(token alterado) -> {"email":"asistente@teatro.com","rol":"administrador", …}
```

`decode` devuelve tan contento un rol de administrador que nadie firmó. No se
queja, porque no comprueba nada: solo deshace el base64. La comprobación la hace
`verify`, y con el token alterado lanza `invalid signature`.

Por eso el middleware usa `verificarToken`, que por dentro llama a `jwt.verify`.
Un permiso decidido con `decode` sería un permiso decidido por el atacante.

[Captura] Las dos salidas de `jwt.decode` una debajo de otra.

### La caducidad

Se probó como pide el laboratorio, cambiando la variable y no fabricando un
token vencido. Con `JWT_EXPIRES_IN=20s` y el servidor reiniciado:

| Momento | Resultado |
| ------- | --------- |
| Login | 200, token emitido |
| `iat` y `exp` del token | 20 segundos de diferencia exacta |
| Perfil al instante | 200 |
| Perfil a los 25 segundos | 401 Token expirado |

Después se devolvió `JWT_EXPIRES_IN=1h` y se comprobó en un token nuevo:
`exp - iat = 3600` segundos.

El cambio exige reiniciar el servidor, porque nodemon vigila los archivos `.js`
y no el `.env`.

[Captura] La respuesta 401 "Token expirado" tras esperar los 20 segundos.

## Swagger

En `swagger.js` se añadió `BearerAuth` (`type: http`, `scheme: bearer`,
`bearerFormat: JWT`) junto a `ApiKeyAuth`. La seguridad global sigue siendo solo
la API Key.

`/api/auth/perfil` declara las dos a la vez:

```json
"security": [{ "ApiKeyAuth": [], "BearerAuth": [] }]
```

Es **un solo elemento con dos claves**, que en OpenAPI significa "las dos" (Y).
Dos elementos en la lista habrían significado "cualquiera de las dos" (O), que
no es lo que hace la API. La diferencia en el YAML es un guion y una sangría.

El token del login se documentó en un schema propio, `RespuestaLogin`, porque el
registro y el login compartían `RespuestaUsuario` y el registro no devuelve
token.

Estado del spec tras el bloque: **42 endpoints en 22 rutas, 35 schemas y 7
tags**, sin referencias rotas. Antes eran 41, 21 y 34.

[Captura] Swagger con los dos candados y el diálogo de Authorize mostrando
ApiKeyAuth y BearerAuth.

## Semgrep y npm audit

```bash
semgrep --config p/javascript --config p/nodejs --config p/owasp-top-ten src/
npm audit
```

| Herramienta | Lab 8 | Lab 9 |
| ----------- | ----- | ----- |
| Semgrep: archivos escaneados | 41 | 43 |
| Semgrep: hallazgos | 0 | 0 |
| `npm audit`: paquetes | 146 | 159 |
| `npm audit`: vulnerabilidades | 0 | 0 |

Los dos archivos nuevos son `jwt.util.js` y `auth.middleware.js`. Los 13
paquetes nuevos los trae `jsonwebtoken@9.0.3`, la segunda dependencia externa
del semestre después de bcrypt.

Nota de ejecución: en este equipo el Control de aplicaciones de Windows bloquea
`semgrep.exe`. El escaneo se lanzó con el mismo análisis a través del punto de
entrada de Python:

```bash
python -c "from semgrep.console_scripts.pysemgrep import main; main()" \
  --config p/javascript --config p/nodejs --config p/owasp-top-ten src/
```

Salidas en `sast-semgrep-lab9.txt` y `sca-npm-audit-lab9.txt`.

Las 224 pruebas automatizadas de los laboratorios anteriores siguen pasando.

## Lo que este laboratorio no resuelve

**El rol todavía no restringe nada.** Viaja dentro del token, pero ningún
endpoint lo mira para decidir. Un asistente autenticado puede llamar a lo mismo
que un administrador. Eso es autorización, y es el bloque siguiente.

**Solo una ruta pide JWT.** `GET /api/auth/perfil` existe para probar el
mecanismo aislado. El resto de la API sigue protegida únicamente por la API Key.

**No se puede revocar un token.** Mientras no caduque sigue siendo válido,
aunque el usuario se deshabilite. Revocar exigiría una lista de tokens anulados
o tokens de refresco.

**Un token conserva el rol con el que se emitió.** Si a alguien le cambian el
rol, su token viejo sigue diciendo el anterior hasta que expire. Es el precio de
que el token sea autocontenido y no haya que consultar la base de datos en cada
petición.

**`JWT_SECRET` se valida al usarse, no al arrancar.** Si falta, el servidor
arranca igual y falla en el primer login con un 500. Sería mejor que no
arrancara, como ya ocurre con las API Keys.

## Repositorio

https://github.com/JuanK2550/API-TEATRO
