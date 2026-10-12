import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FiArrowLeft, FiCheck } from "react-icons/fi";
import { PageHeader, Spinner } from "../../components/ui";
import { useAsync } from "../../hooks/useAsync";
import { normalizeId } from "../../utils/academic";
import { getErrorMessage } from "../../utils/errors";
import { requirementsService } from "../requirements/requirementsService";
import { enrollmentsService } from "./enrollmentsService";
import { repsFromStudent, repsPayload } from "./representativesForm";
import DocumentsStep from "./wizard/DocumentsStep";
import EnrollmentStep from "./wizard/EnrollmentStep";
import RepresentativesStep from "./wizard/RepresentativesStep";
import StudentStep from "./wizard/StudentStep";

const STEPS = [
  "Alumno",
  "Representantes",
  "Inscripción",
  "Documentos y confirmación",
];

const text = (v) => (v && v.trim() ? v.trim() : undefined);

/** Flujo central: aquí nacen los alumnos y representantes nuevos. Todo se registra en una sola operación. */
export default function EnrollmentWizardPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [student, setStudent] = useState({
    mode: "existing",
    student: null,
    data: null,
  });
  const [reps, setReps] = useState([]);
  const [enrollment, setEnrollment] = useState(null);
  const [docs, setDocs] = useState({});
  const [studentPhoto, setStudentPhoto] = useState(null);
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const {
    data: requirements,
    loading,
    error: reqError,
    reload,
  } = useAsync(() => requirementsService.list({ active: "true" }), []);

  const nextFromStudent = (value) => {
    // Si se elige un alumno existente distinto, se precargan sus representantes.
    if (value.mode === "existing" && value.student?.id !== student.student?.id)
      setReps(repsFromStudent(value.student));
    if (value.mode === "new" && student.mode === "existing") setReps([]);
    setStudent({ ...student, ...value });
    setStep(1);
  };

  const summary = {
    studentName:
      student.mode === "existing"
        ? `${student.student?.firstName} ${student.student?.lastName}`
        : `${student.data?.firstName} ${student.data?.lastName}`,
    studentId:
      student.mode === "existing"
        ? {
            type: student.student?.identificationType,
            number: student.student?.identificationNumber,
          }
        : {
            type: student.data?.identificationType,
            number: normalizeId(student.data?.identificationNumber ?? ""),
          },
    isNewStudent: student.mode === "new",
    gradeName: enrollment?.labels?.grade,
    sectionName: enrollment?.labels?.section,
    yearName: enrollment?.labels?.year,
    receipt: enrollment?.receiptNumber,
    repsCount: reps.length,
  };

  const submit = async () => {
    setError("");
    setSubmitting(true);
    const required = requirements.filter((r) => r.isRequired);
    const complete = required.every((r) => docs[r.id]?.delivered);
    let created;
    try {
      created = await enrollmentsService.create({
        student:
          student.mode === "existing"
            ? { existingId: student.student.id }
            : {
                data: {
                  ...student.data,
                  sigesCode: text(student.data.sigesCode),
                  email: text(student.data.email),
                },
              },
        representatives: repsPayload(reps),
        schoolYearId: enrollment.schoolYearId,
        gradeLevelId: enrollment.gradeLevelId,
        sectionId: enrollment.sectionId,
        enrollmentDate: enrollment.enrollmentDate,
        receiptNumber: enrollment.receiptNumber,
        condition: enrollment.condition,
        previousSchool: text(enrollment.previousSchool),
        notes: text(enrollment.notes),
        documentsDueDate: !complete && dueDate ? dueDate : undefined,
        documents: requirements.map((r) => ({
          requirementTypeId: r.id,
          delivered: !!docs[r.id]?.delivered,
        })),
      });
    } catch (e) {
      setError(getErrorMessage(e));
      setSubmitting(false);
      return;
    }

    // La inscripción ya existe: los archivos se suben aparte y un fallo no la deshace.
    const warnings = [];
    const attempt = async (label, fn) => {
      try {
        await fn();
      } catch (e) {
        warnings.push(`${label}: ${getErrorMessage(e)}`);
      }
    };
    if (studentPhoto)
      await attempt("Foto del alumno", () =>
        enrollmentsService.uploadStudentPhoto(created.id, studentPhoto),
      );
    for (const r of reps.filter((x) => x.photo)) {
      const id =
        r.mode === "existing"
          ? r.existing.id
          : created.representatives.find(
              (c) => c.documentId === normalizeId(r.data.documentId),
            )?.id;
      const name =
        r.mode === "existing"
          ? `${r.existing.firstName} ${r.existing.lastName}`
          : `${r.data.firstName} ${r.data.lastName}`;
      if (id)
        await attempt(`Foto de ${name}`, () =>
          enrollmentsService.uploadRepresentativePhoto(created.id, id, r.photo),
        );
    }
    for (const r of requirements.filter((x) => docs[x.id]?.file)) {
      await attempt(`Archivo de «${r.name}»`, () =>
        enrollmentsService.uploadDocumentFile(
          created.id,
          r.id,
          docs[r.id].file,
        ),
      );
    }
    navigate(`/enrollments/${created.id}`, {
      replace: true,
      state: { created: true, warnings },
    });
  };

  return (
    <>
      <Link to="/enrollments" className="page-back">
        <FiArrowLeft /> Inscripciones
      </Link>
      <PageHeader
        title="Nueva inscripción"
        description="Registra al alumno, sus representantes y los documentos en un solo flujo."
      />

      <ol
        className="stepper"
        aria-label="Pasos de la inscripción"
        style={{ listStyle: "none", padding: 0 }}
      >
        {STEPS.map((label, i) => (
          <li
            key={label}
            className={`step ${i === step ? "current" : i < step ? "done" : ""}`}
            aria-current={i === step ? "step" : undefined}
          >
            <span className="n">
              {i < step ? <FiCheck size={12} /> : i + 1}
            </span>
            {label}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <StudentStep
          value={student}
          onNext={nextFromStudent}
          photo={studentPhoto}
          onPhoto={setStudentPhoto}
        />
      )}
      {step === 1 && (
        <RepresentativesStep
          items={reps}
          onBack={(list) => {
            setReps(list);
            setStep(0);
          }}
          onNext={(list) => {
            setReps(list);
            setStep(2);
          }}
        />
      )}
      {step === 2 && (
        <EnrollmentStep
          value={enrollment}
          onBack={(values) => {
            setEnrollment(values);
            setStep(1);
          }}
          onNext={(values) => {
            setEnrollment(values);
            setStep(3);
          }}
        />
      )}
      {step === 3 &&
        (loading && !requirements ? (
          <div className="panel-body">
            <Spinner />
          </div>
        ) : reqError ? (
          <div className="panel">
            <div className="panel-body">
              <div className="alert-x" role="alert">
                {reqError}
              </div>
              <button className="btn-ink" onClick={reload}>
                Reintentar
              </button>
            </div>
          </div>
        ) : (
          <DocumentsStep
            requirements={requirements}
            docs={docs}
            onDocs={setDocs}
            studentPhoto={studentPhoto}
            dueDate={dueDate}
            onDueDate={setDueDate}
            summary={summary}
            submitting={submitting}
            error={error}
            onBack={() => setStep(2)}
            onSubmit={submit}
          />
        ))}
    </>
  );
}
