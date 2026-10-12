import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FiClipboard, FiPlus, FiSearch } from "react-icons/fi";
import {
  Can,
  EmptyState,
  PageHeader,
  Pager,
  TableSkeleton,
} from "../../components/ui";
import { StatusTag, Tag } from "../../components/academic-ui";
import { useAsync } from "../../hooks/useAsync";
import { useDebounce } from "../../hooks/useDebounce";
import {
  ENROLLMENT_STATUS,
  formatDay,
  identification,
} from "../../utils/academic";
import { schoolYearsService } from "../school-years/schoolYearsService";
import { gradeLevelsService } from "../sections/sectionsService";
import { enrollmentsService } from "./enrollmentsService";

const EMPTY = {
  search: "",
  schoolYearId: "",
  gradeLevelId: "",
  status: "",
  documents: "",
  overdue: false,
};

export default function EnrollmentsPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState(EMPTY);
  const [page, setPage] = useState(1);
  const search = useDebounce(filters.search);

  const { data, loading, error, reload } = useAsync(
    () =>
      enrollmentsService.list({
        page,
        limit: 10,
        search: search || undefined,
        schoolYearId: filters.schoolYearId || undefined,
        gradeLevelId: filters.gradeLevelId || undefined,
        status: filters.status || undefined,
        documents: filters.documents || undefined,
        overdue: filters.overdue || undefined,
      }),
    [
      page,
      search,
      filters.schoolYearId,
      filters.gradeLevelId,
      filters.status,
      filters.documents,
      filters.overdue,
    ],
  );
  const { data: years } = useAsync(schoolYearsService.options, []);
  const { data: grades } = useAsync(gradeLevelsService.list, []);

  const setFilter = (k) => (e) => {
    setPage(1);
    setFilters((f) => ({
      ...f,
      [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
    }));
  };
  const filtered = !!(
    search ||
    filters.schoolYearId ||
    filters.gradeLevelId ||
    filters.status ||
    filters.documents ||
    filters.overdue
  );

  return (
    <>
      <PageHeader
        title="Inscripciones"
        description="Matrícula por año escolar. Pendiente y activa reservan cupo en la sección."
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
              placeholder="Buscar por alumno, cédula, SIGES o recibo"
              aria-label="Buscar inscripciones"
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
            {Object.entries(ENROLLMENT_STATUS).map(([v, s]) => (
              <option key={v} value={v}>
                {s.label}
              </option>
            ))}
          </select>
          <select
            className="input"
            aria-label="Filtrar por expediente"
            value={filters.documents}
            onChange={setFilter("documents")}
          >
            <option value="">Cualquier expediente</option>
            <option value="complete">Expediente completo</option>
            <option value="pending">Con documentos pendientes</option>
          </select>
          <label className="check-row" style={{ whiteSpace: "nowrap" }}>
            <input
              type="checkbox"
              checked={filters.overdue}
              onChange={setFilter("overdue")}
            />{" "}
            Plazo vencido
          </label>
        </div>

        {loading && !data ? (
          <TableSkeleton />
        ) : error ? (
          <EmptyState
            icon={FiClipboard}
            title="No pudimos cargar las inscripciones"
            text={error}
          >
            <button className="btn-ink" onClick={reload}>
              Reintentar
            </button>
          </EmptyState>
        ) : data.data.length === 0 ? (
          <EmptyState
            icon={FiClipboard}
            title={filtered ? "Sin resultados" : "Aún no hay inscripciones"}
            text={
              filtered
                ? "Prueba con otra búsqueda o quita algún filtro."
                : "Registra la primera inscripción para empezar la matrícula."
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
                  <th>Año escolar y sección</th>
                  <th>Recibo</th>
                  <th>Expediente</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((e) => (
                  <tr
                    key={e.id}
                    className="clickable"
                    onClick={() => navigate(`/enrollments/${e.id}`)}
                  >
                    <td>
                      <Link
                        className="row-link"
                        to={`/enrollments/${e.id}`}
                        onClick={(ev) => ev.stopPropagation()}
                      >
                        {e.student.lastName}, {e.student.firstName}
                      </Link>
                      <small className="d-block muted-text">
                        {identification(
                          e.student.identificationType,
                          e.student.identificationNumber,
                        )}
                      </small>
                    </td>
                    <td>
                      <strong style={{ fontWeight: 600 }}>
                        {e.gradeLevel.name} · {e.section.name}
                      </strong>
                      <small className="d-block muted-text">
                        {e.schoolYear.name}
                      </small>
                    </td>
                    <td>
                      {e.receiptNumber}
                      <small className="d-block muted-text">
                        {formatDay(e.enrollmentDate)}
                      </small>
                    </td>
                    <td>
                      {e.documents.complete ? (
                        <Tag tone="ok">Completo</Tag>
                      ) : (
                        <Tag tone="warn">
                          {e.documents.delivered}/{e.documents.required}{" "}
                          documentos
                        </Tag>
                      )}
                      {e.documentsOverdue && (
                        <>
                          {" "}
                          <Tag tone="bad">Plazo vencido</Tag>
                        </>
                      )}
                      {!e.documents.complete &&
                        e.documentsDueDate &&
                        !e.documentsOverdue && (
                          <small className="d-block muted-text">
                            Hasta {formatDay(e.documentsDueDate)}
                          </small>
                        )}
                    </td>
                    <td>
                      <StatusTag map={ENROLLMENT_STATUS} value={e.status} />
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
