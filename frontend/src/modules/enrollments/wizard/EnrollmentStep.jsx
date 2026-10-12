import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Field } from "../../../components/ui";
import { useAsync } from "../../../hooks/useAsync";
import { CONDITIONS, todayYmd } from "../../../utils/academic";
import { schoolYearsService } from "../../school-years/schoolYearsService";
import {
  gradeLevelsService,
  sectionsService,
} from "../../sections/sectionsService";

const schema = z.object({
  schoolYearId: z.string().min(1, "Elige el año escolar"),
  gradeLevelId: z.string().min(1, "Elige el año/grado"),
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
});

/** Paso 3: año escolar, sección con cupo disponible y datos del recibo. */
export default function EnrollmentStep({ value, onNext, onBack }) {
  const { data: years } = useAsync(schoolYearsService.options, []);
  const { data: grades } = useAsync(gradeLevelsService.list, []);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: value ?? {
      schoolYearId: "",
      gradeLevelId: "",
      sectionId: "",
      enrollmentDate: todayYmd(),
      receiptNumber: "",
      condition: "REGULAR",
      previousSchool: "",
      notes: "",
    },
  });
  const yearId = watch("schoolYearId");
  const gradeId = watch("gradeLevelId");

  const openYears = (years ?? []).filter((y) => y.status !== "CERRADO");
  // Si hay un solo año disponible o uno activo, se preselecciona.
  useEffect(() => {
    if (!value && years && !yearId) {
      const pick = openYears.find((y) => y.status === "ACTIVO") ?? openYears[0];
      if (pick) setValue("schoolYearId", pick.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [years]);

  const { data: sections, loading } = useAsync(
    () =>
      yearId && gradeId
        ? sectionsService.list({
            gradeLevelId: gradeId,
            schoolYearId: yearId,
            isActive: true,
          })
        : Promise.resolve({ data: [] }),
    [yearId, gradeId],
  );
  const year = openYears.find((y) => y.id === yearId);

  return (
    <form
      onSubmit={handleSubmit((v) =>
        onNext({
          ...v,
          receiptNumber: v.receiptNumber.replace(/\s+/g, "").toUpperCase(),
          labels: {
            year: year?.name,
            grade: grades?.find((g) => g.id === v.gradeLevelId)?.name,
            section: sections?.data.find((x) => x.id === v.sectionId)?.name,
          },
        }),
      )}
      noValidate
    >
      <div className="panel">
        <div className="panel-body">
          {years && openYears.length === 0 && (
            <div className="callout bad mb-3">
              No hay años escolares disponibles (planificados o activos). Crea
              uno en «Años escolares» antes de inscribir.
            </div>
          )}
          <div className="row g-3">
            <div className="col-md-4">
              <Field label="Año escolar" error={errors.schoolYearId?.message}>
                {(a11y) => (
                  <select
                    className="input"
                    {...a11y}
                    {...register("schoolYearId")}
                  >
                    <option value="">Selecciona…</option>
                    {openYears.map((y) => (
                      <option key={y.id} value={y.id}>
                        {y.name}
                        {y.status === "ACTIVO" ? " (activo)" : " (planificado)"}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            </div>
            <div className="col-md-4">
              <Field label="Año / grado" error={errors.gradeLevelId?.message}>
                {(a11y) => (
                  <select
                    className="input"
                    {...a11y}
                    {...register("gradeLevelId", {
                      onChange: () => setValue("sectionId", ""),
                    })}
                  >
                    <option value="">Selecciona…</option>
                    {grades
                      ?.filter((g) => g.isActive)
                      .map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                  </select>
                )}
              </Field>
            </div>
            <div className="col-md-4">
              <Field
                label="Sección"
                hint={
                  loading
                    ? "Consultando cupos…"
                    : yearId && gradeId && sections?.data.length === 0
                      ? "Este año/grado no tiene secciones activas."
                      : undefined
                }
                error={errors.sectionId?.message}
              >
                {(a11y) => (
                  <select
                    className="input"
                    disabled={!yearId || !gradeId}
                    {...a11y}
                    {...register("sectionId")}
                  >
                    <option value="">Selecciona…</option>
                    {sections?.data.map((s) => (
                      <option
                        key={s.id}
                        value={s.id}
                        disabled={s.available === 0}
                      >
                        Sección {s.name} —{" "}
                        {s.available === 0
                          ? "llena"
                          : `${s.available} cupos libres`}{" "}
                        ({s.occupied}/{s.maxCapacity})
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            </div>
            <div className="col-md-4">
              <Field
                label="Fecha de inscripción"
                type="date"
                max={year?.endDate}
                error={errors.enrollmentDate?.message}
                {...register("enrollmentDate")}
              />
            </div>
            <div className="col-md-4">
              <Field
                label="N.º de recibo"
                hint="Debe ser único"
                error={errors.receiptNumber?.message}
                {...register("receiptNumber")}
              />
            </div>
            <div className="col-md-4">
              <Field label="Condición" error={errors.condition?.message}>
                {(a11y) => (
                  <select
                    className="input"
                    {...a11y}
                    {...register("condition")}
                  >
                    {CONDITIONS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            </div>
          </div>
          <Field
            label="Plantel de procedencia (opcional)"
            error={errors.previousSchool?.message}
            {...register("previousSchool")}
          />
          <Field label="Observaciones (opcional)" error={errors.notes?.message}>
            {(a11y) => (
              <textarea className="input" {...a11y} {...register("notes")} />
            )}
          </Field>
          <div className="wizard-actions">
            <button
              type="button"
              className="btn-quiet"
              onClick={() => onBack(getValues())}
            >
              Atrás
            </button>
            <button className="btn-ink">Siguiente</button>
          </div>
        </div>
      </div>
    </form>
  );
}
