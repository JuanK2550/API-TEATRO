// ========================================
// Importaciones
// ========================================
const { consultar, pool } = require("../config/database");
const {
  generarPasswordHash,
  verificarPassword
} = require("../utils/password.util");

// ========================================
// Roles del sistema
// Todo registro nace con el rol menos privilegiado
// ========================================
const ROLES = ["administrador", "taquilla", "asistente"];
const ROL_POR_DEFECTO = "asistente";

// ========================================
// Roles que un administrador puede otorgar
// El rol asistente no está: ese se obtiene registrándose
// ========================================
const ROLES_ADMINISTRATIVOS = ["taquilla", "administrador"];

// ========================================
// De fila de PostgreSQL a objeto de la API
// ========================================
// El rol se guarda como rol_id y sale resuelto a su nombre, porque todo el
// resto del proyecto —el JWT, autorizarRoles, las guardas— razona con
// "administrador", no con un número.
const aUsuario = (fila) =>
  fila
    ? {
        id: fila.id,
        nombre: fila.nombre,
        email: fila.email,
        passwordHash: fila.password_hash,
        rol: fila.rol,
        activo: fila.activo
      }
    : null;

const SELECCION = `
  SELECT u.id,
         u.nombre,
         u.email,
         u.password_hash,
         u.activo,
         r.nombre AS rol
  FROM public.usuarios u
  JOIN public.roles r ON r.id = u.rol_id
`;

// ========================================
// Obtener usuario por email
// El email es único, comparado siempre en minúsculas
// ========================================
const obtenerUsuarioPorEmail = async (email) => {
  if (!email) return null;

  const { rows } = await consultar(`${SELECCION} WHERE LOWER(u.email) = LOWER($1)`, [
    email
  ]);

  return aUsuario(rows[0]);
};

// ========================================
// Obtener usuario por id
// ========================================
const obtenerUsuarioPorId = async (id) => {
  const { rows } = await consultar(`${SELECCION} WHERE u.id = $1`, [Number(id)]);
  return aUsuario(rows[0]);
};

// ========================================
// Insertar un usuario con su rol
// Pieza compartida por los tres caminos de creación
// ========================================
// El rol llega por nombre y se resuelve a su id con una subconsulta, en vez de
// traerlo antes: así la inserción es una sola ida a la base.
const insertarUsuario = async (nombre, email, passwordHash, rol) => {
  const { rows } = await consultar(
    `WITH nuevo AS (
       INSERT INTO public.usuarios
         (rol_id, nombre, email, password_hash, activo)
       VALUES (
         (SELECT id FROM public.roles WHERE nombre = $4),
         $1, $2, $3, TRUE
       )
       RETURNING id, nombre, email, password_hash, activo, rol_id
     )
     SELECT nuevo.id,
            nuevo.nombre,
            nuevo.email,
            nuevo.password_hash,
            nuevo.activo,
            r.nombre AS rol
     FROM nuevo
     JOIN public.roles r ON r.id = nuevo.rol_id`,
    [nombre, email.toLowerCase(), passwordHash, rol]
  );

  return aUsuario(rows[0]);
};

// ========================================
// Crear usuario
// La contraseña se guarda solo como hash
// ========================================
// El rol se fija aquí y no se toma de datos: el registro público siempre crea
// asistentes, y esa garantía no debe depender de que el controlador limpie el
// cuerpo.
const crearUsuario = async (datos) => {
  const passwordHash = await generarPasswordHash(datos.password);
  return insertarUsuario(datos.nombre, datos.email, passwordHash, ROL_POR_DEFECTO);
};

// ========================================
// Crear usuario administrativo
// El único camino por el que se otorga taquilla o administrador
// ========================================
// Va aparte de crearUsuario a propósito: ese sigue forzando el rol asistente.
// Mezclar los dos caminos en una función con el rol opcional convertiría un
// olvido en una escalada de privilegios.
const crearUsuarioAdministrativo = async (datos) => {
  const passwordHash = await generarPasswordHash(datos.password);
  return insertarUsuario(datos.nombre, datos.email, passwordHash, datos.rol);
};

// ========================================
// Verificar credenciales
// Devuelve null tanto si el email no existe como si la contraseña no coincide
// ========================================
const verificarCredenciales = async (email, password) => {
  const usuario = await obtenerUsuarioPorEmail(email);

  if (!usuario || !usuario.passwordHash) return null;

  const passwordValida = await verificarPassword(password, usuario.passwordHash);

  if (!passwordValida) return null;

  return usuario;
};

// ========================================
// Administrador inicial
// Sin él nadie podría crear el primer administrador
// ========================================
// El problema es de arranque: las operaciones administrativas exigen un
// administrador, y crear administradores es una operación administrativa. Se
// rompe sembrando uno desde el entorno al levantar el servidor.
//
// Las credenciales viven solo en el .env. Aquí no se imprime el correo ni la
// contraseña: un log con la contraseña del administrador es tan grave como
// escribirla en el código, porque los registros se copian, se comparten y se
// suben a sistemas de monitoreo.
const LONGITUD_MINIMA_PASSWORD = 12;
const FORMATO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// La clave del bloqueo asesor. Dos ejecuciones simultáneas del bootstrap se
// serializan; cualquier otra cosa que escriba en usuarios no se ve afectada.
const CLAVE_BLOQUEO_BOOTSTRAP = [7505, 1];

const crearAdministradorInicial = async () => {
  const nombre = process.env.ADMIN_NOMBRE?.trim();
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!nombre || !email || !password) {
    throw new Error(
      "Faltan las variables ADMIN_NOMBRE, ADMIN_EMAIL o ADMIN_PASSWORD"
    );
  }

  if (password.length < LONGITUD_MINIMA_PASSWORD) {
    throw new Error(
      `La contraseña inicial debe tener al menos ${LONGITUD_MINIMA_PASSWORD} caracteres`
    );
  }

  if (!FORMATO_EMAIL.test(email)) {
    throw new Error("ADMIN_EMAIL no tiene un formato válido");
  }

  // El hash se calcula fuera de la transacción: bcrypt tarda, y mantener un
  // bloqueo abierto mientras tanto retrasaría a cualquier otra ejecución.
  const passwordHash = await generarPasswordHash(password);

  const cliente = await pool.connect();
  let enTransaccionAbierta = false;

  try {
    await cliente.query("BEGIN");
    enTransaccionAbierta = true;

    await cliente.query(
      "SELECT pg_advisory_xact_lock($1, $2)",
      CLAVE_BLOQUEO_BOOTSTRAP
    );

    // Cualquier administrador cuenta, aunque esté inactivo: reactivarlo es una
    // operación administrativa, no trabajo del bootstrap.
    const administradores = await cliente.query(
      `SELECT u.id
       FROM public.usuarios u
       INNER JOIN public.roles r ON r.id = u.rol_id
       WHERE r.nombre = 'administrador'
       LIMIT 1`
    );

    if (administradores.rows.length > 0) {
      await cliente.query("COMMIT");
      enTransaccionAbierta = false;

      return { creado: false, motivo: "ADMINISTRADOR_EXISTENTE" };
    }

    // Si el correo ya es de otra cuenta, el bootstrap no la convierte en
    // administradora: eso sería una elevación de privilegios por el .env.
    const correoOcupado = await cliente.query(
      `SELECT id FROM public.usuarios WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [email]
    );

    if (correoOcupado.rows.length > 0) {
      throw new Error(
        "El correo del bootstrap ya pertenece a otra cuenta. No se elevarán privilegios."
      );
    }

    const rol = await cliente.query(
      `SELECT id FROM public.roles
       WHERE nombre = 'administrador' AND activo = TRUE
       LIMIT 1`
    );

    if (rol.rows.length === 0) {
      throw new Error("No existe un rol administrador activo");
    }

    const creado = await cliente.query(
      `INSERT INTO public.usuarios
         (rol_id, nombre, email, password_hash, activo)
       VALUES ($1, $2, $3, $4, TRUE)
       RETURNING id, nombre, email, activo`,
      [rol.rows[0].id, nombre, email, passwordHash]
    );

    await cliente.query("COMMIT");
    enTransaccionAbierta = false;

    return {
      creado: true,
      motivo: "ADMINISTRADOR_CREADO",
      usuario: creado.rows[0]
    };
  } catch (error) {
    if (enTransaccionAbierta) await cliente.query("ROLLBACK");
    throw error;
  } finally {
    cliente.release();
  }
};

// ========================================
// Exportaciones
// ========================================
module.exports = {
  ROLES,
  ROL_POR_DEFECTO,
  ROLES_ADMINISTRATIVOS,
  obtenerUsuarioPorEmail,
  obtenerUsuarioPorId,
  crearUsuario,
  crearUsuarioAdministrativo,
  verificarCredenciales,
  crearAdministradorInicial
};
