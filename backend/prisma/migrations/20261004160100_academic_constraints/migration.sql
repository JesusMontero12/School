-- ─────────────────────────────────────────────────────────────────────────────
-- academic_constraints · Integridad estructural que Prisma no puede declarar
--   Índices únicos parciales y CHECK. Las reglas de negocio (capacidad, año
--   cerrado, representante principal obligatorio, etc.) viven en el backend.
-- ─────────────────────────────────────────────────────────────────────────────

-- Como máximo UN año escolar ACTIVO en todo el sistema
-- (p. ej. 2025-2026 CERRADO · 2026-2027 ACTIVO · 2027-2028 PLANIFICADO)
CREATE UNIQUE INDEX "school_years_single_active"
  ON "school_years" ("status") WHERE "status" = 'ACTIVO';

-- Como máximo UN momento pedagógico ACTIVO dentro de cada año escolar
CREATE UNIQUE INDEX "academic_terms_single_active_per_year"
  ON "academic_terms" ("school_year_id") WHERE "status" = 'ACTIVO';

-- NOTA: "dos momentos con el mismo número en el mismo año" ya queda impedido por
-- academic_terms_school_year_id_number_key (creado desde @@unique en schema.prisma).
-- Repetirlo aquí crearía un índice único duplicado, por eso no se añade otro.

-- Inscripciones de un mismo alumno en un mismo año escolar:
--   · como máximo UNA ACTIVA
--   · como máximo UNA PENDIENTE (en proceso de completar requisitos)
--   · ANULADAS y RETIRADAS: sin límite (histórico)
-- Una PENDIENTE puede coexistir con una ACTIVA: ambos índices son independientes
-- porque cada uno filtra por su propio estado.
-- (Al pasar PENDIENTE → ACTIVA, si ya hay otra ACTIVA el servicio debe avisar con un
--  mensaje claro antes de que salte esta restricción.)
CREATE UNIQUE INDEX "enrollments_single_active_per_student_year"
  ON "enrollments" ("student_id", "school_year_id") WHERE "status" = 'ACTIVA';

CREATE UNIQUE INDEX "enrollments_single_pending_per_student_year"
  ON "enrollments" ("student_id", "school_year_id") WHERE "status" = 'PENDIENTE';

-- Como máximo UN representante principal por inscripción.
-- (Que una inscripción ACTIVA tenga uno es regla del servicio, no de la BD.)
CREATE UNIQUE INDEX "enrollment_representatives_single_primary"
  ON "enrollment_representatives" ("enrollment_id") WHERE "is_primary";

-- Fechas y rangos
ALTER TABLE "school_years"
  ADD CONSTRAINT "school_years_dates_chk" CHECK ("end_date" > "start_date");

ALTER TABLE "academic_terms"
  ADD CONSTRAINT "academic_terms_number_chk" CHECK ("number" BETWEEN 1 AND 3),
  ADD CONSTRAINT "academic_terms_dates_chk"  CHECK ("end_date" > "start_date");

ALTER TABLE "grade_levels"
  ADD CONSTRAINT "grade_levels_number_chk" CHECK ("number" BETWEEN 1 AND 5);

ALTER TABLE "sections"
  ADD CONSTRAINT "sections_capacity_chk" CHECK ("max_capacity" > 0);

-- Un documento ENTREGADO requiere fecha de entrega
ALTER TABLE "enrollment_documents"
  ADD CONSTRAINT "enrollment_documents_delivered_chk"
  CHECK ("status" <> 'ENTREGADO' OR "delivered_at" IS NOT NULL);
