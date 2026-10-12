-- Correo electrónico del alumno (opcional).
-- No es único: hermanos pueden compartir el mismo correo familiar.
ALTER TABLE "students" ADD COLUMN "email" TEXT;
