-- ========================================
-- API_TEATRO · Esquema relacional
-- Teatro Maldonado de Tunja
-- ========================================
-- Traslada a PostgreSQL el modelo que hasta ahora vivía en src/data/.
-- Lo que en memoria eran arreglos anidados pasa a tablas propias:
--   funcion.tarifas               -> funcion_tarifas
--   funcion.descuentosHabilitados -> funcion_descuentos
--
-- No es idempotente: usa CREATE TABLE y debe ejecutarse sobre un proyecto
-- nuevo o una base que todavía no tenga estas tablas.

BEGIN;

-- ========================================
-- ROLES
-- Los tres roles de negocio del teatro
-- ========================================
-- No son los roles de acceso de Supabase (anon, authenticated, service_role).
CREATE TABLE public.roles (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre VARCHAR(30) NOT NULL UNIQUE,
    descripcion VARCHAR(200),
    activo BOOLEAN NOT NULL DEFAULT TRUE,

    CONSTRAINT ck_roles_nombre
    CHECK (
        nombre IN (
            'administrador',
            'taquilla',
            'asistente'
        )
    )
);

-- ========================================
-- USUARIOS
-- La identidad: quién inicia sesión
-- ========================================
-- password_hash admite NULL porque una cuenta puede venir de Supabase Auth
-- (auth_user_id) en lugar de bcrypt. Hoy la API usa bcrypt; la columna queda
-- preparada para el cambio sin migrar la tabla otra vez.
CREATE TABLE public.usuarios (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    auth_user_id UUID UNIQUE
        REFERENCES auth.users(id)
        ON DELETE RESTRICT,

    rol_id BIGINT NOT NULL
        REFERENCES public.roles(id)
        ON DELETE RESTRICT,

    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,

    password_hash TEXT,

    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_registro TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ck_usuarios_nombre
        CHECK (LENGTH(TRIM(nombre)) BETWEEN 3 AND 100)
);

-- ========================================
-- EVENTOS
-- La programación: qué se presenta
-- ========================================
CREATE TABLE public.eventos (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    titulo VARCHAR(150) NOT NULL,
    tipo VARCHAR(20) NOT NULL,
    descripcion VARCHAR(500) NOT NULL,
    duracion_minutos INTEGER NOT NULL,
    clasificacion_edad VARCHAR(5) NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,

    CONSTRAINT ck_eventos_titulo
        CHECK (LENGTH(TRIM(titulo)) BETWEEN 3 AND 150),

    CONSTRAINT ck_eventos_tipo
    CHECK (
        tipo IN (
            'obra',
            'concierto',
            'cine',
            'institucional'
        )
    ),

    CONSTRAINT ck_eventos_clasificacion
    CHECK (
        clasificacion_edad IN ('G', '+7', '+12', '+15', '+18')
    ),

    CONSTRAINT ck_eventos_duracion
        CHECK (duracion_minutos BETWEEN 10 AND 600)
);

-- ========================================
-- LOCALIDADES
-- Las zonas de la única sala del teatro
-- ========================================
-- capacidad es una columna generada: no se escribe, se calcula. En memoria
-- había que recalcularla en cada actualización del service; aquí la base
-- garantiza que nunca se desincronice de filas * butacas_por_fila.
CREATE TABLE public.localidades (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    codigo VARCHAR(20) NOT NULL UNIQUE,
    nombre VARCHAR(100) NOT NULL,
    orden INTEGER NOT NULL UNIQUE,

    filas INTEGER NOT NULL,
    butacas_por_fila INTEGER NOT NULL,

    capacidad INTEGER
        GENERATED ALWAYS AS (filas * butacas_por_fila) STORED,

    activa BOOLEAN NOT NULL DEFAULT TRUE,

    CONSTRAINT ck_localidades_orden
        CHECK (orden >= 1),

    CONSTRAINT ck_localidades_filas
        CHECK (filas > 0),

    CONSTRAINT ck_localidades_butacas
        CHECK (butacas_por_fila > 0)
);

-- ========================================
-- FUNCIONES
-- Un evento en una fecha y hora concretas
-- ========================================
CREATE TABLE public.funciones (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    evento_id BIGINT NOT NULL
        REFERENCES public.eventos(id)
        ON DELETE RESTRICT,

    fecha DATE NOT NULL,
    hora TIME NOT NULL,

    estado VARCHAR(20) NOT NULL DEFAULT 'programada',

    CONSTRAINT ck_funciones_estado
    CHECK (
        estado IN (
            'programada',
            'en_venta',
            'agotada',
            'en_curso',
            'finalizada',
            'cancelada'
        )
    )
);

-- ========================================
-- TARIFAS DE CADA FUNCIÓN
-- Lo que en memoria era funcion.tarifas[]
-- ========================================
-- La clave primaria compuesta impide dos tarifas para la misma localidad en
-- la misma función: la regla 6 del proyecto, ahora garantizada por la base.
CREATE TABLE public.funcion_tarifas (
    funcion_id BIGINT NOT NULL
        REFERENCES public.funciones(id)
        ON DELETE CASCADE,

    localidad_id BIGINT NOT NULL
        REFERENCES public.localidades(id)
        ON DELETE RESTRICT,

    precio INTEGER NOT NULL,

    CONSTRAINT pk_funcion_tarifas
        PRIMARY KEY (funcion_id, localidad_id),

    CONSTRAINT ck_funcion_tarifas_precio
        CHECK (precio > 0)
);

-- ========================================
-- DESCUENTOS HABILITADOS POR FUNCIÓN
-- Lo que en memoria era funcion.descuentosHabilitados[]
-- ========================================
-- 'ninguno' no se almacena: siempre está permitido y no es un descuento.
CREATE TABLE public.funcion_descuentos (
    funcion_id BIGINT NOT NULL
        REFERENCES public.funciones(id)
        ON DELETE CASCADE,

    tipo VARCHAR(20) NOT NULL,

    CONSTRAINT pk_funcion_descuentos
        PRIMARY KEY (funcion_id, tipo),

    CONSTRAINT ck_funcion_descuentos_tipo
    CHECK (
        tipo IN ('estudiante', 'infantil', 'adultoMayor')
    )
);

-- ========================================
-- ASISTENTES
-- El público, y su vínculo opcional con una cuenta
-- ========================================
-- usuario_id es UNIQUE y admite NULL: un asistente puede existir sin cuenta
-- (lo registró la taquilla) pero una cuenta no puede quedar ligada a dos
-- asistentes. Es la regla de asociación única del bloque 6C, en la base.
CREATE TABLE public.asistentes (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    usuario_id BIGINT UNIQUE
        REFERENCES public.usuarios(id)
        ON DELETE RESTRICT,

    nombre VARCHAR(100) NOT NULL,
    documento VARCHAR(20) NOT NULL UNIQUE,
    email VARCHAR(150) NOT NULL UNIQUE,
    telefono VARCHAR(15) NOT NULL,
    fecha_nacimiento DATE NOT NULL,

    CONSTRAINT ck_asistentes_nombre
        CHECK (LENGTH(TRIM(nombre)) BETWEEN 3 AND 100),

    CONSTRAINT ck_asistentes_nacimiento
        CHECK (fecha_nacimiento <= CURRENT_DATE)
);

-- ========================================
-- BOLETAS
-- La venta: una butaca de una función a nombre de alguien
-- ========================================
-- precio y codigo los calcula el servidor y nunca llegan del cliente. Aquí
-- se guardan ya calculados, igual que en memoria.
CREATE TABLE public.boletas (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    asistente_id BIGINT NOT NULL
        REFERENCES public.asistentes(id)
        ON DELETE RESTRICT,

    funcion_id BIGINT NOT NULL
        REFERENCES public.funciones(id)
        ON DELETE RESTRICT,

    localidad_id BIGINT NOT NULL
        REFERENCES public.localidades(id)
        ON DELETE RESTRICT,

    fila INTEGER NOT NULL,
    numero INTEGER NOT NULL,

    tipo_descuento VARCHAR(20) NOT NULL DEFAULT 'ninguno',

    precio INTEGER NOT NULL,
    codigo VARCHAR(20) NOT NULL UNIQUE,

    estado VARCHAR(20) NOT NULL DEFAULT 'reservada',

    CONSTRAINT ck_boletas_fila
        CHECK (fila >= 1),

    CONSTRAINT ck_boletas_numero
        CHECK (numero >= 1),

    CONSTRAINT ck_boletas_precio
        CHECK (precio >= 0),

    CONSTRAINT ck_boletas_tipo_descuento
    CHECK (
        tipo_descuento IN (
            'ninguno',
            'estudiante',
            'infantil',
            'adultoMayor'
        )
    ),

    CONSTRAINT ck_boletas_estado
    CHECK (
        estado IN (
            'reservada',
            'pagada',
            'usada',
            'cancelada'
        )
    ),

    CONSTRAINT ck_boletas_codigo
        CHECK (codigo ~ '^BOL-[0-9]{4}-[0-9]{4}$'),

    -- La tarifa de esa localidad en esa función debe existir. Es la regla 5
    -- del recurso boletas, y la clave foránea compuesta la hace imposible de
    -- violar desde cualquier camino, no solo desde el controlador.
    CONSTRAINT fk_boletas_tarifa
        FOREIGN KEY (funcion_id, localidad_id)
        REFERENCES public.funcion_tarifas(funcion_id, localidad_id)
        ON DELETE RESTRICT
);

-- ========================================
-- ÍNDICES DE RELACIONES
-- ========================================
CREATE INDEX idx_usuarios_rol
    ON public.usuarios(rol_id);

CREATE INDEX idx_asistentes_usuario
    ON public.asistentes(usuario_id);

CREATE INDEX idx_funciones_evento
    ON public.funciones(evento_id);

CREATE INDEX idx_funciones_fecha
    ON public.funciones(fecha);

CREATE INDEX idx_boletas_asistente
    ON public.boletas(asistente_id);

CREATE INDEX idx_boletas_funcion
    ON public.boletas(funcion_id);

CREATE INDEX idx_boletas_localidad
    ON public.boletas(localidad_id);

-- ========================================
-- SALA ÚNICA
-- No hay dos funciones a la misma fecha y hora
-- ========================================
-- Es la validación de solapamiento más importante del proyecto. Una función
-- cancelada libera su franja, de ahí el WHERE: el índice parcial reproduce
-- exactamente lo que hacía funcionTieneConflicto() en el service.
CREATE UNIQUE INDEX uq_funciones_sala
    ON public.funciones(fecha, hora)
    WHERE estado <> 'cancelada';

-- ========================================
-- BUTACA NO REPETIDA
-- Una silla, una boleta viva
-- ========================================
-- Una boleta cancelada libera su butaca y esa misma silla se puede revender.
-- En memoria dependía de butacaOcupada(); aquí la base lo impone, y además
-- resuelve la condición de carrera que Node no podía evitar con un arreglo.
CREATE UNIQUE INDEX uq_boletas_butaca
    ON public.boletas(funcion_id, localidad_id, fila, numero)
    WHERE estado <> 'cancelada';

COMMIT;
