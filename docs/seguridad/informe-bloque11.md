# Bloque 11 — Recuperación de acceso y reparto de credenciales

Dos cosas que parecen distintas y son la misma: dejar de confiar en lo que no
se puede verificar. Un JWT firmado no se puede retirar, y una clave que el
navegador descarga no es un secreto. El bloque arregla las dos.

Resultado: **440 pruebas, 440 correctas**, y una API Key menos en el mundo.

---

## 1. Un token que sí se puede revocar

Hasta aquí, cambiar la contraseña no servía de nada contra quien ya tuviera un
token: el servidor no los guarda y no puede invalidarlos. Si alguien sospechaba
que le habían robado la sesión y cambiaba su clave, el ladrón seguía dentro
hasta que el token caducara por su cuenta.

`usuarios.version_sesion` cierra esa ventana. Cada token lleva dentro la
versión de su dueño en el momento de firmarse. Al cambiar o restablecer la
contraseña, la versión sube en uno y todos los tokens anteriores dejan de
coincidir.

El precio es una consulta por petición autenticada: el middleware ya no se fía
del token, va a la base. A cambio **el rol y el estado de la cuenta salen de
PostgreSQL y no del JWT**, así que desactivar una cuenta o rebajar un rol surte
efecto en el acto en lugar de esperar a que el token expire. Para una API que
ya tenía RBAC, eso vale más que el ahorro de la consulta.

La columna lleva `CHECK (version_sesion >= 0)`: una versión solo avanza.

---

## 2. Dos caminos para recobrar el acceso

| Camino | Quién lo inicia | Qué dura |
| ------ | --------------- | -------- |
| Token administrativo | Un administrador, para la cuenta de otra persona | 15 minutos, un solo uso |
| Códigos de respaldo | La propia persona, con su sesión abierta | Ocho códigos, cada uno de un solo uso |

Las dos tablas guardan **hashes SHA-256, nunca el valor**. No es bcrypt a
propósito: un token son 32 bytes aleatorios y un código 16, así que adivinarlos
es inviable y bcrypt existe para resistir fuerza bruta sobre secretos que elige
una persona. Lo que importa aquí es que la tabla no contenga aquello con lo que
se restablece una contraseña.

Tres detalles que conviene no perder de vista:

- **`administrador_id` no lleva `ON DELETE CASCADE`.** Borrar a un
  administrador no debe borrar el rastro de lo que autorizó. Es lo más parecido
  a una auditoría que tiene el proyecto.
- **Generar códigos exige la contraseña actual**, no solo el token. Quien se
  sentara en una sesión abierta se llevaría ocho llaves permanentes de la
  cuenta; pedir la clave otra vez cierra esa puerta.
- **Los errores no distinguen casos.** Un token inexistente, usado, vencido o
  de una cuenta desactivada responden igual, y un código inválido responde lo
  mismo que un correo que no existe. Distinguirlos serviría para averiguar qué
  cuentas están registradas.

Emitir un token anula los anteriores de esa cuenta, y consumir uno anula
también los códigos de respaldo sin usar: quien perdió el acceso no debe
conservar otra vía de entrada.

---

## 3. Lo que la guía no resolvía: los permisos

Los scripts de la guía crean las tablas, activan RLS y revocan a `PUBLIC`,
`anon` y `authenticated`. Ahí terminan, y les basta: en ese proyecto el pool se
conecta **como dueño de las tablas y con `BYPASSRLS`**, así que lo que las
políticas digan da igual.

Aquí la API entra con `api_teatro`, que no es dueño y no omite RLS. Copiar esos
scripts tal cual habría dejado dos tablas que la API **no puede usar**:
*permission denied* al escribir, cero filas al leer. Hicieron falta tres cosas
más por tabla:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON <tabla> TO api_teatro;
GRANT USAGE, SELECT ON SEQUENCE <tabla>_id_seq TO api_teatro;
CREATE POLICY api_teatro_total ON <tabla> FOR ALL TO api_teatro
  USING (TRUE) WITH CHECK (TRUE);
```

Y se revoca además a `service_role`, que la guía no menciona y que en Supabase
recibe permisos por omisión sobre todo objeto nuevo de `public`.

Comprobado como `api_teatro`: los cuatro verbos funcionan sobre las dos tablas.
Comprobado con `SET ROLE`: `anon`, `authenticated` y `service_role` reciben
`42501` en las dos.

### La verificación que de verdad importa

La guía advierte que tener RLS activado no demuestra que se aplique, y que hay
que comprobarlo **desde el mismo pool de la API**, no desde una consola. Hecho:

| | |
| --- | --- |
| Usuario SQL | `api_teatro` |
| Superusuario | `false` |
| `rolbypassrls` | **`false`** |
| Tablas con RLS | 11 de 11 |
| Tablas de las que el rol es dueño | 0 |
| Políticas, todas a `api_teatro` | 11 |

Donde la guía deja un hallazgo pendiente, aquí la respuesta es la contraria: las
políticas se evalúan.

---

## 4. El navegador deja de llevar una clave

Durante varios bloques `GET /sala/config.js` entregaba al navegador la clave
del cliente «Aplicación Web». Nunca estuvo escrita en el repositorio, lo cual
sonaba prudente y no cambiaba el fondo: el navegador tenía que enviarla en cada
petición, así que cualquiera la leía en el inspector.

Una clave así no protege nada. Lo único que hacía era obligar a tratarla como
un secreto y a servirla por una ruta dedicada.

### El reparto nuevo

| Capa | Rutas | Por qué |
| ---- | ----- | ------- |
| **Público** | `POST /auth/login`, `POST /auth/registro`, nueve `GET` del catálogo | No contienen un dato personal, y quien entra o se registra aún no tiene credenciales |
| **Solo JWT** | `/auth/perfil`, `/cambiar-password`, `/recuperacion/{id}`, `/codigos-recuperacion*`, asistentes, boletas, usuarios y las escrituras del catálogo | Lo que es de alguien necesita saber quién pregunta |
| **Solo API Key** | `/seguridad/cliente`, `/restablecer-password`, `/restablecer-con-codigo` | Integraciones sin sesión que no corren en un navegador |

El catálogo es la cartelera: títulos, fechas, horas, precios y qué butacas
quedan. Abrirlo no regala nada que no esté ya en la puerta del teatro. Pero se
abrió con tres condiciones, no a ciegas:

- **La ocupación devuelve solo `localidadId`, `fila` y `numero`.** Ni de quién
  es la boleta, ni su código, ni su identificador.
- **Lo inactivo no se anuncia.** Un evento desactivado responde 404 al público
  y 200 al mostrador; una función solo aparece en `en_venta`, `agotada` o
  `en_curso`.
- **Las escrituras siguen pidiendo JWT de administrador**, sin excepción.

Lo decide `sesionOpcional`: reconoce el token si viene y **nunca responde 401**.
En una ruta pública un token caducado no es un error, es ausencia de sesión.

### El registro también quedó público

La guía lo deja con API Key. Aquí no se podía: la Sala registra cuentas desde
el navegador, y quitarle la clave sin más habría roto el alta de usuarios sin
que nada lo avisara. Se trata como el login.

El rol lo sigue poniendo el servidor. El validador no declara el campo, así que
`matchedData` lo descarta: se pide `rol: "administrador"` y la cuenta queda
como `asistente`.

### Y la clave vieja se retiró

El cliente 4 está **desactivado**. No estorbaba: estuvo a la vista durante
meses y hay que darla por conocida. Una clave quemada no se guarda por si
acaso.

Comprobado: con esa clave, `/seguridad/cliente` y las dos rutas de
restablecimiento responden **403 «API Key deshabilitada»**, mientras un cliente
activo sigue entrando con 200.

### Lo que queda pendiente

`/restablecer-password` y `/restablecer-con-codigo` siguen pidiendo API Key.
Quien las usa perdió el acceso y no tiene JWT, y hoy nadie las llama desde el
navegador. Cuando exista la interfaz de página única habrá que decidir: o se
abren apoyándose en el límite de peticiones y en que el token y el código son
de un solo uso, o se resuelven fuera del navegador. **No se tocan ahora**
porque aflojar una puerta sin una necesidad que lo pida es empeorar gratis.

---

## 5. Los límites dejan de ser adorno

Login y registro **no tenían ninguno**. Mientras exigían API Key, eso se notaba
menos: había que tener una clave válida para siquiera intentarlo. Ahora que son
públicos, el límite es la única barrera contra probar contraseñas o crear
cuentas en masa.

| Variable | Servicio | Alcance |
| -------- | -------- | ------- |
| `RATE_LIMIT_MAX` | 100 | Todo `/api` |
| `RATE_LIMIT_ACCESO_MAX` | 10 | Login y registro |
| `RATE_LIMIT_RECUPERACION_MAX` | 10 | Las rutas de recuperación |

Los tres se suben por entorno para las baterías, nunca editando el código: un
`100000` escrito a mano es justo el cambio que se queda olvidado en el
repositorio. Cerrar la terminal restablece el valor.

---

## 6. La salvaguarda del proyecto

Existe por un accidente real: unos scripts de otro esquema se ejecutaron contra
este proyecto y se llevaron por delante las nueve tablas. Una cadena de
conexión no dice a qué proyecto pertenece, y pegar la equivocada en el `.env`
no da ningún aviso hasta que ya no hay nada.

`scripts/comprobar-proyecto.js` compara una huella SHA-256 del host y del
usuario contra la registrada en `database/huella-proyecto.json`. La llaman
`pruebas/correr.sh` y **`preparar-base.js`, antes de abrir la conexión**:
comprobar después del primer `DROP` no serviría de nada.

Con la cadena de otro proyecto aborta con código 1 y no ejecuta una sola
sentencia. La huella no contiene host, usuario, referencia ni contraseña: solo
el resumen. Se hace del host y del usuario, no de la contraseña, para que
rotarla no invalide la huella pero cambiar de proyecto sí.

---

## 7. Las pruebas

**440 de 440.**

| Batería | Pruebas | Qué cubre |
| ------- | ------- | --------- |
| `pruebas.js` · `pruebas-funciones.js` · `pruebas-boletas.js` | 170 | Los recursos y sus reglas |
| `pruebas-limites.js` · `pruebas-cuenta.js` | 44 | Límites del cuerpo y gestión de la cuenta |
| `pruebas-autorizacion.js` | 104 | RBAC y BOLA/IDOR |
| `pruebas-recuperacion.js` | 44 | Versión de sesión y los dos caminos de recuperación |
| `pruebas-bloque11.js` | 35 | Las del paso 8, incluido el reparto nuevo |
| `pruebas-acceso.js` | 5 | El límite de login y registro |
| `verificar-a/b/c.js` | 38 | El repaso del enunciado original |

`pruebas-acceso.js` va aparte porque necesita el límite real; las demás lo
suben por entorno, ya que hacen decenas de inicios de sesión legítimos y si no
agotarían la cuota.

### Pruebas que hubo que ajustar

| Prueba | Antes | Ahora | Por qué |
| ------ | ----- | ----- | ------- |
| Paso 8, 22 | 401 | **400** | El login es público: llega al validador en vez de morir en la puerta |
| Paso 8, 24 | 401 | **200** | Los recursos con sesión ya no piden API Key |
| Paso 8, 25 | `ApiKeyAuth+BearerAuth` | login sin seguridad, recurso `BearerAuth`, cliente `ApiKeyAuth` | Swagger declara lo que la API exige de verdad |
| «`GET /api/eventos` sin API Key responde 401» | 401 | **200** | La cartelera es pública. El caso se reescribió para comprobar eso |
| «Leer una boleta sin `X-API-Key` es 401» | 401 | **401** | El código no cambia, pero ahora lo rechaza el JWT. Solo se corrigió el texto |

Y tres fechas de `verificar-a.js` que iban escritas a mano caducaron: la regla
de «la fecha no puede estar en el pasado» empezó a rechazarlas sin que nada se
hubiera roto. Ahora se cuentan desde hoy.

---

## 8. Lo que este bloque no resuelve

- **El registro sigue pidiendo 10 caracteres sin exigir complejidad**, mientras
  las contraseñas nuevas de recuperación piden 12 con mayúscula, minúscula y
  número. Recuperar el acceso es más exigente que abrir la cuenta. Endurecer el
  registro cambiaría el contrato de un endpoint ya documentado y probado.
- **No hay auditoría más allá de `administrador_id`.** Se sabe quién autorizó
  una recuperación, no quién cambió un rol ni cuándo.
- **El bloqueo asesor solo coordina el bootstrap.** No protege otros caminos
  que inserten administradores.
- **Las dos rutas de restablecimiento no están listas para un navegador**, como
  se explica arriba.
- **La consulta por petición autenticada tiene un coste** que hoy no se mide.
  Con el tráfico de un laboratorio no se nota; con tráfico real habría que
  decidir si se cachea la versión de sesión y durante cuánto.

---

*API_TEATRO · Bloque 11 · Recuperación de acceso y reparto de credenciales*
