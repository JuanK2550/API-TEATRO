-- ========================================
-- API_TEATRO · Datos semilla
-- ========================================
-- Generado desde src/data/ para que la semilla de PostgreSQL sea exactamente
-- la misma que la de memoria. No editar a mano: regenerar con el guion.
--
-- Se ejecuta después de 01_esquema_teatro.sql y 02_roles_seguridad.sql.
-- Usa OVERRIDING SYSTEM VALUE para conservar los identificadores, porque los
-- datos se referencian entre sí por id, y al final reajusta las secuencias.

BEGIN;

-- ========================================
-- EVENTOS
-- 11 eventos; el inactivo conserva su estado
-- ========================================
INSERT INTO public.eventos
    (id, titulo, tipo, descripcion, duracion_minutos, clasificacion_edad, activo)
OVERRIDING SYSTEM VALUE
VALUES
    (1, 'La Casa de Bernarda Alba', 'obra', 'Montaje de la obra de Federico García Lorca a cargo del grupo de teatro de la UPTC.', 110, '+12', TRUE),
    (2, 'Concierto de Gala de la Orquesta Filarmónica de Boyacá', 'concierto', 'Programa sinfónico con obras de Beethoven y compositores boyacenses.', 95, 'G', TRUE),
    (3, 'Ciclo de Cine Colombiano: La Estrategia del Caracol', 'cine', 'Proyección en formato digital con conversatorio posterior sobre cine nacional.', 116, '+12', TRUE),
    (4, 'Ceremonia de Grados UPTC 2026-II', 'institucional', 'Ceremonia de grados de la Universidad Pedagógica y Tecnológica de Colombia.', 180, 'G', TRUE),
    (5, 'Noche de Bandas Tunjanas', 'concierto', 'Encuentro de rock y música alternativa con agrupaciones locales de Tunja.', 150, '+15', FALSE),
    (6, 'Ballet Folclórico de Boyacá', 'obra', 'Danzas tradicionales del altiplano con el cuerpo de baile del departamento, acompañadas por música en vivo.', 85, 'G', TRUE),
    (7, 'Noche de Jazz: Tunja Big Band', 'concierto', 'La big band de la ciudad repasa el repertorio clásico del swing y del jazz latino en formato de catorce músicos.', 80, 'G', TRUE),
    (8, 'El Gato con Botas', 'obra', 'Función infantil con títeres y narración en vivo, pensada para público familiar y colegios de la ciudad.', 55, 'G', TRUE),
    (9, 'Ciclo de Cine Mudo con Piano en Vivo', 'cine', 'Proyección de cortometrajes mudos de los años veinte, acompañados al piano por un intérprete en la sala.', 92, '+7', TRUE),
    (10, 'Festival de Música Joven de Boyacá', 'concierto', 'Tres agrupaciones emergentes del departamento comparten escenario en una noche de música en vivo.', 120, '+12', TRUE),
    (11, 'Foro Abierto: Patrimonio y Ciudad', 'institucional', 'Conversación pública sobre el patrimonio arquitectónico del centro histórico de Tunja, con entrada libre.', 120, 'G', TRUE);

-- ========================================
-- LOCALIDADES
-- capacidad no se inserta: la calcula la base
-- ========================================
INSERT INTO public.localidades
    (id, codigo, nombre, orden, filas, butacas_por_fila, activa)
OVERRIDING SYSTEM VALUE
VALUES
    (1, 'PLA-PREF', 'Platea Preferencial', 1, 5, 20, TRUE),
    (2, 'PLA-GEN', 'Platea General', 2, 10, 20, TRUE),
    (3, 'BAL', 'Balcón', 3, 6, 25, TRUE);

-- ========================================
-- FUNCIONES
-- 16 funciones
-- ========================================
INSERT INTO public.funciones
    (id, evento_id, fecha, hora, estado)
OVERRIDING SYSTEM VALUE
VALUES
    (1, 1, '2027-02-18', '19:00', 'en_venta'),
    (2, 1, '2027-02-19', '19:00', 'agotada'),
    (3, 2, '2027-02-26', '20:00', 'programada'),
    (4, 3, '2027-02-21', '16:00', 'en_venta'),
    (5, 4, '2027-03-05', '10:00', 'programada'),
    (6, 1, '2026-09-05', '19:00', 'finalizada'),
    (7, 5, '2026-09-12', '20:00', 'cancelada'),
    (8, 6, '2027-02-20', '19:00', 'en_venta'),
    (9, 7, '2027-02-25', '20:00', 'en_venta'),
    (10, 8, '2027-02-27', '11:00', 'en_venta'),
    (11, 9, '2027-03-06', '17:00', 'en_venta'),
    (12, 10, '2027-03-12', '19:30', 'en_venta'),
    (13, 11, '2027-03-19', '18:30', 'programada'),
    (14, 6, '2027-03-20', '19:00', 'agotada'),
    (15, 7, '2027-04-02', '20:00', 'programada'),
    (16, 8, '2027-04-10', '11:00', 'en_venta');

-- ========================================
-- TARIFAS
-- lo que en memoria era funcion.tarifas[]
-- ========================================
INSERT INTO public.funcion_tarifas
    (funcion_id, localidad_id, precio)
VALUES
    (1, 1, 75000),
    (1, 2, 55000),
    (1, 3, 38000),
    (2, 1, 75000),
    (2, 2, 55000),
    (2, 3, 38000),
    (3, 1, 120000),
    (3, 2, 90000),
    (3, 3, 60000),
    (4, 1, 25000),
    (4, 2, 18000),
    (4, 3, 12000),
    (5, 1, 40000),
    (5, 2, 30000),
    (5, 3, 20000),
    (6, 1, 75000),
    (6, 2, 55000),
    (6, 3, 38000),
    (7, 1, 95000),
    (7, 2, 70000),
    (7, 3, 45000),
    (8, 1, 68000),
    (8, 2, 50000),
    (8, 3, 34000),
    (9, 1, 85000),
    (9, 2, 62000),
    (9, 3, 42000),
    (10, 1, 30000),
    (10, 2, 22000),
    (10, 3, 15000),
    (11, 1, 28000),
    (11, 2, 20000),
    (11, 3, 14000),
    (12, 1, 72000),
    (12, 2, 54000),
    (12, 3, 36000),
    (13, 1, 20000),
    (13, 2, 15000),
    (13, 3, 10000),
    (14, 1, 68000),
    (14, 2, 50000),
    (14, 3, 34000),
    (15, 1, 85000),
    (15, 2, 62000),
    (15, 3, 42000),
    (16, 1, 30000),
    (16, 2, 22000),
    (16, 3, 15000);

-- ========================================
-- DESCUENTOS HABILITADOS
-- lo que en memoria era funcion.descuentosHabilitados[]
-- ========================================
INSERT INTO public.funcion_descuentos
    (funcion_id, tipo)
VALUES
    (1, 'estudiante'),
    (1, 'adultoMayor'),
    (2, 'estudiante'),
    (2, 'adultoMayor'),
    (3, 'estudiante'),
    (3, 'infantil'),
    (3, 'adultoMayor'),
    (4, 'estudiante'),
    (4, 'infantil'),
    (6, 'estudiante'),
    (6, 'adultoMayor'),
    (7, 'estudiante'),
    (8, 'estudiante'),
    (8, 'infantil'),
    (8, 'adultoMayor'),
    (9, 'estudiante'),
    (10, 'infantil'),
    (10, 'estudiante'),
    (11, 'estudiante'),
    (11, 'adultoMayor'),
    (12, 'estudiante'),
    (13, 'estudiante'),
    (13, 'adultoMayor'),
    (14, 'estudiante'),
    (14, 'infantil'),
    (14, 'adultoMayor'),
    (15, 'estudiante'),
    (16, 'infantil'),
    (16, 'estudiante');

-- ========================================
-- ASISTENTES
-- usuario_id en NULL: los registró la taquilla, no una cuenta
-- ========================================
INSERT INTO public.asistentes
    (id, usuario_id, nombre, documento, email, telefono, fecha_nacimiento)
OVERRIDING SYSTEM VALUE
VALUES
    (1, NULL, 'Laura Sofía Pineda Rojas', '1049632178', 'laura.pineda@correo.com', '3124567890', '1995-03-14'),
    (2, NULL, 'Andrés Felipe Rodríguez Camargo', '74381205', 'andres.rodriguez@correo.com', '3005512233', '1988-11-02'),
    (3, NULL, 'María Camila Vargas Sierra', '1002784561', 'camila.vargas@correo.com', '3187744120', '2004-07-21'),
    (4, NULL, 'Jorge Enrique Buitrago Niño', '6764312', 'jorge.buitrago@correo.com', '3112298745', '1957-02-08'),
    (5, NULL, 'Santiago Alejandro Mesa Ochoa', '1099887766', 'familia.mesa@correo.com', '3209981122', '2016-05-30');

-- ========================================
-- BOLETAS
-- 7 boletas; cubren los cuatro estados y los cuatro descuentos
-- ========================================
INSERT INTO public.boletas
    (id, asistente_id, funcion_id, localidad_id, fila, numero, tipo_descuento, precio, codigo, estado)
OVERRIDING SYSTEM VALUE
VALUES
    (1, 1, 1, 1, 2, 7, 'ninguno', 75000, 'BOL-2026-0001', 'pagada'),
    (2, 3, 1, 2, 4, 12, 'estudiante', 44000, 'BOL-2026-0002', 'pagada'),
    (3, 4, 1, 3, 1, 5, 'adultoMayor', 26600, 'BOL-2026-0003', 'reservada'),
    (4, 5, 4, 2, 3, 9, 'infantil', 9000, 'BOL-2026-0004', 'pagada'),
    (5, 2, 4, 1, 1, 15, 'ninguno', 25000, 'BOL-2026-0005', 'pagada'),
    (6, 2, 6, 2, 5, 3, 'ninguno', 55000, 'BOL-2026-0006', 'usada'),
    (7, 1, 7, 1, 3, 10, 'ninguno', 95000, 'BOL-2026-0007', 'cancelada');

-- ========================================
-- REAJUSTE DE LAS SECUENCIAS
-- tras insertar ids explícitos, el contador debe continuar donde quedó
-- ========================================
SELECT setval(pg_get_serial_sequence('public.eventos', 'id'), (SELECT MAX(id) FROM public.eventos));
SELECT setval(pg_get_serial_sequence('public.localidades', 'id'), (SELECT MAX(id) FROM public.localidades));
SELECT setval(pg_get_serial_sequence('public.funciones', 'id'), (SELECT MAX(id) FROM public.funciones));
SELECT setval(pg_get_serial_sequence('public.asistentes', 'id'), (SELECT MAX(id) FROM public.asistentes));
SELECT setval(pg_get_serial_sequence('public.boletas', 'id'), (SELECT MAX(id) FROM public.boletas));

COMMIT;
