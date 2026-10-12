import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "react-router-dom";
import { Drawer, Field, Spinner } from "../../components/ui";
import { FilePick, PersonPhoto, StatusTag } from "../../components/academic-ui";
import { useAsync } from "../../hooks/useAsync";
import { usePermission } from "../../hooks/usePermission";
import {
  EMAIL_RE,
  STUDENT_STATUS,
  normalizeId,
  relationshipText,
} from "../../utils/academic";
import { notify } from "../../utils/alerts";
import { getErrorMessage } from "../../utils/errors";
import { representativesService } from "./representativesService";

export const PHONE_RE = /^[0-9+()\-\s]{7,20}$/;

const schema = z.object({
  firstName: z
    .string()
    .trim()
    .min(2, "Mínimo 2 letras")
    .max(60, "Máximo 60 caracteres"),
  lastName: z
    .string()
    .trim()
    .min(2, "Mínimo 2 letras")
    .max(60, "Máximo 60 caracteres"),
  documentId: z
    .string()
    .trim()
    .refine(
      (v) => /^[A-Z0-9]{4,20}$/.test(normalizeId(v)),
      "Entre 4 y 20 letras o números",
    ),
  phone: z
    .string()
    .trim()
    .refine(
      (v) => v === "" || PHONE_RE.test(v),
      "Entre 7 y 20 caracteres (números, +, -, paréntesis)",
    ),
  email: z
    .string()
    .trim()
    .max(120, "Máximo 120 caracteres")
    .refine(
      (v) => v === "" || EMAIL_RE.test(v),
      "Escribe un correo válido (ej. nombre@correo.com)",
    ),
  address: z.string().trim().max(250, "Máximo 250 caracteres"),
  occupation: z.string().trim().max(100, "Máximo 100 caracteres"),
  isActive: z.boolean(),
});

/** Detalle y edición de un representante. Los representantes nuevos se registran desde Inscripciones. */
export default function RepresentativeDrawer({
  representativeId,
  onClose,
  onSaved,
}) {
  const { can } = usePermission();
  const editable = can("representative.edit");
  const [serverError, setServerError] = useState("");
  const [photoVersion, setPhotoVersion] = useState(0);
  const [uploading, setUploading] = useState(false);
  const {
    data: rep,
    loading,
    error,
    reload,
  } = useAsync(
    () => representativesService.get(representativeId),
    [representativeId],
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) });
  useEffect(() => {
    if (rep)
      reset({
        firstName: rep.firstName,
        lastName: rep.lastName,
        documentId: rep.documentId,
        phone: rep.phone ?? "",
        email: rep.email ?? "",
        address: rep.address ?? "",
        occupation: rep.occupation ?? "",
        isActive: rep.isActive,
      });
  }, [rep, reset]);

  const onSubmit = async (v) => {
    setServerError("");
    try {
      await representativesService.update(representativeId, {
        ...v,
        phone: v.phone || null,
        email: v.email || null,
        address: v.address || null,
        occupation: v.occupation || null,
      });
      notify.success("Cambios guardados");
      onSaved();
    } catch (e) {
      setServerError(getErrorMessage(e));
    }
  };

  const uploadPhoto = async (file) => {
    setUploading(true);
    try {
      await representativesService.uploadPhoto(representativeId, file);
      setPhotoVersion(Date.now());
      notify.success("Foto guardada");
      reload();
    } catch (e) {
      notify.error(getErrorMessage(e));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Drawer
      title="Representante"
      onClose={onClose}
      footer={
        editable && rep ? (
          <>
            <button type="button" className="btn-quiet" onClick={onClose}>
              Cancelar
            </button>
            <button
              form="representative-form"
              className="btn-ink"
              disabled={isSubmitting}
            >
              {isSubmitting ? <Spinner /> : "Guardar cambios"}
            </button>
          </>
        ) : null
      }
    >
      {loading && !rep ? (
        <Spinner />
      ) : error ? (
        <div className="alert-x" role="alert">
          {error}
        </div>
      ) : (
        <>
          <div className="d-flex align-items-center gap-3 mb-3">
            <PersonPhoto
              size="lg"
              first={rep.firstName}
              last={rep.lastName}
              path={
                rep.hasPhoto ? representativesService.photoPath(rep.id) : null
              }
              version={photoVersion}
            />
            {editable && (
              <FilePick onPick={uploadPhoto} disabled={uploading}>
                {uploading ? (
                  <Spinner />
                ) : rep.hasPhoto ? (
                  "Cambiar foto"
                ) : (
                  "Subir foto"
                )}
              </FilePick>
            )}
          </div>
          {serverError && (
            <div className="alert-x" role="alert">
              {serverError}
            </div>
          )}
          <form
            id="representative-form"
            onSubmit={handleSubmit(onSubmit)}
            noValidate
          >
            <fieldset
              disabled={!editable}
              style={{ border: 0, padding: 0, margin: 0 }}
            >
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
              </div>
              <Field
                label="Cédula"
                error={errors.documentId?.message}
                {...register("documentId")}
              />
              <Field
                label="Teléfono"
                type="tel"
                error={errors.phone?.message}
                {...register("phone")}
              />
              <Field
                label="Correo electrónico (opcional)"
                type="email"
                autoComplete="off"
                error={errors.email?.message}
                {...register("email")}
              />
              <Field
                label="Dirección (opcional)"
                error={errors.address?.message}
                {...register("address")}
              />
              <Field
                label="Oficio (opcional)"
                error={errors.occupation?.message}
                {...register("occupation")}
              />
              <label className="check-row mt-2">
                <input type="checkbox" {...register("isActive")} />{" "}
                Representante activo (puede usarse en nuevas inscripciones)
              </label>
            </fieldset>
          </form>

          <div className="form-section mt-4">
            <h3>Alumnos que representa ({rep.students.length})</h3>
            {rep.students.length === 0 ? (
              <p className="muted-text">Aún no tiene alumnos vinculados.</p>
            ) : (
              <div className="pick-list">
                {rep.students.map((st) => (
                  <Link
                    key={st.id}
                    to={`/students/${st.id}`}
                    className="pick"
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    <div className="grow">
                      <strong>
                        {st.firstName} {st.lastName}
                      </strong>
                      <small>
                        {relationshipText(
                          st.relationship,
                          st.relationshipDetail,
                        )}
                      </small>
                    </div>
                    <StatusTag map={STUDENT_STATUS} value={st.status} />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </Drawer>
  );
}
