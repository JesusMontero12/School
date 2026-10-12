-- ─────────────────────────────────────────────────────────────────────────────
-- academic_core · Estructura del núcleo académico (DDL)
--   Año escolar, momentos pedagógicos, años/grados, secciones, alumnos,
--   representantes, fotos, inscripciones y documentos de inscripción.
-- Las restricciones de integridad (índices parciales y CHECK) van en la
-- migración siguiente: 20261004160100_academic_constraints.
-- ─────────────────────────────────────────────────────────────────────────────

-- Guardia: students, representatives y enrollments eran tablas reservadas y se
-- reestructuran (columnas NOT NULL nuevas, columnas de texto eliminadas).
-- Si tienen datos de prueba, esta migración se detiene con un mensaje claro.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "students")
     OR EXISTS (SELECT 1 FROM "representatives")
     OR EXISTS (SELECT 1 FROM "enrollments") THEN
    RAISE EXCEPTION 'academic_core: students/representatives/enrollments contienen datos. Vacíalas (o reinicia la BD de desarrollo) antes de migrar.';
  END IF;
END $$;

-- CreateEnum
CREATE TYPE "school_year_status" AS ENUM ('PLANIFICADO', 'ACTIVO', 'CERRADO');
CREATE TYPE "term_status" AS ENUM ('PENDIENTE', 'ACTIVO', 'CERRADO');
CREATE TYPE "student_status" AS ENUM ('ACTIVO', 'INACTIVO', 'RETIRADO', 'EGRESADO');
CREATE TYPE "enrollment_status" AS ENUM ('PENDIENTE', 'ACTIVA', 'RETIRADA', 'ANULADA');
CREATE TYPE "student_condition" AS ENUM ('REGULAR', 'REPITIENTE');
CREATE TYPE "identification_type" AS ENUM ('CEDULA', 'CEDULA_ESCOLAR');
CREATE TYPE "sex" AS ENUM ('MASCULINO', 'FEMENINO');
CREATE TYPE "relationship" AS ENUM ('MADRE', 'PADRE', 'ABUELO_A', 'TIO_A', 'HERMANO_A', 'TUTOR_LEGAL', 'OTRO');
CREATE TYPE "document_status" AS ENUM ('PENDIENTE', 'ENTREGADO');

-- ───────────── Estructura académica ─────────────

-- CreateTable
CREATE TABLE "school_years" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" "school_year_status" NOT NULL DEFAULT 'PLANIFICADO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "school_years_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academic_terms" (
    "id" TEXT NOT NULL,
    "school_year_id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" "term_status" NOT NULL DEFAULT 'PENDIENTE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academic_terms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grade_levels" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grade_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sections" (
    "id" TEXT NOT NULL,
    "grade_level_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "max_capacity" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "coordinator_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sections_pkey" PRIMARY KEY ("id")
);

-- ───────────── Alumnos y representantes (tablas reservadas → ampliadas) ─────────────

-- AlterTable: students
ALTER TABLE "students"
    DROP COLUMN "representative_id",   -- ahora N:M vía student_representatives
    DROP COLUMN "document_id",         -- reemplazado por identification_type + identification_number
    DROP COLUMN "birth_date",          -- pasa a DATE obligatorio
    ADD COLUMN "identification_type" "identification_type" NOT NULL,
    ADD COLUMN "identification_number" TEXT NOT NULL,
    ADD COLUMN "siges_code" TEXT,
    ADD COLUMN "birth_date" DATE NOT NULL,
    ADD COLUMN "birth_place" TEXT NOT NULL,
    ADD COLUMN "sex" "sex" NOT NULL,
    ADD COLUMN "address" TEXT NOT NULL,
    ADD COLUMN "status" "student_status" NOT NULL DEFAULT 'ACTIVO',
    ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable: representatives
ALTER TABLE "representatives"
    ADD COLUMN "address" TEXT,
    ADD COLUMN "occupation" TEXT,
    ADD COLUMN "photo_key" TEXT,
    ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "student_representatives" (
    "student_id" TEXT NOT NULL,
    "representative_id" TEXT NOT NULL,
    "relationship" "relationship" NOT NULL,
    "relationship_detail" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_representatives_pkey" PRIMARY KEY ("student_id","representative_id")
);

-- CreateTable
CREATE TABLE "student_photos" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "grade_level_id" TEXT NOT NULL,
    "school_year_id" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_photos_pkey" PRIMARY KEY ("id")
);

-- ───────────── Inscripciones ─────────────

-- AlterTable: enrollments (texto libre → claves foráneas)
DROP INDEX "enrollments_student_id_school_year_key";

ALTER TABLE "enrollments"
    DROP COLUMN "school_year",
    DROP COLUMN "level",
    DROP COLUMN "section",
    DROP COLUMN "status",
    ADD COLUMN "school_year_id" TEXT NOT NULL,
    ADD COLUMN "section_id" TEXT NOT NULL,
    ADD COLUMN "enrollment_date" DATE NOT NULL,
    ADD COLUMN "receipt_number" TEXT NOT NULL,
    ADD COLUMN "condition" "student_condition" NOT NULL DEFAULT 'REGULAR',
    ADD COLUMN "previous_school" TEXT,
    ADD COLUMN "status" "enrollment_status" NOT NULL DEFAULT 'PENDIENTE',
    ADD COLUMN "documents_due_date" DATE,
    ADD COLUMN "notes" TEXT,
    ADD COLUMN "created_by_id" TEXT,
    ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "enrollment_representatives" (
    "enrollment_id" TEXT NOT NULL,
    "representative_id" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "enrollment_representatives_pkey" PRIMARY KEY ("enrollment_id","representative_id")
);

-- ───────────── Requisitos de inscripción ─────────────

-- CreateTable
CREATE TABLE "requirement_types" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "requirement_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollment_documents" (
    "id" TEXT NOT NULL,
    "enrollment_id" TEXT NOT NULL,
    "requirement_type_id" TEXT NOT NULL,
    "status" "document_status" NOT NULL DEFAULT 'PENDIENTE',
    "storage_key" TEXT,
    "original_name" TEXT,
    "mime_type" TEXT,
    "size_bytes" INTEGER,
    "delivered_at" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enrollment_documents_pkey" PRIMARY KEY ("id")
);

-- ───────────── Índices ─────────────

-- CreateIndex
CREATE UNIQUE INDEX "school_years_name_key" ON "school_years"("name");
CREATE INDEX "school_years_status_idx" ON "school_years"("status");

CREATE UNIQUE INDEX "academic_terms_school_year_id_number_key" ON "academic_terms"("school_year_id", "number");

CREATE UNIQUE INDEX "grade_levels_number_key" ON "grade_levels"("number");
CREATE UNIQUE INDEX "grade_levels_name_key" ON "grade_levels"("name");

CREATE UNIQUE INDEX "sections_grade_level_id_name_key" ON "sections"("grade_level_id", "name");
CREATE INDEX "sections_coordinator_id_idx" ON "sections"("coordinator_id");

CREATE UNIQUE INDEX "students_siges_code_key" ON "students"("siges_code");
CREATE UNIQUE INDEX "students_identification_type_identification_number_key" ON "students"("identification_type", "identification_number");
CREATE INDEX "students_identification_number_idx" ON "students"("identification_number");
CREATE INDEX "students_last_name_first_name_idx" ON "students"("last_name", "first_name");
CREATE INDEX "students_status_idx" ON "students"("status");

CREATE INDEX "representatives_last_name_first_name_idx" ON "representatives"("last_name", "first_name");

CREATE INDEX "student_representatives_representative_id_idx" ON "student_representatives"("representative_id");

CREATE UNIQUE INDEX "student_photos_storage_key_key" ON "student_photos"("storage_key");
CREATE UNIQUE INDEX "student_photos_student_id_grade_level_id_key" ON "student_photos"("student_id", "grade_level_id");

CREATE UNIQUE INDEX "enrollments_receipt_number_key" ON "enrollments"("receipt_number");
CREATE INDEX "enrollments_student_id_school_year_id_idx" ON "enrollments"("student_id", "school_year_id");
CREATE INDEX "enrollments_school_year_id_section_id_status_idx" ON "enrollments"("school_year_id", "section_id", "status");
CREATE INDEX "enrollments_section_id_idx" ON "enrollments"("section_id");

CREATE INDEX "enrollment_representatives_representative_id_idx" ON "enrollment_representatives"("representative_id");

CREATE UNIQUE INDEX "requirement_types_code_key" ON "requirement_types"("code");

CREATE UNIQUE INDEX "enrollment_documents_storage_key_key" ON "enrollment_documents"("storage_key");
CREATE UNIQUE INDEX "enrollment_documents_enrollment_id_requirement_type_id_key" ON "enrollment_documents"("enrollment_id", "requirement_type_id");
CREATE INDEX "enrollment_documents_status_idx" ON "enrollment_documents"("status");

-- ───────────── Claves foráneas ─────────────

-- AddForeignKey
ALTER TABLE "academic_terms" ADD CONSTRAINT "academic_terms_school_year_id_fkey" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sections" ADD CONSTRAINT "sections_grade_level_id_fkey" FOREIGN KEY ("grade_level_id") REFERENCES "grade_levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sections" ADD CONSTRAINT "sections_coordinator_id_fkey" FOREIGN KEY ("coordinator_id") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "student_representatives" ADD CONSTRAINT "student_representatives_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "student_representatives" ADD CONSTRAINT "student_representatives_representative_id_fkey" FOREIGN KEY ("representative_id") REFERENCES "representatives"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "student_photos" ADD CONSTRAINT "student_photos_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_photos" ADD CONSTRAINT "student_photos_grade_level_id_fkey" FOREIGN KEY ("grade_level_id") REFERENCES "grade_levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "student_photos" ADD CONSTRAINT "student_photos_school_year_id_fkey" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_school_year_id_fkey" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "enrollment_representatives" ADD CONSTRAINT "enrollment_representatives_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "enrollment_representatives" ADD CONSTRAINT "enrollment_representatives_representative_id_fkey" FOREIGN KEY ("representative_id") REFERENCES "representatives"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "enrollment_documents" ADD CONSTRAINT "enrollment_documents_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "enrollment_documents" ADD CONSTRAINT "enrollment_documents_requirement_type_id_fkey" FOREIGN KEY ("requirement_type_id") REFERENCES "requirement_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
