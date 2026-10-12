import { FiCheckCircle, FiPaperclip } from "react-icons/fi";
import { Field, Spinner } from "../../../components/ui";
import { FilePick, Tag } from "../../../components/academic-ui";
import { bytes, identification } from "../../../utils/academic";

/** Paso 4: requisitos entregados, escaneos opcionales, foto del alumno y resumen. */
export default function DocumentsStep({
  requirements,
  docs,
  onDocs,
  studentPhoto,
  dueDate,
  onDueDate,
  summary,
  submitting,
  error,
  onBack,
  onSubmit,
}) {
  const set = (id, changes) =>
    onDocs({
      ...docs,
      [id]: { delivered: false, file: null, ...docs[id], ...changes },
    });
  const required = requirements.filter((r) => r.isRequired);
  const delivered = required.filter((r) => docs[r.id]?.delivered).length;
  const complete = delivered === required.length;

  return (
    <div className="stack">
      <div className="panel">
        <div className="panel-title">
          <h2>Requisitos</h2>
          <span className="muted-text">
            {delivered} de {required.length} obligatorios entregados
          </span>
        </div>
        <div style={{ padding: "0 1.25rem" }}>
          <div className="progress mt-3" aria-hidden>
            <span
              style={{
                width: required.length
                  ? `${(delivered / required.length) * 100}%`
                  : "100%",
              }}
            />
          </div>
        </div>
        {requirements.map((r) => {
          const d = docs[r.id] ?? { delivered: false, file: null };
          return (
            <div className="doc-row" key={r.id}>
              <div>
                <label className="name check-row">
                  <input
                    type="checkbox"
                    checked={d.delivered}
                    disabled={!!d.file}
                    onChange={(e) => set(r.id, { delivered: e.target.checked })}
                  />
                  {r.name}{" "}
                  <Tag tone={r.isRequired ? "info" : "muted"}>
                    {r.isRequired ? "Obligatorio" : "Opcional"}
                  </Tag>
                </label>
                {d.file && (
                  <small>
                    <FiPaperclip /> {d.file.name} · {bytes(d.file.size)}
                  </small>
                )}
              </div>
              <div className="doc-actions">
                <FilePick
                  accept="image/jpeg,image/png,application/pdf"
                  onPick={(f) => set(r.id, { file: f, delivered: true })}
                >
                  {d.file ? "Cambiar archivo" : "Adjuntar escaneo"}
                </FilePick>
                {d.file && (
                  <button
                    type="button"
                    className="btn-quiet"
                    onClick={() => set(r.id, { file: null })}
                  >
                    Quitar
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="panel">
        <div className="panel-body">
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1.05rem",
              fontWeight: 700,
            }}
          >
            Resumen
          </h2>
          <ul className="mb-3" style={{ paddingLeft: "1.1rem" }}>
            <li>
              <strong>{summary.studentName}</strong> ·{" "}
              {summary.studentId
                ? identification(
                    summary.studentId.type,
                    summary.studentId.number,
                  )
                : ""}
              {summary.isNewStudent
                ? " (alumno nuevo)"
                : " (alumno ya registrado)"}
            </li>
            <li>
              {summary.gradeName} · sección {summary.sectionName} · año escolar{" "}
              {summary.yearName}
            </li>
            <li>
              Recibo {summary.receipt} · {summary.repsCount} representante(s) ·{" "}
              {studentPhoto ? "con foto del alumno" : "sin foto del alumno"}
            </li>
          </ul>
          {complete ? (
            <div className="callout ok">
              <FiCheckCircle size={20} />
              <div>
                Todos los requisitos obligatorios están entregados: la
                inscripción quedará <strong>ACTIVA</strong>.
              </div>
            </div>
          ) : (
            <>
              <div className="callout warn mb-3">
                <div>
                  Faltan requisitos obligatorios: la inscripción quedará{" "}
                  <strong>PENDIENTE</strong> y reservará cupo hasta completar el
                  expediente o anularla.
                </div>
              </div>
              <Field
                label="Plazo para entregar los documentos (opcional)"
                type="date"
                hint="Si lo dejas vacío, se usa el plazo estándar (30 días)."
                value={dueDate}
                onChange={(e) => onDueDate(e.target.value)}
              />
            </>
          )}
          {error && (
            <div className="alert-x mt-3" role="alert">
              {error}
            </div>
          )}
          <div className="wizard-actions">
            <button
              type="button"
              className="btn-quiet"
              onClick={onBack}
              disabled={submitting}
            >
              Atrás
            </button>
            <button
              type="button"
              className="btn-pencil"
              onClick={onSubmit}
              disabled={submitting}
            >
              {submitting ? <Spinner /> : "Registrar inscripción"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
