import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FiPlus, FiSearch, FiUsers } from "react-icons/fi";
import {
  Can,
  EmptyState,
  PageHeader,
  Pager,
  TableSkeleton,
} from "../../components/ui";
import { PersonPhoto, StatusTag } from "../../components/academic-ui";
import { useAsync } from "../../hooks/useAsync";
import { useDebounce } from "../../hooks/useDebounce";
import {
  ENROLLMENT_STATUS,
  STUDENT_STATUS,
  identification,
} from "../../utils/academic";
import { gradeLevelsService } from "../sections/sectionsService";
import { schoolYearsService } from "../school-years/schoolYearsService";
import { studentsService } from "./studentsService";

export default function StudentsPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    search: "",
    status: "",
    schoolYearId: "",
    gradeLevelId: "",
  });
  const [page, setPage] = useState(1);
  const search = useDebounce(filters.search);

  const { data, loading, error, reload } = useAsync(
    () =>
      studentsService.list({
        page,
        limit: 10,
        search: search || undefined,
        status: filters.status || undefined,
        schoolYearId: filters.schoolYearId || undefined,
        gradeLevelId: filters.gradeLevelId || undefined,
      }),
    [page, search, filters.status, filters.schoolYearId, filters.gradeLevelId],
  );
  const { data: years } = useAsync(schoolYearsService.options, []);
  const { data: grades } = useAsync(gradeLevelsService.list, []);

  const setFilter = (k) => (e) => {
    setPage(1);
    setFilters((f) => ({ ...f, [k]: e.target.value }));
  };
  const filtered = !!(
    search ||
    filters.status ||
    filters.schoolYearId ||
    filters.gradeLevelId
  );

  return (
    <>
      <PageHeader
        title="Alumnos"
        description="Consulta y actualiza los datos de los alumnos. Los alumnos nuevos se registran al inscribirlos."
      >
        <Can permission="enrollment.create">
          <Link to="/enrollments/new" className="btn-pencil">
            <FiPlus /> Nueva inscripción
          </Link>
        </Can>
      </PageHeader>

      <div className="panel">
        <div className="toolbar">
          <div className="search">
            <FiSearch aria-hidden />
            <input
              className="input"
              type="search"
              placeholder="Buscar por nombre, cédula o código SIGES"
              aria-label="Buscar alumnos"
              value={filters.search}
              onChange={setFilter("search")}
            />
          </div>
          <select
            className="input"
            aria-label="Filtrar por año escolar"
            value={filters.schoolYearId}
            onChange={setFilter("schoolYearId")}
          >
            <option value="">Todos los años escolares</option>
            {years?.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
              </option>
            ))}
          </select>
          <select
            className="input"
            aria-label="Filtrar por año/grado"
            value={filters.gradeLevelId}
            onChange={setFilter("gradeLevelId")}
          >
            <option value="">Todos los años/grados</option>
            {grades?.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <select
            className="input"
            aria-label="Filtrar por estado"
            value={filters.status}
            onChange={setFilter("status")}
          >
            <option value="">Cualquier estado</option>
            {Object.entries(STUDENT_STATUS).map(([v, s]) => (
              <option key={v} value={v}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {loading && !data ? (
          <TableSkeleton />
        ) : error ? (
          <EmptyState
            icon={FiUsers}
            title="No pudimos cargar los alumnos"
            text={error}
          >
            <button className="btn-ink" onClick={reload}>
              Reintentar
            </button>
          </EmptyState>
        ) : data.data.length === 0 ? (
          <EmptyState
            icon={FiUsers}
            title={filtered ? "Sin resultados" : "Aún no hay alumnos"}
            text={
              filtered
                ? "Prueba con otro nombre o quita algún filtro."
                : "Los alumnos aparecen aquí cuando se registra su primera inscripción."
            }
          >
            {!filtered && (
              <Can permission="enrollment.create">
                <Link to="/enrollments/new" className="btn-pencil">
                  <FiPlus /> Nueva inscripción
                </Link>
              </Can>
            )}
          </EmptyState>
        ) : (
          <div
            className="table-scroll"
            style={{ opacity: loading ? 0.55 : 1, transition: "opacity .15s" }}
          >
            <table className="data">
              <thead>
                <tr>
                  <th>Alumno</th>
                  <th>Identificación</th>
                  <th>Última inscripción</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((s) => (
                  <tr
                    key={s.id}
                    className="clickable"
                    onClick={() => navigate(`/students/${s.id}`)}
                  >
                    <td>
                      <div className="person">
                        <PersonPhoto
                          size="sm"
                          first={s.firstName}
                          last={s.lastName}
                          path={
                            s.currentPhotoGradeLevelId
                              ? studentsService.photoPath(
                                  s.id,
                                  s.currentPhotoGradeLevelId,
                                )
                              : null
                          }
                        />
                        <div>
                          <Link
                            className="row-link"
                            to={`/students/${s.id}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {s.lastName}, {s.firstName}
                          </Link>
                          {s.sigesCode && <small>SIGES {s.sigesCode}</small>}
                        </div>
                      </div>
                    </td>
                    <td>
                      {identification(
                        s.identificationType,
                        s.identificationNumber,
                      )}
                    </td>
                    <td>
                      {s.lastEnrollment ? (
                        <div>
                          <strong style={{ fontWeight: 600 }}>
                            {s.lastEnrollment.gradeLevel.name} ·{" "}
                            {s.lastEnrollment.section.name}
                          </strong>
                          <small className="d-block muted-text">
                            {s.lastEnrollment.schoolYear.name}{" "}
                            <StatusTag
                              map={ENROLLMENT_STATUS}
                              value={s.lastEnrollment.status}
                            />
                          </small>
                        </div>
                      ) : (
                        <span className="muted-text">Sin inscripción</span>
                      )}
                    </td>
                    <td>
                      <StatusTag map={STUDENT_STATUS} value={s.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager meta={data?.meta} onPage={setPage} />
      </div>
    </>
  );
}
