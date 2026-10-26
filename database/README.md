# Base de datos — API_TEATRO

Esquema relacional del Teatro Maldonado de Tunja en Supabase PostgreSQL.

Hasta el bloque 6 los datos vivían en arreglos de `src/data/` y desaparecían al
reiniciar Node. Este bloque los traslada a una base real, **sin tocar las rutas,
los validadores, los controladores ni los controles de seguridad** que ya
funcionan: la API Key, el JWT, el RBAC y las guardas de propiedad siguen
exactamente igual.

---

## 1. Qué hay en esta carpeta

| Archivo | Para qué | ¿Modifica datos? |
| ------- | -------- | ---------------- |
| `01_esquema_teatro.sql` | Crea las nueve tablas, los índices y las restricciones | Sí |
| `02_roles_seguridad.sql` | Siembra los tres roles, activa RLS y retira el acceso de `anon` y `authenticated` | Sí |
| `03_verificacion.sql` | Siete consultas de comprobación | No |
| `04_datos_semilla.sql` | Los mismos datos semilla que `src/data/` | Sí |

`01` y `04` **no son idempotentes**: usan `CREATE TABLE` e `INSERT` con
identificadores explícitos. Se ejecutan sobre un proyecto nuevo.

---

## 2. Crear el proyecto en Supabase

1. Entrar a [Supabase Dashboard](https://supabase.com/dashboard) e iniciar sesión.
2. **New project**, en la organización correspondiente.
3. Nombre del proyecto: **`apiteatro`**.
4. Contraseña de PostgreSQL: **robusta, única y distinta** de la del
   administrador de la aplicación. No es la misma cosa: una protege el usuario
   de conexión a la base, la otra es una cuenta del teatro.
5. Región cercana al backend.
6. En **Seguridad** del formulario:

| Opción | Valor | Por qué |
| ------ | ----- | ------- |
| Habilitar la API de datos | **Activado** | Permite usar la API de Supabase si hiciera falta. No implica acceso público: siguen mandando los privilegios SQL y las políticas RLS. |
| Exponer automáticamente nuevas tablas | **Desactivado** | Una tabla nueva no queda expuesta por descuido. Los permisos se revisan a mano. |
| Habilitar RLS automático | **Activado** | Toda tabla nueva nace con Row Level Security. `02` lo vuelve a activar de forma explícita para las nueve. |

7. Crear el proyecto y esperar a que esté disponible.

**Nunca** guardar en Git ni en el frontend: contraseñas de la base, la URI de
conexión completa, ni la clave `service_role`.

---

## 3. Orden de ejecución

En **SQL Editor → New query**, uno por uno y en este orden:

1. `01_esquema_teatro.sql` — comprobar en **Table Editor** que existan nueve tablas.
2. `02_roles_seguridad.sql` — comprobar los tres roles y RLS activo.
3. `04_datos_semilla.sql` — los datos de prueba.
4. `03_verificacion.sql` — las siete comprobaciones.

Al terminar, `03` debe mostrar: tres roles, nueve tablas, `rls_habilitado = true`
en las nueve, diez claves foráneas, los dos índices únicos parciales, las
restricciones `CHECK` y `capacidad` como columna generada.

### Después de preparar la base: el administrador

La tabla `usuarios` queda vacía a propósito. El primer administrador no viene en
los datos semilla ni lo crea el arranque de la API: se crea con un paso
explícito, desde la raíz del proyecto.

```bash
node scripts/preparar-base.js --reiniciar
npm run seed:admin
```

`seed:admin` lee `ADMIN_NOMBRE`, `ADMIN_EMAIL` y `ADMIN_PASSWORD` del `.env`, y
es idempotente: si ya existe cualquier cuenta con rol `administrador` —aunque
esté inactiva— no inserta ni modifica nada. Tampoco convierte en administradora
una cuenta de otro rol, aunque se le pase su correo.

Sin este paso las baterías de pruebas fallan al iniciar sesión, porque todas
necesitan el administrador para las operaciones de escritura.

---

## 4. Modelo de datos

| Tabla | Qué guarda | Relaciones |
| ----- | ---------- | ---------- |
| `roles` | Los tres roles de negocio | — |
| `usuarios` | La identidad: quién inicia sesión | → `roles`, → `auth.users` |
| `eventos` | La programación | — |
| `localidades` | Las zonas de la única sala | — |
| `funciones` | Un evento en una fecha y hora | → `eventos` |
| `funcion_tarifas` | El precio de cada localidad en cada función | → `funciones`, → `localidades` |
| `funcion_descuentos` | Qué descuentos admite cada función | → `funciones` |
| `asistentes` | El público, con su vínculo opcional a una cuenta | → `usuarios` |
| `boletas` | La venta | → `asistentes`, `funciones`, `localidades`, `funcion_tarifas` |

### Lo que era un arreglo y ahora es una tabla

En memoria, una función llevaba dentro sus tarifas y sus descuentos:

```js
{ id: 1, eventoId: 1, tarifas: [{ localidadId: 1, precio: 75000 }, …],
  descuentosHabilitados: ["estudiante", "infantil"] }
```

En PostgreSQL eso se parte en `funcion_tarifas` y `funcion_descuentos`. No es
un capricho: la clave primaria compuesta `(funcion_id, localidad_id)` **impide**
dos tarifas para la misma localidad, que es la regla 6 del proyecto. Antes la
vigilaba el controlador; ahora no hay forma de violarla desde ningún camino.

### El id del usuario no es el id del asistente

Son recursos distintos. `usuarios.id` identifica una cuenta que inicia sesión;
`asistentes.id` identifica a una persona que compra. El vínculo es
`asistentes.usuario_id`, que es `UNIQUE` y admite `NULL`:

- `NULL` → lo registró la taquilla, no tiene cuenta.
- Con valor → esa cuenta y solo esa está ligada a ese asistente.

---

## 5. Reglas de negocio que ahora vigila la base

Siete de las reglas del proyecto dejan de depender solo del código:

| Regla | Cómo se garantiza |
| ----- | ----------------- |
| **Sala única**: no hay dos funciones a la misma fecha y hora | Índice único parcial `uq_funciones_sala`, con `WHERE estado <> 'cancelada'` |
| **Butaca no repetida** | Índice único parcial `uq_boletas_butaca` |
| Una boleta solo en una localidad **con tarifa** en esa función | Clave foránea compuesta `fk_boletas_tarifa` |
| `capacidad = filas × butacas_por_fila` | Columna generada `GENERATED ALWAYS … STORED` |
| Listas blancas de `tipo`, `clasificacion_edad`, `estado`, `tipo_descuento` | Restricciones `CHECK` |
| Formato del código de boleta `BOL-AAAA-NNNN` | `CHECK` con expresión regular |
| Documento, correo, código de localidad y `orden` únicos | `UNIQUE` |

Los dos índices parciales merecen una nota: una función **cancelada** libera su
franja horaria y una boleta **cancelada** libera su butaca. El `WHERE` reproduce
exactamente lo que hacían `funcionTieneConflicto()` y `butacaOcupada()` en los
services, y además cierra una condición de carrera que Node no podía evitar
sobre un arreglo: dos peticiones simultáneas por la misma butaca ya no pueden
ganar las dos.

Lo que **no** baja a la base y sigue en el service: la coherencia de precios por
cercanía al escenario (compara todos los pares de localidades), la máquina de
estados y el límite de seis boletas por asistente y función.

---

## 6. Roles y permisos

Los roles de negocio del teatro viven en `public.roles` y **no son** los roles
de acceso de Supabase (`anon`, `authenticated`, `service_role`).

| Recurso / acción | Administrador | Taquilla | Asistente |
| ---------------- | ------------- | -------- | --------- |
| Gestionar usuarios | Sí | No | No |
| Crear, modificar o eliminar eventos, localidades y funciones | Sí | No | No |
| Consultar la cartelera | Público | Público | Público |
| Gestionar asistentes | Sí | Crear y consultar | Solo su perfil |
| Consultar toda la boletería | Sí | No | No |
| Consultar boletas de un asistente | Sí | Sí | Solo las suyas |
| Comprar una boleta | Sí | Sí | Sí, a su nombre |
| Pagar o cancelar una boleta | Sí | Sí | Solo las suyas |
| Marcar una boleta como usada | Sí | Sí | No |

Es la misma tabla del bloque 6, que no cambia con la migración.

---

## 7. El rol de la aplicación y Row Level Security

### Dos credenciales, no una

| Variable | Rol | Para qué | Qué puede hacer |
| -------- | --- | -------- | --------------- |
| `DATABASE_URL` | `api_teatro` | La que usa la API | Leer y escribir datos en las nueve tablas |
| `DATABASE_URL_ADMIN` | el dueño | Crear o reiniciar la base | Todo |

Al principio la API se conectaba con el dueño de las tablas. Eso tenía dos
consecuencias, y la segunda es la que importa aquí:

1. Si la cadena de conexión se filtraba, quien la tuviera podía hacer
   `DROP TABLE`, no solo leer datos.
2. **Row Level Security quedaba desactivado de hecho.** El dueño de una tabla
   no pasa por las políticas, y aquel rol además traía `BYPASSRLS`. Escribir
   políticas sin cambiar eso habría sido teatro: aparecerían en el informe sin
   filtrar nada.

`05_rol_aplicacion.sql` crea `api_teatro` sin superusuario, sin `BYPASSRLS`, sin
`CREATE` sobre el esquema y con `SELECT` solamente sobre `roles`, que se siembra
una vez y no se toca desde la aplicación.

### Qué se comprobó

| Intento desde `api_teatro` | Resultado |
| -------------------------- | --------- |
| Leer eventos, boletas y roles | permitido |
| Insertar y borrar un evento | permitido |
| `DROP TABLE boletas` | rechazado: *must be owner of table* |
| `CREATE TABLE` | rechazado: *permission denied for schema public* |
| `ALTER TABLE … ADD COLUMN` | rechazado: *must be owner of table* |
| `UPDATE roles` | rechazado: *permission denied for table roles* |
| `DISABLE ROW LEVEL SECURITY` | rechazado: *must be owner of table* |
| Leer `pg_authid` (contraseñas) | rechazado: *permission denied* |

### Las políticas ahora sí se aplican

Con el rol nuevo, RLS deja de ser decorativo. La prueba: se quitó la política de
`eventos` y el rol pasó a ver **0 filas**; al devolverla, volvió a ver las 12.

Cada tabla tiene una política para `api_teatro`. `anon`, `authenticated` y
cualquier rol futuro siguen sin ver nada, porque RLS **niega por defecto** a
quien no tiene política: ya no dependen solo del `REVOKE` de `02`.

### Por qué la política dice `TRUE`

Porque quién puede ver qué fila lo decide Express: `autorizarRoles` mira el rol
del JWT y las tres guardas de `propiedad.middleware.js` comprueban que la boleta
o el asistente sean de quien pregunta. La API necesita poder leer cualquier fila
precisamente para poder responder *"403, esa no es tuya"*.

Para que una política dijera "solo las filas de este usuario", PostgreSQL
tendría que saber quién es el usuario, y hoy esa identidad vive en nuestro JWT,
no en la sesión de la base. Llevarla allí es el paso siguiente y tiene dos
caminos, ninguno gratis:

- **Supabase Auth**, con `auth.uid()` en las políticas. Exige la clave
  `service_role` y sustituir el login propio, con lo que se rehace el trabajo de
  los laboratorios 9 y 10.
- **Una variable de sesión** por petición (`SET LOCAL`), con las políticas
  leyendo `current_setting`. No rompe la arquitectura actual, pero obliga a que
  cada consulta vaya dentro de una transacción con esa variable puesta.

Mientras tanto, lo que hay es honesto: una capa que limita el daño si la
credencial de la API se filtra, y la autorización por fila donde de verdad está,
que es en Express.

---

## 8. Conexión desde Express

Ver [`../src/config/database.js`](../src/config/database.js) y
[`../scripts/probar-conexion.js`](../scripts/probar-conexion.js).

```bash
node scripts/probar-conexion.js
```

Hacen falta dos cosas en el entorno:

1. `DATABASE_URL` en el `.env`, copiada de Supabase → **Connect**.
2. El certificado de la autoridad en `certs/prod-ca-2021.crt`, descargado de
   **Database → Settings → SSL configuration**.

El certificado es obligatorio y no hay interruptor para saltárselo. TLS cifra el
tráfico, pero con `rejectUnauthorized: true` Node además comprueba que el
servidor al otro lado sea de verdad el nuestro. Poner `rejectUnauthorized: false`
hace que la conexión funcione y **desactiva esa comprobación**: cifra contra un
intermediario tan bien como contra el servidor legítimo.

---

## 9. Cómo se verificó este esquema

Los cuatro scripts se ejecutaron contra un PostgreSQL 16 real antes de
entregarse, y se comprobó que las restricciones rechazan de verdad lo que deben
rechazar:

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

Los conteos de `04_datos_semilla.sql` coinciden fila por fila con `src/data/`:
11 eventos, 3 localidades, 16 funciones, 48 tarifas, 29 descuentos,
5 asistentes y 7 boletas.

---

## 10. Los services ya consultan PostgreSQL

Los seis services —localidades, eventos, asistentes, usuarios, funciones y
boletas— dejaron de leer `src/data/` y consultan la base. Cada función conserva
su nombre y lo que devuelve; lo único que cambió es que ahora son asíncronas.

| Antes | Ahora |
| ----- | ----- |
| `const localidades = require("../data/localidades")` | `const { consultar } = require("../config/database")` |
| `localidades.find(l => l.id === Number(id))` | `SELECT … WHERE id = $1` |
| `datos.nombre ?? actual.nombre` | `COALESCE($2, nombre)` |
| El controlador llamaba y usaba | El controlador espera con `await` |

De `src/data/` solo sigue vivo `apiKeys.js`, porque las claves de los clientes
se comparan por hash en memoria y no son datos del teatro.

### Tres cosas que la migración obligó a cuidar

**Los tipos que devuelve el controlador de PostgreSQL.** `pg` entrega los
`BIGINT` como texto y las fechas como objetos `Date`, así que `"id": 1` se
habría vuelto `"id": "1"` y `"1995-03-14"` una marca de tiempo con zona
horaria. `src/config/database.js` fija los tres analizadores para que la API
siga respondiendo lo mismo que antes.

**Las escrituras que tocan varias tablas.** Guardar una función escribe en
`funciones`, `funcion_tarifas` y `funcion_descuentos`. Van dentro de una
transacción: sin ella, un fallo a mitad dejaría una función sin tarifas, que es
un estado que las reglas del teatro no admiten.

**Un `SELECT` junto a un `UPDATE` no ve el cambio.** Al devolver la función tras
cambiarle el estado, la consulta leía la fila anterior, porque en PostgreSQL el
`SELECT` que acompaña a un `WITH` que modifica datos trabaja sobre la foto
previa. La fila actualizada se toma del propio `RETURNING`.

## 11. Qué falta

**Las políticas de Row Level Security.** Hoy RLS está activo y sin políticas, de
modo que nadie entra por la vía directa. La API no se ve afectada porque usa su
propio usuario de PostgreSQL. Escribirlas tiene sentido cuando se integre
Supabase Auth, y entonces reproducirán en la base lo que hoy hacen
`roles.middleware.js` y `propiedad.middleware.js`.

**La identidad en `auth.users`.** La columna `usuarios.auth_user_id` existe y
está vacía: las contraseñas siguen en `password_hash` con bcrypt. Migrar a
Supabase Auth es el paso que la llenaría.

**El límite de seis boletas y la coherencia de precios** siguen comprobándose en
el código, no en la base. La primera necesitaría un disparador; la segunda
compara todos los pares de localidades y es más clara donde está.
