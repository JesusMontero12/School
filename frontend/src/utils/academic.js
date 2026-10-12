/** Etiquetas y formatos del núcleo académico (los valores coinciden con los enums del backend). */

export const ENROLLMENT_STATUS = {
  PENDIENTE: { label: "Pendiente", tone: "warn" },
  ACTIVA: { label: "Activa", tone: "ok" },
  RETIRADA: { label: "Retirada", tone: "muted" },
  ANULADA: { label: "Anulada", tone: "bad" },
};
export const YEAR_STATUS = {
  PLANIFICADO: { label: "Planificado", tone: "info" },
  ACTIVO: { label: "Activo", tone: "ok" },
  CERRADO: { label: "Cerrado", tone: "muted" },
};
export const TERM_STATUS = {
  PENDIENTE: { label: "Pendiente", tone: "muted" },
  ACTIVO: { label: "Activo", tone: "ok" },
  CERRADO: { label: "Cerrado", tone: "muted" },
};
export const STUDENT_STATUS = {
  ACTIVO: { label: "Activo", tone: "ok" },
  INACTIVO: { label: "Inactivo", tone: "muted" },
  RETIRADO: { label: "Retirado", tone: "warn" },
  EGRESADO: { label: "Egresado", tone: "info" },
};
export const DOCUMENT_STATUS = {
  PENDIENTE: { label: "Pendiente", tone: "warn" },
  ENTREGADO: { label: "Entregado", tone: "ok" },
};

export const ID_TYPES = [
  { value: "CEDULA", label: "Cédula" },
  { value: "CEDULA_ESCOLAR", label: "Cédula escolar" },
];
export const SEXES = [
  { value: "MASCULINO", label: "Masculino" },
  { value: "FEMENINO", label: "Femenino" },
];
export const RELATIONSHIPS = [
  { value: "MADRE", label: "Madre" },
  { value: "PADRE", label: "Padre" },
  { value: "ABUELO_A", label: "Abuelo(a)" },
  { value: "TIO_A", label: "Tío(a)" },
  { value: "HERMANO_A", label: "Hermano(a)" },
  { value: "TUTOR_LEGAL", label: "Tutor legal" },
  { value: "OTRO", label: "Otro" },
];
export const CONDITIONS = [
  { value: "REGULAR", label: "Regular" },
  { value: "REPITIENTE", label: "Repitiente" },
  { value: "MATERIA_PENDIENTE", label: "Materia pendiente" },
];

export const labelOf = (list, value) =>
  list.find((i) => i.value === value)?.label ?? value ?? "—";

export const relationshipText = (value, detail) =>
  value === "OTRO" && detail ? detail : labelOf(RELATIONSHIPS, value);

/** Fecha "solo día" (AAAA-MM-DD) sin corrimiento por zona horaria. */
export const formatDay = (ymd) =>
  ymd
    ? new Intl.DateTimeFormat("es", {
        dateStyle: "medium",
        timeZone: "UTC",
      }).format(new Date(`${ymd}T00:00:00Z`))
    : "—";

export const formatDateTime = (iso) =>
  iso
    ? new Intl.DateTimeFormat("es", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(iso))
    : "—";

/** Hoy (AAAA-MM-DD) en la zona horaria del colegio. */
export const todayYmd = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: import.meta.env.VITE_SCHOOL_TIMEZONE ?? "America/Caracas",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

/** Formato básico de correo para validar en pantalla (el backend valida con más detalle). */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const identification = (type, number) =>
  `${type === "CEDULA_ESCOLAR" ? "C.E." : "C.I."} ${number}`;

/** Misma forma canónica que usa el backend: mayúsculas, sin separadores y sin la V/E inicial. */
export const normalizeId = (raw = "") => {
  const compact = raw.toUpperCase().replace(/[\s.\-_/]/g, "");
  return /^[VE]\d+$/.test(compact) ? compact.slice(1) : compact;
};

export const bytes = (n) =>
  n == null
    ? ""
    : n < 1024 * 1024
      ? `${Math.max(1, Math.round(n / 1024))} KB`
      : `${(n / 1024 / 1024).toFixed(1)} MB`;

/** Texto de la acción registrada en auditoría → frase legible. */
export const AUDIT_ACTIONS = {
  "student.create": "Alumno registrado",
  "student.update": "Datos del alumno editados",
  "student.photo": "Foto del alumno actualizada",
  "enrollment.create": "Inscripción creada",
  "enrollment.update": "Inscripción editada",
  "enrollment.status": "Cambio de estado",
  "enrollment.representatives": "Representantes actualizados",
  "enrollment.document": "Documento actualizado",
  "enrollment.document_file": "Archivo de documento adjuntado",
  "enrollment.document_file_removed": "Archivo de documento eliminado",
};

export const FIELD_LABELS = {
  firstName: "Nombre",
  lastName: "Apellido",
  identificationType: "Tipo de identificación",
  identificationNumber: "Número de identificación",
  sigesCode: "Código SIGES",
  email: "Correo electrónico",
  birthDate: "Fecha de nacimiento",
  birthPlace: "Lugar de nacimiento",
  sex: "Sexo",
  address: "Dirección",
  status: "Estado",
  sectionId: "Sección",
  enrollmentDate: "Fecha de inscripción",
  receiptNumber: "Recibo",
  condition: "Condición",
  previousSchool: "Plantel de procedencia",
  notes: "Observaciones",
  documentsDueDate: "Plazo de documentos",
};

/** Tamaño máximo de foto que valida el formulario (el backend aplica su propio límite, UPLOAD_MAX_BYTES). */
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/**
 * Edad exacta a partir de la fecha de nacimiento (AAAA-MM-DD), comparando año, mes y día
 * con la fecha de hoy: si todavía no llegó el cumpleaños de este año, aún no cumplió el año.
 * Devuelve null si la fecha falta, no es real o es futura.
 */
export function calcAge(birthYmd, nowYmd = todayYmd()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthYmd ?? "")) return null;
  const [by, bm, bd] = birthYmd.split("-").map(Number);
  const [ty, tm, td] = nowYmd.split("-").map(Number);
  const check = new Date(Date.UTC(by, bm - 1, bd));
  if (
    check.getUTCFullYear() !== by ||
    check.getUTCMonth() !== bm - 1 ||
    check.getUTCDate() !== bd
  )
    return null; // p. ej. 31/02
  if (birthYmd > nowYmd) return null;
  let years = ty - by;
  let months = tm - bm;
  if (td < bd) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return { years, months };
}

/** Solo los años cumplidos, en número ("14"); vacío si no hay una fecha válida. */
export function formatAge(birthYmd, nowYmd) {
  const age = calcAge(birthYmd, nowYmd);
  return age ? String(age.years) : "";
}
