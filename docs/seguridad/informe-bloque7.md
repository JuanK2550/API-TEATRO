# Bloque 7 — Supabase y PostgreSQL: persistencia de API_TEATRO

## De dónde venimos

Hasta el bloque 6 la API tenía todas sus defensas puestas: API Key para saber
qué aplicación entra, JWT para saber quién es la persona, RBAC para decidir qué
puede hacer su rol y tres guardas de propiedad para decidir sobre qué registros.

Y debajo de todo eso, arreglos de JavaScript. Cerrar la terminal borraba el
teatro entero: los eventos, las funciones, las boletas vendidas y hasta los
usuarios registrados. Cada arranque volvía a los datos semilla.

Este bloque cambia el suelo sin tocar las paredes. Las rutas, los validadores,
`matchedData`, el RBAC y las guardas de propiedad siguen siendo exactamente los
mismos archivos. Lo único que cambia es de dónde salen los datos.

---

## Lo que se hizo, en dos commits

| Commit | Qué trae |
| ------ | -------- |
| `9db8fce` | La base, la conexión y los seis services migrados |
| `c205401` | El rol de privilegio mínimo y las políticas RLS |

30 archivos, 3149 líneas añadidas y 756 retiradas.

### Archivos nuevos

```
database/01_esquema_teatro.sql     las nueve tablas
database/02_roles_seguridad.sql    los tres roles, RLS y REVOKE
database/03_verificacion.sql       siete consultas de comprobación
database/04_datos_semilla.sql      los datos, generados desde src/data/
database/05_rol_aplicacion.sql     el rol api_teatro y sus políticas
database/README.md                 cómo se monta y por qué
src/config/database.js             el pool con TLS
scripts/preparar-base.js           monta la base entera
scripts/probar-conexion.js         comprueba conexión, cifrado y RLS
scripts/crear-rol-aplicacion.js    crea el rol y su contraseña
```

---

## El modelo relacional

Nueve tablas: `roles`, `usuarios`, `eventos`, `localidades`, `funciones`,
`funcion_tarifas`, `funcion_descuentos`, `asistentes` y `boletas`.

### Lo que era un arreglo anidado y ahora es una tabla

En memoria, una función llevaba sus tarifas y sus descuentos dentro:

```js
{
  id: 1, eventoId: 1, fecha: "2027-02-18", hora: "19:00",
  tarifas: [{ localidadId: 1, precio: 75000 }, …],
  descuentosHabilitados: ["estudiante", "infantil"]
}
```

Eso no se puede guardar así en una base relacional sin perder lo que lo hace
útil. Se partió en `funcion_tarifas` y `funcion_descuentos`, y la decisión paga
sola: la clave primaria compuesta `(funcion_id, localidad_id)` **hace imposible**
dos tarifas para la misma localidad, que era la regla 6 del proyecto. Antes la
vigilaba el controlador; ahora no hay camino por el que se pueda violar.

### El id del usuario no es el id del asistente

Son recursos distintos. `usuarios.id` identifica una cuenta que inicia sesión;
`asistentes.id` identifica a una persona que compra. El vínculo es
`asistentes.usuario_id`, que es `UNIQUE` y admite `NULL`:

- `NULL` → lo registró la taquilla, no tiene cuenta.
- Con valor → esa cuenta, y solo esa, está ligada a ese asistente.

El `UNIQUE` es la regla de asociación única del bloque 6C, ahora en la base.

---

## Siete reglas de negocio que bajaron a la base

| Regla | Cómo se garantiza ahora |
| ----- | ----------------------- |
| **Sala única**: no hay dos funciones a la misma fecha y hora | Índice único parcial `uq_funciones_sala` |
| **Butaca no repetida** | Índice único parcial `uq_boletas_butaca` |
| Una boleta solo en una localidad **con tarifa** en esa función | Clave foránea compuesta `fk_boletas_tarifa` |
| `capacidad = filas × butacas_por_fila` | Columna generada `GENERATED ALWAYS … STORED` |
| Listas blancas de `tipo`, `clasificacion_edad`, `estado`, `tipo_descuento` | Restricciones `CHECK` |
| Formato del código de boleta `BOL-AAAA-NNNN` | `CHECK` con expresión regular |
| Documento, correo, código de localidad y `orden` únicos | `UNIQUE` |

### Por qué los índices son parciales

Los dos primeros llevan `WHERE estado <> 'cancelada'`. No es un detalle: en el
teatro, una función cancelada **libera su franja horaria** y una boleta
cancelada **libera su butaca**, que se puede revender. El `WHERE` reproduce
exactamente lo que hacían `funcionTieneConflicto()` y `butacaOcupada()`.

Y cierran algo que el código no podía: con un arreglo en memoria, dos peticiones
simultáneas por la misma butaca podían pasar las dos la comprobación antes de
que ninguna escribiera. Un índice único no deja que eso ocurra.

### Lo que no bajó, y por qué

La coherencia de precios por cercanía al escenario compara todos los pares de
localidades y es más clara donde está. El límite de seis boletas por asistente y
función necesitaría un disparador. La máquina de estados decide qué cambio se
permite, que es una regla distinta de qué valores existen: los valores sí los
vigila un `CHECK`.

---

## La conexión

`src/config/database.js` abre un pool con TLS y `rejectUnauthorized: true`.

La autoridad que valida el certificado del servidor sale de `certs/prod-ca-2021.crt`
si está descargado, y si no, de las que ya trae Node. **En ningún caso se
desactiva la verificación.** Poner `rejectUnauthorized: false` hace que la
conexión funcione y, a cambio, acepta igual de bien a un intermediario que al
servidor legítimo: cifrar sin comprobar con quién se habla no protege de nada.

Durante el montaje apareció `SELF_SIGNED_CERT_IN_CHAIN`, porque el endpoint
directo de Supabase usa su propia autoridad y no una pública. Se resolvió
descargando ese certificado, que es público, no bajando la verificación.

### Un pool, no una conexión por petición

Abrir una conexión TLS cuesta, y el plan gratuito de Supabase limita cuántas
puede haber a la vez. El pool las reutiliza. También hay un oyente de errores:
una conexión inactiva puede caerse, y sin ese oyente el error llegaría a
`process` y tumbaría el servidor.

---

## Los services

Los seis migraron. Cada función conserva su nombre y lo que devuelve; lo único
que cambió es que ahora son asíncronas.

| Service | Antes | Ahora |
| ------- | ----- | ----- |
| `localidades` | 159 líneas | 209 |
| `eventos` | 127 | 168 |
| `asistentes` | 142 | 193 |
| `usuarios` | 188 | 198 |
| `funciones` | 242 | 402 |
| `boletas` | 365 | 495 |

De `src/data/` solo sigue vivo `apiKeys.js`, porque las claves de los clientes
se comparan por hash en memoria y no son datos del teatro.

### Las equivalencias

| En memoria | En PostgreSQL |
| ---------- | ------------- |
| `const eventos = require("../data/eventos")` | `const { consultar } = require("../config/database")` |
| `eventos.find(e => e.id === Number(id))` | `SELECT … WHERE id = $1` |
| `datos.nombre ?? actual.nombre` | `COALESCE($2, nombre)` |
| `eventos.push(nuevo)` | `INSERT … RETURNING` |
| `eventos.splice(indice, 1)` | `DELETE … RETURNING` |

Los parámetros van siempre separados del SQL. `pg` sustituye `$1`, `$2`… del
lado del servidor, así que ningún valor se concatena en la consulta: es la
protección contra inyección SQL, y es el motivo por el que en este proyecto no
se arma SQL con plantillas de texto.

---

## Tres cosas que la migración obligó a resolver

Ninguna se vio leyendo el código. Las tres aparecieron al ejecutar.

### 1. El controlador de PostgreSQL cambia los tipos

`pg` entrega los `BIGINT` como **texto**, porque un entero de 64 bits puede
superar lo que un `number` de JavaScript representa sin perder precisión. Y
convierte `DATE` y `TIME` a objetos `Date`.

El efecto sobre el contrato de la API habría sido:

| La API devolvía | Habría devuelto |
| --------------- | --------------- |
| `"id": 1` | `"id": "1"` |
| `"1995-03-14"` | `"1995-03-14T00:00:00.000Z"` |
| `"19:00"` | `"19:00:00"` |

Se fijan tres analizadores de tipo en `database.js` y se recortan los segundos
de la hora en el mapeo. La fecha de una función es la del teatro, no un instante
universal: arrastrar una zona horaria habría sido incorrecto, no solo feo.

### 2. Escribir una función toca tres tablas

Guardar una función escribe en `funciones`, `funcion_tarifas` y
`funcion_descuentos`. Va dentro de una transacción: sin ella, un fallo a mitad
dejaría una función sin tarifas, que es un estado que las reglas del teatro no
admiten.

### 3. Un `SELECT` junto a un `UPDATE` no ve el cambio

Al devolver una función después de cambiarle el estado, la respuesta traía el
estado anterior aunque en la base quedaba bien guardado. En PostgreSQL, el
`SELECT` que acompaña a un `WITH` que modifica datos trabaja sobre la foto
previa a la escritura. La fila actualizada se toma del propio `RETURNING`.

### Y una cuarta, al pasar los controladores a asíncronos

Convertir seis controladores a `async`/`await` son cientos de cambios, y un
`await` olvidado no falla: deja una promesa donde se esperaba un objeto, y la
comprobación pasa como si todo estuviera bien.

El primer intento con expresiones regulares marcó como `async` funciones que no
debían serlo —y una función `async` devuelve una promesa, así que `datos.email`
habría sido `undefined`—. Se rehizo recorriendo el árbol sintáctico con un
parser. Aun así quedaron dos casos que solo aparecieron al ejecutar:

- `await servicio.obtener().filter(…)` espera el resultado de `.filter`, no el
  de la consulta, porque `await` se aplica a toda la expresión.
- `.map(async …)` devuelve un array de promesas. Sin `Promise.all`, comparar un
  campo sobre una promesa no falla: da `undefined`, y la regla 8 habría pasado
  siempre sin comprobar nada.

---

## El rol de la aplicación

Al principio la API se conectaba con el dueño de las tablas. Al revisarlo:

```
rol de conexión : postgres
rolbypassrls    : true
dueño de boletas: postgres
```

Eso tenía dos consecuencias, y la segunda es la importante:

1. Si la cadena de conexión se filtraba, quien la tuviera podía hacer
   `DROP TABLE`, no solo leer datos.
2. **Row Level Security quedaba desactivado de hecho.** El dueño de una tabla no
   pasa por las políticas, y ese rol además traía `BYPASSRLS`. Escribir políticas
   sin cambiar esto habría sido teatro: saldrían en el informe sin filtrar una
   sola fila.

`05_rol_aplicacion.sql` crea `api_teatro`: sin superusuario, sin `BYPASSRLS`, sin
`CREATE` sobre el esquema, y con `SELECT` solamente sobre `roles`, que se siembra
una vez y no se toca desde la aplicación.

Ahora hay dos credenciales:

| Variable | Rol | Para qué |
| -------- | --- | -------- |
| `DATABASE_URL` | `api_teatro` | La que usa la API |
| `DATABASE_URL_ADMIN` | el dueño | Crear o reiniciar la base |

### Row Level Security

RLS está activo en las nueve tablas. Cada una tiene una política para
`api_teatro`. Como RLS **niega por defecto** a quien no tiene política, `anon`,
`authenticated` y cualquier rol futuro ven cero filas aunque alguien les conceda
un `GRANT` por descuido: ya no dependen solo del `REVOKE`.

### Por qué la política dice `TRUE`

Porque quién puede ver qué fila lo decide Express: `autorizarRoles` mira el rol
del JWT y las guardas de `propiedad.middleware.js` comprueban que la boleta o el
asistente sean de quien pregunta. La API necesita poder leer cualquier fila
**precisamente para poder responder "403, esa no es tuya"**.

Para que una política dijera "solo las filas de este usuario", PostgreSQL
tendría que saber quién es el usuario, y hoy esa identidad vive en nuestro JWT,
no en la sesión de la base.

---

## Cómo se comprobó

### El esquema, contra PostgreSQL real

Los scripts se ejecutaron contra un PostgreSQL 16 antes de llevarlos a Supabase,
y se comprobó que las restricciones rechazan de verdad lo que deben:

| Intento | Resultado |
| ------- | --------- |
| Dos funciones a la misma fecha y hora | Rechazado: `uq_funciones_sala` |
| La misma franja, pero la nueva cancelada | Permitido |
| Repetir la butaca de una boleta viva | Rechazado: `uq_boletas_butaca` |
| Boleta en una localidad sin tarifa en esa función | Rechazado: `fk_boletas_tarifa` |
| Código de boleta con formato inválido | Rechazado: `ck_boletas_codigo` |
| Tipo de evento fuera de la lista blanca | Rechazado: `ck_eventos_tipo` |
| Dos asistentes ligados a la misma cuenta | Rechazado: `asistentes_usuario_id_key` |
| `orden` de localidad repetido | Rechazado: `localidades_orden_key` |

Los conteos de la semilla coinciden fila por fila con `src/data/`: 11 eventos,
3 localidades, 16 funciones, 48 tarifas, 29 descuentos, 5 asistentes y
7 boletas.

### Los límites del rol de aplicación

| Intento desde `api_teatro` | Resultado |
| -------------------------- | --------- |
| Leer eventos, boletas y roles | permitido |
| Insertar y borrar un evento | permitido |
| `DROP TABLE boletas` | *must be owner of table* |
| `CREATE TABLE` | *permission denied for schema public* |
| `ALTER TABLE … ADD COLUMN` | *must be owner of table* |
| `UPDATE roles` | *permission denied for table roles* |
| `DISABLE ROW LEVEL SECURITY` | *must be owner of table* |
| Leer `pg_authid` (contraseñas) | *permission denied* |

### Que las políticas se aplican de verdad

Se quitó la política de `eventos` y el rol pasó a ver **0 filas**; al devolverla,
volvió a ver las 12. Antes del cambio de rol, la misma prueba habría dado 12 en
los dos casos.

### Las pruebas

**356 comprobaciones, 0 fallos**, en nueve baterías.

| Batería | Comprobaciones |
| ------- | -------------- |
| `pruebas.js` | 57 |
| `pruebas-funciones.js` | 58 |
| `pruebas-boletas.js` | 55 |
| `pruebas-limites.js` | 22 |
| `pruebas-cuenta.js` | 22 |
| `pruebas-autorizacion.js` | 104 |
| `verificar-a.js`, `-b.js`, `-c.js` | 16 + 16 + 6 |

Hay un cambio en cómo se corren, y es consecuencia directa del éxito del bloque:
**reiniciar Node ya no devuelve los datos semilla**. Antes bastaba con levantar
el servidor de nuevo; ahora hay que reiniciar la base:

```bash
node scripts/preparar-base.js --reiniciar
```

### La Sala

Se recorrió completa como asistente —cartelera, plano de butacas, compra, pago
simulado, "Mis boletas" y cancelación— en 1440 y en 390 píxeles. El frontend no
necesitó un solo cambio, que era la prueba de que el contrato de la API se
respetó.

### Y la prueba que da sentido a todo el bloque

Se creó un evento, se mató el servidor, se volvió a levantar y el evento seguía
ahí. El segundo arranque ya no imprimió «Administrador inicial creado», porque
la cuenta estaba en la base.

---

## Lo que este bloque no resuelve

**Supabase Auth.** La columna `usuarios.auth_user_id` existe y está vacía: las
contraseñas siguen en `password_hash` con bcrypt y el login sigue emitiendo
nuestro propio JWT. Integrarlo exige la clave `service_role` y sustituir el
login, con lo que se rehace el trabajo de los laboratorios 9 y 10.

**Políticas RLS por propiedad.** Hoy dicen `TRUE`. Para filtrar por usuario en
la base hay dos caminos, ninguno gratis:

- **Supabase Auth**, con `auth.uid()` en las políticas.
- **Una variable de sesión** por petición (`SET LOCAL`), con las políticas
  leyendo `current_setting`. No rompe la arquitectura actual, pero obliga a que
  cada consulta vaya dentro de una transacción con esa variable puesta.

**El límite de seis boletas y la coherencia de precios** siguen en el código.

**No hay migraciones versionadas.** Un cambio de esquema hoy se aplica a mano.
Con el proyecto creciendo convendría una herramienta que lleve la cuenta.

**No hay copias de seguridad propias.** Se depende de las que haga Supabase.

---

## Lo que nos llevamos

Que una restricción en la base y una comprobación en el código no son lo mismo
aunque digan lo mismo. El controlador comprueba y después escribe; entre esas
dos cosas puede pasar algo. Un índice único no tiene ese hueco.

Que las herramientas cambian los datos por el camino. Un `BIGINT` que vuelve
como texto no rompe nada ruidosamente: rompe un `===` seis capas más arriba.

Y que una medida de seguridad que no se comprueba puede ser peor que no tenerla,
porque ocupa el lugar de la que sí habría servido. Las políticas RLS escritas
sobre un rol que se las salta habrían quedado muy bien en el informe.

---

## Repositorio

https://github.com/JuanK2550/API-TEATRO
