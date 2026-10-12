import { useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  FiAlertTriangle,
  FiArrowLeft,
  FiClipboard,
  FiEdit2,
  FiEye,
  FiPaperclip,
  FiTrash2,
  FiUsers,
} from "react-icons/fi";
import { Can, EmptyState, Spinner } from "../../components/ui";
import {
  FilePick,
  KeyValues,
  StatusTag,
  Tag,
} from "../../components/academic-ui";
import { useAsync } from "../../hooks/useAsync";
import { usePermission } from "../../hooks/usePermission";
import {
  CONDITIONS,
  DOCUMENT_STATUS,
  ENROLLMENT_STATUS,
  YEAR_STATUS,
  bytes,
  formatDay,
  identification,
  labelOf,
  relationshipText,
} from "../../utils/academic";
import { confirmAction, notify } from "../../utils/alerts";
import { getErrorMessage } from "../../utils/errors";
import { openProtected } from "../../services/upload";
import EnrollmentFormDrawer from "./EnrollmentFormDrawer";
import EnrollmentRepresentativesDrawer from "./EnrollmentRepresentativesDrawer";
import EnrollmentStatusDrawer from "./EnrollmentStatusDrawer";
import { enrollmentsService } from "./enrollmentsService";

export default function EnrollmentDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const { can } = usePermission();
  const [drawer, setDrawer] = useState(null); // 'edit' | 'reps' | 'ACTIVA' | 'ANULADA' | 'RETIRADA'
  const [busyDoc, setBusyDoc] = useState("");
  const {
    data: e,
    loading,
    error,
    reload,
  } = useAsync(() => enrollmentsService.get(id), [id]);

  if (loading && !e)
    return (
      <div className="panel-body">
        <Spinner />
      </div>
    );
  if (error)
    return (
      <div className="panel">
        <EmptyState
          icon={FiClipboard}
          title="No pudimos cargar la inscripción"
          text={error}
        >
          <Link to="/enrollments" className="btn-ink">
            Volver a inscripciones
          </Link>
        </EmptyState>
      </div>
    );

  const canEdit = can("enrollment.edit") && e.allowedTransitions.length > 0;
  const warnings = location.state?.warnings ?? [];
  const pct = e.expediente.required
    ? Math.round((e.expediente.delivered / e.expediente.required) * 100)
    : 100;

  const doc = async (typeId, fn, okMsg) => {
    setBusyDoc(typeId);
    try {
      await fn();
      if (okMsg) notify.success(okMsg);
      reload();
    } catch (err) {
      notify.error(getErrorMessage(err));
    } finally {
      setBusyDoc("");
    }
  };
  const toggle = (d) =>
    doc(
      d.requirementTypeId,
      () =>
        enrollmentsService.updateDocument(id, d.requirementTypeId, {
          status: d.status === "ENTREGADO" ? "PENDIENTE" : "ENTREGADO",
        }),
      d.status === "ENTREGADO"
        ? "Documento marcado como pendiente"
        : "Documento marcado como entregado",
    );
  const upload = (d, file) =>
    doc(
      d.requirementTypeId,
      () =>
        enrollmentsService.uploadDocumentFile(id, d.requirementTypeId, file),
      "Archivo adjuntado",
    );
  const removeFile = async (d) => {
    const ok = await confirmAction({
      title: `¿Eliminar el archivo de «${d.name}»?`,
      text: "El documento seguirá con su estado actual; solo se borra el escaneo.",
      confirmText: "Eliminar archivo",
      danger: true,
    });
    if (ok)
      doc(
        d.requirementTypeId,
        () => enrollmentsService.removeDocumentFile(id, d.requirementTypeId),
        "Archivo eliminado",
      );
  };
  const view = async (d) => {
    try {
      await openProtected(
        enrollmentsService.documentFilePath(id, d.requirementTypeId),
      );
    } catch (err) {
      notify.error(getErrorMessage(err));
    }
  };

  return (
    <>
      <Link to="/enrollments" className="page-back">
        <FiArrowLeft /> Inscripciones
      </Link>

      {location.state?.created && (
        <div className="callout ok mb-3" role="status">
          Inscripción registrada correctamente
          {e.status === "PENDIENTE" ? " (pendiente de documentos)." : "."}
        </div>
      )}
      {warnings.length > 0 && (
        <div className="callout warn mb-3" role="alert">
          <FiAlertTriangle size={20} />
          <div>
            <strong>
              La inscripción se creó, pero algunos archivos no se pudieron
              subir:
            </strong>
            <ul className="mb-0">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
            Puedes volver a subirlos desde esta pantalla.
          </div>
        </div>
      )}

      <div className="panel mb-3">
        <div className="panel-body detail-head">
          <div>
            <h1>
              {e.student.firstName} {e.student.lastName}
            </h1>
            <div className="meta">
              <StatusTag map={ENROLLMENT_STATUS} value={e.status} />
              <span>
                {e.gradeLevel.name} · sección {e.section.name}
              </span>
              <span>· {e.schoolYear.name}</span>
              <StatusTag map={YEAR_STATUS} value={e.schoolYear.status} />
            </div>
          </div>
          <span className="spacer" />
          <div className="d-flex gap-2 flex-wrap">
            <Link to={`/students/${e.student.id}`} className="btn-quiet">
              Ver alumno
            </Link>
            <Can permission="enrollment.edit">
              {canEdit && (
                <button className="btn-quiet" onClick={() => setDrawer("edit")}>
                  <FiEdit2 /> Editar
                </button>
              )}
              {e.allowedTransitions.includes("ACTIVA") && (
                <button
                  className="btn-ink"
                  disabled={!e.canActivate}
                  title={
                    e.canActivate
                      ? undefined
                      : "Completa el expediente y asigna un representante principal"
                  }
                  onClick={() => setDrawer("ACTIVA")}
                >
                  Activar
                </button>
              )}
              {e.allowedTransitions.includes("ANULADA") && (
                <button
                  className="btn-danger-soft"
                  onClick={() => setDrawer("ANULADA")}
                >
                  Anular
                </button>
              )}
              {e.allowedTransitions.includes("RETIRADA") && (
                <button
                  className="btn-danger-soft"
                  onClick={() => setDrawer("RETIRADA")}
                >
                  Retirar alumno
                </button>
              )}
            </Can>
          </div>
        </div>
      </div>

      {e.documentsOverdue && (
        <div className="callout bad mb-3" role="alert">
          <FiAlertTriangle size={20} />
          <div>
            <strong>Plazo vencido.</strong> Los documentos debían entregarse el{" "}
            {formatDay(e.documentsDueDate)}. La inscripción sigue pendiente y
            reservando cupo: actívala cuando se complete o anúlala.
          </div>
        </div>
      )}
      {e.status === "PENDIENTE" &&
        !e.documentsOverdue &&
        !e.expediente.complete && (
          <div className="callout warn mb-3">
            <div>
              Faltan {e.expediente.missing.length} documento(s) obligatorio(s):{" "}
              {e.expediente.missing.join(", ")}.
              {e.documentsDueDate && (
                <>
                  {" "}
                  Plazo: <strong>{formatDay(e.documentsDueDate)}</strong>.
                </>
              )}
            </div>
          </div>
        )}
      {e.status === "PENDIENTE" && e.expediente.complete && !e.canActivate && (
        <div className="callout warn mb-3">
          <div>
            El expediente está completo, pero aún no se puede activar. Revisa
            que haya un representante principal y que el año escolar y el alumno
            estén vigentes.
          </div>
        </div>
      )}
      {e.status === "PENDIENTE" && e.canActivate && (
        <div className="callout ok mb-3">
          <div>
            Expediente completo: ya puedes <strong>activar</strong> la
            inscripción.
          </div>
        </div>
      )}

      <div className="stack">
        <div className="panel">
          <div className="panel-title">
            <h2>Datos de la inscripción</h2>
          </div>
          <div className="panel-body">
            <KeyValues
              items={[
                ["Recibo", e.receiptNumber],
                ["Fecha de inscripción", formatDay(e.enrollmentDate)],
                ["Condición", labelOf(CONDITIONS, e.condition)],
                ["Plantel de procedencia", e.previousSchool],
                e.status === "PENDIENTE" && [
                  "Plazo de documentos",
                  e.documentsDueDate
                    ? formatDay(e.documentsDueDate)
                    : "Sin plazo",
                ],
                ["Alumno", `${e.student.lastName}, ${e.student.firstName}`],
                [
                  "Identificación",
                  identification(
                    e.student.identificationType,
                    e.student.identificationNumber,
                  ),
                ],
                ["Código SIGES", e.student.sigesCode],
                ["Correo electrónico", e.student.email],
                ["Cupo de la sección", `${e.section.maxCapacity} máximo`],
                ["Observaciones", e.notes],
              ]}
            />
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">
            <h2>Representantes</h2>
            <Can permission="enrollment.edit">
              {canEdit && (
                <button className="btn-quiet" onClick={() => setDrawer("reps")}>
                  <FiUsers /> Cambiar representantes
                </button>
              )}
            </Can>
          </div>
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>Representante</th>
                  <th>Parentesco</th>
                  <th>Cédula</th>
                  <th>Teléfono</th>
                </tr>
              </thead>
              <tbody>
                {e.representatives.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>
                        {r.firstName} {r.lastName}
                      </strong>
                      {r.isPrimary && (
                        <>
                          {" "}
                          <Tag tone="info">Principal</Tag>
                        </>
                      )}
                    </td>
                    <td>
                      {relationshipText(r.relationship, r.relationshipDetail)}
                    </td>
                    <td>{r.documentId}</td>
                    <td>{r.phone ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">
            <h2>Documentos</h2>
            <span className="muted-text">
              {e.expediente.delivered} de {e.expediente.required} obligatorios
              {e.expediente.complete && " · expediente completo"}
            </span>
          </div>
          <div style={{ padding: "0 1.25rem" }}>
            <div
              className="progress mt-3"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Documentos obligatorios entregados"
            >
              <span style={{ width: `${pct}%` }} />
            </div>
          </div>
          {e.documents.map((d) => {
            const busy = busyDoc === d.requirementTypeId;
            return (
              <div className="doc-row" key={d.requirementTypeId}>
                <div>
                  <div className="name">
                    {d.name}{" "}
                    <Tag tone={d.isRequired ? "info" : "muted"}>
                      {d.isRequired ? "Obligatorio" : "Opcional"}
                    </Tag>{" "}
                    <StatusTag map={DOCUMENT_STATUS} value={d.status} />
                  </div>
                  <small>
                    {d.status === "ENTREGADO" && d.deliveredAt
                      ? `Entregado el ${formatDay(d.deliveredAt)}`
                      : "Aún no entregado"}
                    {d.hasFile && (
                      <>
                        {" "}
                        · <FiPaperclip /> {d.originalName} ({bytes(d.sizeBytes)}
                        )
                      </>
                    )}
                  </small>
                </div>
                <div className="doc-actions">
                  {busy && <Spinner />}
                  {d.hasFile && (
                    <button className="btn-quiet" onClick={() => view(d)}>
                      <FiEye /> Ver
                    </button>
                  )}
                  {canEdit && (
                    <>
                      <button
                        className="btn-quiet"
                        disabled={busy}
                        onClick={() => toggle(d)}
                      >
                        {d.status === "ENTREGADO"
                          ? "Marcar pendiente"
                          : "Marcar entregado"}
                      </button>
                      <FilePick
                        accept="image/jpeg,image/png,application/pdf"
                        disabled={busy}
                        onPick={(f) => upload(d, f)}
                      >
                        {d.hasFile ? "Reemplazar" : "Adjuntar"}
                      </FilePick>
                      {d.hasFile && (
                        <button
                          className="icon-btn danger"
                          aria-label={`Eliminar archivo de ${d.name}`}
                          disabled={busy}
                          onClick={() => removeFile(d)}
                        >
                          <FiTrash2 />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {drawer === "edit" && (
        <EnrollmentFormDrawer
          enrollment={e}
          onClose={() => setDrawer(null)}
          onSaved={() => {
            setDrawer(null);
            reload();
          }}
        />
      )}
      {drawer === "reps" && (
        <EnrollmentRepresentativesDrawer
          enrollment={e}
          onClose={() => setDrawer(null)}
          onSaved={() => {
            setDrawer(null);
            reload();
          }}
        />
      )}
      {["ACTIVA", "ANULADA", "RETIRADA"].includes(drawer) && (
        <EnrollmentStatusDrawer
          enrollment={e}
          target={drawer}
          onClose={() => setDrawer(null)}
          onSaved={() => {
            setDrawer(null);
            reload();
          }}
        />
      )}
    </>
  );
}
