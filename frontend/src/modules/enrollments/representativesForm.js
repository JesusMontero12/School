import { EMAIL_RE, RELATIONSHIPS, normalizeId } from "../../utils/academic";

const PHONE_RE = /^[0-9+()\-\s]{7,20}$/;
let counter = 0;

export const emptyRep = (overrides = {}) => ({
  key: `rep-${++counter}`,
  mode: "new",
  existing: null,
  data: {
    firstName: "",
    lastName: "",
    documentId: "",
    phone: "",
    email: "",
    address: "",
    occupation: "",
  },
  relationship: "MADRE",
  relationshipDetail: "",
  isPrimary: false,
  photo: null,
  ...overrides,
});

/** Precarga los representantes que ya tiene un alumno existente (el primero queda como principal). */
export const repsFromStudent = (student) =>
  (student?.representatives ?? [])
    .filter((r) => r.isActive)
    .map((r, i) =>
      emptyRep({
        mode: "existing",
        existing: r,
        relationship: r.relationship,
        relationshipDetail: r.relationshipDetail ?? "",
        isPrimary: i === 0,
      }),
    );

/** Una cédula distinta por representante: existente o nuevo, da igual. */
const docOf = (r) =>
  r.mode === "existing"
    ? r.existing.documentId
    : normalizeId(r.data.documentId);

/** Devuelve { general, byKey } con los mensajes de error (vacío si todo está bien). */
export function validateReps(items) {
  const byKey = {};
  const fail = (key, field, msg) => {
    byKey[key] = { ...byKey[key], [field]: msg };
  };
  let general = null;

  if (items.length === 0) general = "Agrega al menos un representante.";
  else if (items.filter((r) => r.isPrimary).length !== 1)
    general = "Marca exactamente un representante principal.";

  const seen = new Set();
  items.forEach((r) => {
    if (r.relationship === "OTRO" && !r.relationshipDetail.trim())
      fail(r.key, "relationshipDetail", "Indica el parentesco");
    if (r.mode === "new") {
      const d = r.data;
      if (d.firstName.trim().length < 2)
        fail(r.key, "firstName", "Mínimo 2 letras");
      if (d.lastName.trim().length < 2)
        fail(r.key, "lastName", "Mínimo 2 letras");
      if (!/^[A-Z0-9]{4,20}$/.test(normalizeId(d.documentId)))
        fail(r.key, "documentId", "Entre 4 y 20 letras o números");
      if (!PHONE_RE.test(d.phone.trim()))
        fail(r.key, "phone", "Teléfono inválido (7 a 20 caracteres)");
      if (d.email.trim() && !EMAIL_RE.test(d.email.trim()))
        fail(
          r.key,
          "email",
          "Escribe un correo válido (ej. nombre@correo.com)",
        );
    }
    const doc = docOf(r);
    if (doc && seen.has(doc)) {
      general = general ?? "Hay un representante repetido (misma cédula).";
    } else if (doc) seen.add(doc);
  });
  return { general, byKey, ok: !general && Object.keys(byKey).length === 0 };
}

const text = (v) => v.trim() || undefined;

/** Formato que espera el backend (existingId o data, nunca ambos). */
export const repsPayload = (items) =>
  items.map((r) => ({
    ...(r.mode === "existing"
      ? { existingId: r.existing.id }
      : {
          data: {
            firstName: r.data.firstName.trim(),
            lastName: r.data.lastName.trim(),
            documentId: r.data.documentId.trim(),
            phone: r.data.phone.trim(),
            email: text(r.data.email),
            address: text(r.data.address),
            occupation: text(r.data.occupation),
          },
        }),
    relationship: r.relationship,
    relationshipDetail:
      r.relationship === "OTRO" ? r.relationshipDetail.trim() : undefined,
    isPrimary: r.isPrimary,
  }));

/** Precarga el editor desde los representantes de una inscripción ya creada. */
export const repsFromEnrollment = (enrollment) =>
  enrollment.representatives.map((r) =>
    emptyRep({
      mode: "existing",
      existing: {
        id: r.id,
        firstName: r.firstName,
        lastName: r.lastName,
        documentId: r.documentId,
        phone: r.phone,
      },
      relationship: r.relationship ?? "OTRO",
      relationshipDetail: r.relationshipDetail ?? "",
      isPrimary: r.isPrimary,
    }),
  );

export { RELATIONSHIPS };
