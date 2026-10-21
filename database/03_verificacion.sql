-- ========================================
-- API_TEATRO · Verificación del esquema
-- ========================================
-- Consultas de solo lectura. Se ejecutan tras 01 y 02 para comprobar que la
-- base quedó como se esperaba. Ninguna modifica datos.

-- ========================================
-- 1. Los tres roles de negocio
-- ========================================
-- Se esperan tres filas: administrador, taquilla, asistente.
SELECT id, nombre, activo
FROM public.roles
ORDER BY id;

-- ========================================
-- 2. Las nueve tablas
-- ========================================
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'roles',
    'usuarios',
    'eventos',
    'localidades',
    'funciones',
    'funcion_tarifas',
    'funcion_descuentos',
    'asistentes',
    'boletas'
  )
ORDER BY table_name;

-- ========================================
-- 3. Row Level Security
-- ========================================
-- Se espera rls_habilitado = true en las nueve.
SELECT
    relname AS tabla,
    relrowsecurity AS rls_habilitado
FROM pg_class
WHERE relnamespace = 'public'::regnamespace
  AND relname IN (
    'roles',
    'usuarios',
    'eventos',
    'localidades',
    'funciones',
    'funcion_tarifas',
    'funcion_descuentos',
    'asistentes',
    'boletas'
  )
ORDER BY relname;

-- ========================================
-- 4. Claves foráneas
-- ========================================
-- Se esperan diez: usuarios->roles, asistentes->usuarios, funciones->eventos,
-- funcion_tarifas->funciones, funcion_tarifas->localidades,
-- funcion_descuentos->funciones, boletas->asistentes, boletas->funciones,
-- boletas->localidades y la compuesta boletas->funcion_tarifas.
SELECT
    tc.table_name  AS tabla,
    kcu.column_name AS columna,
    ccu.table_name  AS referencia
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
   AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
   AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- ========================================
-- 5. Reglas de negocio que vigila la base
-- ========================================
-- Los dos índices únicos parciales son los que impiden la doble reserva de
-- sala y la butaca repetida. Deben aparecer uq_funciones_sala y
-- uq_boletas_butaca.
SELECT
    tablename AS tabla,
    indexname AS indice,
    indexdef   AS definicion
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'uq_%'
ORDER BY tablename, indexname;

-- ========================================
-- 6. Restricciones CHECK
-- ========================================
SELECT
    rel.relname AS tabla,
    con.conname AS restriccion
FROM pg_constraint AS con
JOIN pg_class AS rel
    ON rel.oid = con.conrelid
WHERE con.contype = 'c'
  AND rel.relnamespace = 'public'::regnamespace
ORDER BY rel.relname, con.conname;

-- ========================================
-- 7. La capacidad se calcula sola
-- ========================================
-- capacidad es una columna generada: debe salir is_generated = ALWAYS.
SELECT
    column_name,
    is_generated,
    generation_expression
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'localidades'
  AND column_name = 'capacidad';
