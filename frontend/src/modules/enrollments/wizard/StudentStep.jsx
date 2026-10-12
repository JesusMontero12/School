import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FiSearch } from "react-icons/fi";
import { Field, Spinner } from "../../../components/ui";
import { PhotoPicker, StatusTag } from "../../../components/academic-ui";
import { useAsync } from "../../../hooks/useAsync";
import { useDebounce } from "../../../hooks/useDebounce";
import {
  ID_TYPES,
  SEXES,
  STUDENT_STATUS,
  formatAge,
  identification,
  todayYmd,
} from "../../../utils/academic";
import { studentFields } from "../../students/StudentFormDrawer";
import { enrollmentsService } from "../enrollmentsService";

const schema = z.object(studentFields);
const blank = {
  firstName: "",
  lastName: "",
  identificationType: "CEDULA",
  identificationNumber: "",
  sigesCode: "",
  email: "",
  birthDate: "",
  birthPlace: "",
  sex: "MASCULINO",
  address: "",
};

function ExistingStudent({ selected, onSelect }) {
  const [term, setTerm] = useState("");
  const search = useDebounce(term);
  const active = search.trim().length >= 2;
  const { data, loading } = useAsync(
    () =>
      active
        ? enrollmentsService.lookupStudents(search.trim())
        : Promise.resolve([]),
    [search],
  );

  if (selected) {
    return (
      <div className="selected-card">
        <div className="grow">
          <strong>
            {selected.firstName} {selected.lastName}
          </strong>
          <small className="d-block muted-text">
            {identification(
              selected.identificationType,
              selected.identificationNumber,
            )}
            {selected.sigesCode ? ` · SIGES ${selected.sigesCode}` : ""}
          </small>
        </div>
        <button
          type="button"
          className="btn-quiet"
          onClick={() => onSelect(null)}
        >
          Cambiar
        </button>
      </div>
    );
  }
  return (
    <div>
      <div className="toolbar" style={{ padding: 0, border: 0 }}>
        <div className="search">
          <FiSearch aria-hidden />
          <input
            className="input"
            type="search"
            placeholder="Buscar alumno por nombre, cédula o código SIGES"
            aria-label="Buscar alumno registrado"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
        </div>
      </div>
      {loading && active && (
        <div className="mt-2">
          <Spinner />
        </div>
      )}
      {active && !loading && data?.length === 0 && (
        <p className="muted-text mt-2 mb-0">
          No hay coincidencias. Si es la primera vez que se inscribe, elige
          «Alumno nuevo».
        </p>
      )}
      {data?.length > 0 && (
        <div className="pick-list">
          {data.map((s) => {
            const blocked = s.status !== "ACTIVO";
            return (
              <button
                type="button"
                key={s.id}
                className="pick"
                disabled={blocked}
                onClick={() => onSelect(s)}
              >
                <div className="grow">
                  <strong>
                    {s.lastName}, {s.firstName}
                  </strong>
                  <small>
                    {identification(
                      s.identificationType,
                      s.identificationNumber,
                    )}
                    {s.openEnrollments.length > 0 &&
                      ` · Inscripción vigente: ${s.openEnrollments.map((e) => `${e.gradeLevel} ${e.schoolYear.name}`).join(", ")}`}
                  </small>
                </div>
                <StatusTag map={STUDENT_STATUS} value={s.status} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Paso 1: reutilizar un alumno registrado o capturar uno nuevo. */
export default function StudentStep({ value, onNext, photo, onPhoto }) {
  const [mode, setMode] = useState(value.mode);
  const [selected, setSelected] = useState(value.student ?? null);
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: value.data ?? blank,
  });

  const nextExisting = () => {
    if (!selected) return setError("Selecciona un alumno de la lista.");
    setError("");
    onNext({ mode: "existing", student: selected });
  };
  const nextNew = handleSubmit((data) => onNext({ mode: "new", data }));
  const age = formatAge(watch("birthDate"));

  return (
    <div className="panel">
      <div className="panel-body">
        <div
          className="mode-switch"
          role="tablist"
          aria-label="Origen del alumno"
        >
          <button
            type="button"
            className={mode === "existing" ? "active" : ""}
            onClick={() => setMode("existing")}
          >
            Alumno ya registrado
          </button>
          <button
            type="button"
            className={mode === "new" ? "active" : ""}
            onClick={() => setMode("new")}
          >
            Alumno nuevo
          </button>
        </div>

        {mode === "existing" ? (
          <>
            <ExistingStudent selected={selected} onSelect={setSelected} />
            {selected && (
              <div className="mt-3">
                <PhotoPicker
                  file={photo}
                  onChange={onPhoto}
                  label="Foto del alumno para este año/grado (opcional)"
                />
              </div>
            )}
            {error && (
              <span className="error d-block mt-2" role="alert">
                {error}
              </span>
            )}
            <div className="wizard-actions">
              <span />
              <button type="button" className="btn-ink" onClick={nextExisting}>
                Siguiente
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={nextNew} noValidate>
            <PhotoPicker
              file={photo}
              onChange={onPhoto}
              label="Foto del alumno"
              hint="Se guarda en su historial fotográfico. JPG o PNG, hasta 5 MB."
            />
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
              <div className="col-sm-4">
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
              <div className="col-sm-4">
                <Field
                  label="Número"
                  hint="Cédula o cédula escolar"
                  error={errors.identificationNumber?.message}
                  {...register("identificationNumber")}
                />
              </div>
              <div className="col-sm-4">
                <Field
                  label="Código SIGES (opcional)"
                  error={errors.sigesCode?.message}
                  {...register("sigesCode")}
                />
              </div>
              <div className="col-sm-4">
                <Field
                  label="Fecha de nacimiento"
                  type="date"
                  max={todayYmd()}
                  error={errors.birthDate?.message}
                  {...register("birthDate")}
                />
              </div>
              <div className="col-sm-4">
                <Field
                  label="Edad (años)"
                  value={age}
                  placeholder="—"
                  readOnly
                  tabIndex={-1}
                  hint="Se calcula con la fecha de nacimiento"
                />
              </div>
              <div className="col-sm-4">
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
              <div className="col-sm-6">
                <Field
                  label="Lugar de nacimiento"
                  error={errors.birthPlace?.message}
                  {...register("birthPlace")}
                />
              </div>
              <div className="col-sm-6">
                <Field
                  label="Correo electrónico (opcional)"
                  type="email"
                  autoComplete="off"
                  error={errors.email?.message}
                  {...register("email")}
                />
              </div>
            </div>
            <Field
              label="Dirección"
              error={errors.address?.message}
              {...register("address")}
            />
            <div className="wizard-actions">
              <span />
              <button className="btn-ink">Siguiente</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
