import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Drawer, Field, Spinner } from "../../components/ui";
import {
  EMAIL_RE,
  ID_TYPES,
  SEXES,
  STUDENT_STATUS,
  normalizeId,
  todayYmd,
} from "../../utils/academic";
import { notify } from "../../utils/alerts";
import { getErrorMessage } from "../../utils/errors";
import { studentsService } from "./studentsService";

export const studentFields = {
  firstName: z
    .string()
    .trim()
    .min(2, "Mínimo 2 letras")
    .max(60, "Máximo 60 caracteres"),
  lastName: z
    .string()
    .trim()
    .min(2, "Mínimo 2 letras")
    .max(60, "Máximo 60 caracteres"),
  identificationType: z.enum(["CEDULA", "CEDULA_ESCOLAR"]),
  identificationNumber: z
    .string()
    .trim()
    .refine(
      (v) => /^[A-Z0-9]{4,20}$/.test(normalizeId(v)),
      "Entre 4 y 20 letras o números",
    ),
  sigesCode: z
    .string()
    .trim()
    .refine(
      (v) =>
        v === "" ||
        /^[A-Z0-9-]{3,30}$/.test(v.replace(/\s+/g, "").toUpperCase()),
      "Entre 3 y 30 letras, números o guiones",
    ),
  email: z
    .string()
    .trim()
    .max(120, "Máximo 120 caracteres")
    .refine(
      (v) => v === "" || EMAIL_RE.test(v),
      "Escribe un correo válido (ej. nombre@correo.com)",
    ),
  birthDate: z
    .string()
    .min(1, "Elige la fecha")
    .refine((v) => v <= todayYmd(), "No puede ser una fecha futura"),
  birthPlace: z
    .string()
    .trim()
    .min(2, "Mínimo 2 caracteres")
    .max(100, "Máximo 100 caracteres"),
  sex: z.enum(["MASCULINO", "FEMENINO"]),
  address: z
    .string()
    .trim()
    .min(5, "Mínimo 5 caracteres")
    .max(250, "Máximo 250 caracteres"),
};

/** Edición de los datos del alumno. Los alumnos nuevos se registran desde Inscripciones. */
export default function StudentFormDrawer({ student, onClose, onSaved }) {
  const [serverError, setServerError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(
      z.object({
        ...studentFields,
        status: z.enum(["ACTIVO", "INACTIVO", "RETIRADO", "EGRESADO"]),
      }),
    ),
    defaultValues: {
      firstName: student.firstName,
      lastName: student.lastName,
      identificationType: student.identificationType,
      identificationNumber: student.identificationNumber,
      sigesCode: student.sigesCode ?? "",
      email: student.email ?? "",
      birthDate: student.birthDate,
      birthPlace: student.birthPlace,
      sex: student.sex,
      address: student.address,
      status: student.status,
    },
  });

  const onSubmit = async (v) => {
    setServerError("");
    try {
      await studentsService.update(student.id, {
        ...v,
        sigesCode: v.sigesCode ? v.sigesCode : null,
        email: v.email ? v.email : null,
      });
      notify.success("Cambios guardados");
      onSaved();
    } catch (e) {
      setServerError(getErrorMessage(e));
    }
  };

  return (
    <Drawer
      title="Editar alumno"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-quiet" onClick={onClose}>
            Cancelar
          </button>
          <button
            form="student-form"
            className="btn-ink"
            disabled={isSubmitting}
          >
            {isSubmitting ? <Spinner /> : "Guardar cambios"}
          </button>
        </>
      }
    >
      {serverError && (
        <div className="alert-x" role="alert">
          {serverError}
        </div>
      )}
      <form id="student-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="row g-3">
          <div className="col-sm-6">
            <Field
              label="Nombres"
              error={errors.firstName?.message}
              {...register("firstName")}
            />
          </div>
          <div className="col-sm-6">
            <Field
              label="Apellidos"
              error={errors.lastName?.message}
              {...register("lastName")}
            />
          </div>
          <div className="col-sm-5">
            <Field
              label="Tipo de identificación"
              error={errors.identificationType?.message}
            >
              {(a11y) => (
                <select
                  className="input"
                  {...a11y}
                  {...register("identificationType")}
                >
                  {ID_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </div>
          <div className="col-sm-7">
            <Field
              label="Número"
              error={errors.identificationNumber?.message}
              {...register("identificationNumber")}
            />
          </div>
        </div>
        <Field
          label="Código SIGES (opcional)"
          hint="Déjalo vacío para quitarlo."
          error={errors.sigesCode?.message}
          {...register("sigesCode")}
        />
        <Field
          label="Correo electrónico (opcional)"
          type="email"
          autoComplete="off"
          hint="Déjalo vacío para quitarlo."
          error={errors.email?.message}
          {...register("email")}
        />
        <div className="row g-3">
          <div className="col-sm-6">
            <Field
              label="Fecha de nacimiento"
              type="date"
              max={todayYmd()}
              error={errors.birthDate?.message}
              {...register("birthDate")}
            />
          </div>
          <div className="col-sm-6">
            <Field label="Sexo" error={errors.sex?.message}>
              {(a11y) => (
                <select className="input" {...a11y} {...register("sex")}>
                  {SEXES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </div>
        </div>
        <Field
          label="Lugar de nacimiento"
          error={errors.birthPlace?.message}
          {...register("birthPlace")}
        />
        <Field
          label="Dirección"
          error={errors.address?.message}
          {...register("address")}
        />
        <Field
          label="Estado del alumno"
          hint="Para pasar a inactivo, retirado o egresado no debe tener inscripciones pendientes o activas."
          error={errors.status?.message}
        >
          {(a11y) => (
            <select className="input" {...a11y} {...register("status")}>
              {Object.entries(STUDENT_STATUS).map(([v, s]) => (
                <option key={v} value={v}>
                  {s.label}
                </option>
              ))}
            </select>
          )}
        </Field>
      </form>
    </Drawer>
  );
}
