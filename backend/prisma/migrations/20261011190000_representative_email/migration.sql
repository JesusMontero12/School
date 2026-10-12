-- Correo electrónico del representante (opcional).
-- No es único: dos representantes pueden compartir un correo familiar.
ALTER TABLE "representatives" ADD COLUMN "email" TEXT;
