import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Drawer, Field, Spinner } from "../../components/ui";
import { useAsync } from "../../hooks/useAsync";
import { CONDITIONS } from "../../utils/academic";
import { notify } from "../../utils/alerts";
import { getErrorMessage } from "../../utils/errors";
import { sectionsService } from "../sections/sectionsService";
import { enrollmentsService } from "./enrollmentsService";

const schema = z.object({
  sectionId: z.string().min(1, "Elige la sección"),
  enrollmentDate: z.string().min(1, "Elige la fecha"),
  receiptNumber: z
    .string()
    .trim()
    .refine(
      (v) =>
        /^[A-Z0-9][A-Z0-9\-/.]{1,29}$/.test(
          v.replace(/\s+/g, "").toUpperCase(),
        ),
      "Entre 2 y 30 caracteres (letras, números, - / .)",
    ),
  condition: z.enum(CONDITIONS.map((c) => c.value)),
  previousSchool: z.string().trim().max(150, "Máximo 150 caracteres"),
  notes: z.string().trim().max(500, "Máximo 500 caracteres"),
  documentsDueDate: z.string(),
});

/** Edita los datos de una inscripción vigente (sección dentro del mismo año escolar, recibo, plazo…). */
export default function EnrollmentFormDrawer({ enrollment, onClose, onSaved }) {
  const [serverError, setServerError] = useState("");
  const pending = enrollment.status === "PENDIENTE";
  const { data: sections } = useAsync(
    () =>
      sectionsService.list({
        schoolYearId: enrollment.schoolYear.id,
        isActive: true,
      }),
    [enrollment.schoolYear.id],
  );
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      sectionId: enrollment.section.id,
      enrollmentDate: enrollment.enrollmentDate,
      receiptNumber: enrollment.receiptNumber,
      condition: enrollment.condition,
      previousSchool: enrollment.previousSchool ?? "",
      notes: enrollment.notes ?? "",
      documentsDueDate: enrollment.documentsDueDate ?? "",
    },
  });

  const groups = useMemo(() => {
    const map = new Map();
    sections?.data.forEach((s) =>
      map.set(s.gradeLevel.name, [...(map.get(s.gradeLevel.name) ?? []), s]),
    );
    return [...map.entries()];
  }, [sections]);

  const onSubmit = async (v) => {
    setServerError("");
    const body = {
      enrollmentDate: v.enrollmentDate,
      receiptNumber: v.receiptNumber.replace(/\s+/g, "").toUpperCase(),
      condition: v.condition,
      previousSchool: v.previousSchool || null,
      notes: v.notes || null,
    };
    if (v.sectionId !== enrollment.section.id) body.sectionId = v.sectionId;
    if (pending) body.documentsDueDate = v.documentsDueDate || null;
    try {
      await enrollmentsService.update(enrollment.id, body);
      notify.success("Cambios guardados");
      onSaved();
    } catch (e) {
      setServerError(getErrorMessage(e));
    }
  };

  return (
    <Drawer
      title="Editar inscripción"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-quiet" onClick={onClose}>
            Cancelar
          </button>
          <button
            form="enrollment-form"
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
      <form id="enrollment-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Field
          label="Sección"
          hint={`Año escolar ${enrollment.schoolYear.name}. Cambiarla reserva el cupo en la nueva sección.`}
          error={errors.sectionId?.message}
        >
          {(a11y) => (
            <select className="input" {...a11y} {...register("sectionId")}>
              {groups.map(([grade, list]) => (
                <optgroup key={grade} label={grade}>
                  {list.map((s) => (
                    <option
                      key={s.id}
                      value={s.id}
                      disabled={
                        s.available === 0 && s.id !== enrollment.section.id
                      }
                    >
                      Sección {s.name} ({s.occupied}/{s.maxCapacity})
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          )}
        </Field>
        <div className="row g-3">
          <div className="col-sm-6">
            <Field
              label="Fecha de inscripción"
              type="date"
              error={errors.enrollmentDate?.message}
              {...register("enrollmentDate")}
            />
          </div>
          <div className="col-sm-6">
            <Field
              label="N.º de recibo"
              error={errors.receiptNumber?.message}
              {...register("receiptNumber")}
            />
          </div>
        </div>
        <Field label="Condición" error={errors.condition?.message}>
          {(a11y) => (
            <select className="input" {...a11y} {...register("condition")}>
              {CONDITIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          )}
        </Field>
        {pending && (
          <Field
            label="Plazo para entregar documentos"
            type="date"
            hint="Vacío = sin plazo."
            error={errors.documentsDueDate?.message}
            {...register("documentsDueDate")}
          />
        )}
        <Field
          label="Plantel de procedencia"
          error={errors.previousSchool?.message}
          {...register("previousSchool")}
        />
        <Field label="Observaciones" error={errors.notes?.message}>
          {(a11y) => (
            <textarea className="input" {...a11y} {...register("notes")} />
          )}
        </Field>
      </form>
    </Drawer>
  );
}
