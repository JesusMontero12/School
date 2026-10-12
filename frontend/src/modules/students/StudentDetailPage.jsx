import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FiArrowLeft, FiEdit2, FiUser } from "react-icons/fi";
import { Can, EmptyState, Spinner } from "../../components/ui";
import {
  FilePick,
  KeyValues,
  PersonPhoto,
  StatusTag,
  Tabs,
  Tag,
} from "../../components/academic-ui";
import { useAsync } from "../../hooks/useAsync";
import { usePermission } from "../../hooks/usePermission";
import {
  ENROLLMENT_STATUS,
  ID_TYPES,
  SEXES,
  STUDENT_STATUS,
  formatDay,
  identification,
  labelOf,
  relationshipText,
} from "../../utils/academic";
import { notify } from "../../utils/alerts";
import { getErrorMessage } from "../../utils/errors";
import { useAuthStore } from "../auth/store/authStore";
import { gradeLevelsService } from "../sections/sectionsService";
import StudentFormDrawer from "./StudentFormDrawer";
import StudentHistory from "./StudentHistory";
import { studentsService } from "./studentsService";

const FAMILY_ROLES = ["REPRESENTANTE", "ESTUDIANTE"];

export default function StudentDetailPage() {
  const { id } = useParams();
  const { can } = usePermission();
  const roles = useAuthStore((s) => s.user?.roles ?? []);
  const staff = !(
    roles.length > 0 && roles.every((r) => FAMILY_ROLES.includes(r))
  );
  const [tab, setTab] = useState("data");
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState("");
  const [versions, setVersions] = useState({});

  const {
    data: s,
    loading,
    error,
    reload,
  } = useAsync(() => studentsService.get(id), [id]);
  const { data: grades } = useAsync(gradeLevelsService.list, []);

  if (loading && !s)
    return (
      <div className="panel-body">
        <Spinner />
      </div>
    );
  if (error)
    return (
      <div className="panel">
        <EmptyState
          icon={FiUser}
          title="No pudimos cargar al alumno"
          text={error}
        >
          <Link to="/students" className="btn-ink">
            Volver a alumnos
          </Link>
        </EmptyState>
      </div>
    );

  const uploadPhoto = async (gradeLevelId, file) => {
    setUploading(gradeLevelId);
    try {
      await studentsService.uploadPhoto(id, gradeLevelId, file);
      setVersions((v) => ({ ...v, [gradeLevelId]: Date.now() }));
      notify.success("Foto guardada");
      reload();
    } catch (e) {
      notify.error(getErrorMessage(e));
    } finally {
      setUploading("");
    }
  };

  const photoByGrade = new Map(s.photos.map((p) => [p.gradeLevel.id, p]));
  const tabs = [
    { value: "data", label: "Datos" },
    { value: "photos", label: "Fotos", count: s.photos.length },
    { value: "reps", label: "Representantes", count: s.representatives.length },
    {
      value: "enrollments",
      label: "Inscripciones",
      count: s.enrollments.length,
    },
    ...(staff ? [{ value: "history", label: "Historial" }] : []),
  ];

  return (
    <>
      <Link to="/students" className="page-back">
        <FiArrowLeft /> Alumnos
      </Link>
      <div className="panel mb-3">
        <div className="panel-body detail-head">
          <PersonPhoto
            size="lg"
            first={s.firstName}
            last={s.lastName}
            path={
              s.currentPhotoGradeLevelId
                ? studentsService.photoPath(s.id, s.currentPhotoGradeLevelId)
                : null
            }
            version={versions[s.currentPhotoGradeLevelId]}
          />
          <div>
            <h1>
              {s.firstName} {s.lastName}
            </h1>
            <div className="meta">
              <span>
                {identification(s.identificationType, s.identificationNumber)}
              </span>
              {s.sigesCode && <span>· SIGES {s.sigesCode}</span>}
              <StatusTag map={STUDENT_STATUS} value={s.status} />
            </div>
          </div>
          <span className="spacer" />
          <Can permission="student.edit">
            <button className="btn-quiet" onClick={() => setEditing(true)}>
              <FiEdit2 /> Editar datos
            </button>
          </Can>
        </div>
      </div>

      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      {tab === "data" && (
        <div className="panel">
          <div className="panel-body">
            <KeyValues
              items={[
                [
                  "Tipo de identificación",
                  labelOf(ID_TYPES, s.identificationType),
                ],
                ["Número", s.identificationNumber],
                ["Código SIGES", s.sigesCode],
                ["Correo electrónico", s.email],
                ["Fecha de nacimiento", formatDay(s.birthDate)],
                ["Lugar de nacimiento", s.birthPlace],
                ["Sexo", labelOf(SEXES, s.sex)],
                ["Dirección", s.address],
                ["Estado", STUDENT_STATUS[s.status]?.label],
              ]}
            />
          </div>
        </div>
      )}

      {tab === "photos" && (
        <div className="panel">
          <div className="panel-body">
            <p className="muted-text">
              Una foto por año/grado cursado. Si el alumno repite un grado, la
              foto nueva reemplaza a la anterior. Solo JPG o PNG.
            </p>
            <div className="photo-grid">
              {grades?.map((g) => {
                const p = photoByGrade.get(g.id);
                return (
                  <div key={g.id} className={`photo-slot ${p ? "filled" : ""}`}>
                    <PersonPhoto
                      size="lg"
                      first={s.firstName}
                      last={s.lastName}
                      path={p ? studentsService.photoPath(s.id, g.id) : null}
                      version={versions[g.id] ?? p?.updatedAt}
                    />
                    <strong>{g.name}</strong>
                    <small>{p ? p.schoolYear.name : "Sin foto"}</small>
                    <Can permission="student.edit">
                      <FilePick
                        onPick={(f) => uploadPhoto(g.id, f)}
                        disabled={uploading === g.id}
                      >
                        {uploading === g.id ? (
                          <Spinner />
                        ) : p ? (
                          "Reemplazar"
                        ) : (
                          "Subir foto"
                        )}
                      </FilePick>
                    </Can>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {tab === "reps" && (
        <div className="panel">
          {s.representatives.length === 0 ? (
            <EmptyState
              icon={FiUser}
              title="Sin representantes"
              text="Este alumno no tiene representantes vinculados."
            />
          ) : (
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
                  {s.representatives.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <strong>
                          {r.firstName} {r.lastName}
                        </strong>
                        {!r.isActive && (
                          <>
                            {" "}
                            <Tag tone="muted">Inactivo</Tag>
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
          )}
        </div>
      )}

      {tab === "enrollments" && (
        <div className="panel">
          {s.enrollments.length === 0 ? (
            <EmptyState
              icon={FiUser}
              title="Sin inscripciones"
              text="Este alumno todavía no tiene inscripciones."
            />
          ) : (
            <div className="table-scroll">
              <table className="data">
                <thead>
                  <tr>
                    <th>Año escolar</th>
                    <th>Año / sección</th>
                    <th>Fecha</th>
                    <th>Recibo</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {s.enrollments.map((e) => (
                    <tr key={e.id}>
                      <td>
                        {can("enrollment.view") ? (
                          <Link
                            className="row-link"
                            to={`/enrollments/${e.id}`}
                          >
                            {e.schoolYear.name}
                          </Link>
                        ) : (
                          e.schoolYear.name
                        )}
                      </td>
                      <td>
                        {e.gradeLevel.name} · {e.section.name}
                      </td>
                      <td>{formatDay(e.enrollmentDate)}</td>
                      <td>{e.receiptNumber}</td>
                      <td>
                        <StatusTag map={ENROLLMENT_STATUS} value={e.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "history" && staff && (
        <div className="panel">
          <StudentHistory studentId={id} />
        </div>
      )}

      {editing && (
        <StudentFormDrawer
          student={s}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            reload();
          }}
        />
      )}
    </>
  );
}
