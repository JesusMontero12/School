-- Gestión académica: materias, plan de estudio, docentes, asignaciones, evaluaciones y calificaciones.
-- Solo agrega tablas y columnas; no modifica ni borra datos existentes. `grades` y `attendance` quedan intactas.

-- CreateEnum
CREATE TYPE "evaluation_kind" AS ENUM ('CONTINUA', 'LAPSO');

-- Docentes: contacto, estado y fecha de actualización
ALTER TABLE "teachers" ADD COLUMN "email" TEXT;
ALTER TABLE "teachers" ADD COLUMN "phone" TEXT;
ALTER TABLE "teachers" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "teachers" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "teachers" ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateTable
CREATE TABLE "subjects" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "grade_level_subjects" (
    "grade_level_id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,

    CONSTRAINT "grade_level_subjects_pkey" PRIMARY KEY ("grade_level_id","subject_id")
);

CREATE TABLE "teaching_assignments" (
    "id" TEXT NOT NULL,
    "school_year_id" TEXT NOT NULL,
    "section_id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "ended_at" TIMESTAMP(3),
    "end_reason" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teaching_assignments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "subject_term_settings" (
    "subject_id" TEXT NOT NULL,
    "term_id" TEXT NOT NULL,
    "has_lapso_test" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subject_term_settings_pkey" PRIMARY KEY ("subject_id","term_id")
);

CREATE TABLE "evaluations" (
    "id" TEXT NOT NULL,
    "term_id" TEXT NOT NULL,
    "section_id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "evaluation_kind" NOT NULL DEFAULT 'CONTINUA',
    "max_points" DECIMAL(5,2) NOT NULL,
    "evaluation_date" DATE NOT NULL,
    "voided_at" TIMESTAMP(3),
    "void_reason" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evaluations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "evaluation_scores" (
    "evaluation_id" TEXT NOT NULL,
    "enrollment_id" TEXT NOT NULL,
    "points" DECIMAL(5,2) NOT NULL,
    "updated_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evaluation_scores_pkey" PRIMARY KEY ("evaluation_id","enrollment_id")
);

-- Índices
CREATE UNIQUE INDEX "subjects_code_key" ON "subjects"("code");
CREATE INDEX "grade_level_subjects_subject_id_idx" ON "grade_level_subjects"("subject_id");
CREATE INDEX "teaching_assignments_school_year_id_section_id_subject_id_idx" ON "teaching_assignments"("school_year_id", "section_id", "subject_id");
CREATE INDEX "teaching_assignments_teacher_id_school_year_id_idx" ON "teaching_assignments"("teacher_id", "school_year_id");
CREATE INDEX "evaluations_term_id_section_id_subject_id_idx" ON "evaluations"("term_id", "section_id", "subject_id");
CREATE INDEX "evaluations_teacher_id_idx" ON "evaluations"("teacher_id");
CREATE INDEX "evaluation_scores_enrollment_id_idx" ON "evaluation_scores"("enrollment_id");
CREATE INDEX "teachers_last_name_first_name_idx" ON "teachers"("last_name", "first_name");

-- Claves foráneas
ALTER TABLE "grade_level_subjects" ADD CONSTRAINT "grade_level_subjects_grade_level_id_fkey" FOREIGN KEY ("grade_level_id") REFERENCES "grade_levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "grade_level_subjects" ADD CONSTRAINT "grade_level_subjects_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "teaching_assignments" ADD CONSTRAINT "teaching_assignments_school_year_id_fkey" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "teaching_assignments" ADD CONSTRAINT "teaching_assignments_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "teaching_assignments" ADD CONSTRAINT "teaching_assignments_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "teaching_assignments" ADD CONSTRAINT "teaching_assignments_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "subject_term_settings" ADD CONSTRAINT "subject_term_settings_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "subject_term_settings" ADD CONSTRAINT "subject_term_settings_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "academic_terms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "academic_terms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "evaluation_scores" ADD CONSTRAINT "evaluation_scores_evaluation_id_fkey" FOREIGN KEY ("evaluation_id") REFERENCES "evaluations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "evaluation_scores" ADD CONSTRAINT "evaluation_scores_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Integridad que Prisma no expresa (índices parciales / por expresión y CHECK)
CREATE UNIQUE INDEX "subjects_name_lower_key" ON "subjects" (lower("name"));
CREATE UNIQUE INDEX "teaching_assignments_single_active" ON "teaching_assignments" ("school_year_id","section_id","subject_id") WHERE "ended_at" IS NULL;
CREATE UNIQUE INDEX "evaluations_unique_name_active" ON "evaluations" ("term_id","section_id","subject_id", lower("name")) WHERE "voided_at" IS NULL;
CREATE UNIQUE INDEX "evaluations_single_lapso_active" ON "evaluations" ("term_id","section_id","subject_id") WHERE "kind" = 'LAPSO' AND "voided_at" IS NULL;
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_max_points_chk" CHECK ("max_points" > 0);
ALTER TABLE "evaluation_scores" ADD CONSTRAINT "evaluation_scores_points_chk" CHECK ("points" >= 0);
