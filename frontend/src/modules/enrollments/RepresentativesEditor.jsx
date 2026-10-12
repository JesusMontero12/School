import { useState } from "react";
import { FiPlus, FiSearch, FiTrash2, FiUserPlus } from "react-icons/fi";
import { Field, Spinner } from "../../components/ui";
import { PhotoPicker } from "../../components/academic-ui";
import { useAsync } from "../../hooks/useAsync";
import { useDebounce } from "../../hooks/useDebounce";
import { RELATIONSHIPS } from "../../utils/academic";
import { emptyRep } from "./representativesForm";
import { enrollmentsService } from "./enrollmentsService";

/** Buscador de representantes ya registrados (se reutilizan, nunca se duplican). */
function ExistingSearch({ taken, onAdd }) {
  const [term, setTerm] = useState("");
  const search = useDebounce(term);
  const active = search.trim().length >= 2;
  const { data, loading } = useAsync(
    () =>
      active
        ? enrollmentsService.lookupRepresentatives(search.trim())
        : Promise.resolve([]),
    [search],
  );
  const results = (data ?? []).filter((r) => !taken.has(r.id));

  return (
    <div>
      <div className="toolbar" style={{ padding: 0, border: 0 }}>
        <div className="search">
          <FiSearch aria-hidden />
          <input
            className="input"
            type="search"
            placeholder="Buscar representante registrado (nombre, cédula o teléfono)"
            aria-label="Buscar representante registrado"
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
      {active && !loading && results.length === 0 && (
        <p className="muted-text mt-2 mb-0" style={{ fontSize: ".875rem" }}>
          No hay coincidencias. Puedes agregarlo como representante nuevo.
        </p>
      )}
      {results.length > 0 && (
        <div className="pick-list">
          {results.map((r) => (
            <button
              type="button"
              key={r.id}
              className="pick"
              onClick={() => {
                onAdd(r);
                setTerm("");
              }}
            >
              <div className="grow">
                <strong>
                  {r.firstName} {r.lastName}
                </strong>
                <small>
                  C.I. {r.documentId}
                  {r.phone ? ` · ${r.phone}` : ""}
                </small>
              </div>
              <FiPlus aria-hidden />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Lista editable de representantes de una inscripción.
 * `items` y `errors` vienen de representativesForm.js; `showPhotos` permite elegir la foto de cada uno (asistente).
 */
export default function RepresentativesEditor({
  items,
  onChange,
  errors = {},
  showPhotos = false,
}) {
  const patch = (key, changes) =>
    onChange(items.map((r) => (r.key === key ? { ...r, ...changes } : r)));
  const patchData = (key, field, value) =>
    onChange(
      items.map((r) =>
        r.key === key ? { ...r, data: { ...r.data, [field]: value } } : r,
      ),
    );
  const setPrimary = (key) =>
    onChange(items.map((r) => ({ ...r, isPrimary: r.key === key })));
  const remove = (key) => {
    const rest = items.filter((r) => r.key !== key);
    onChange(
      rest.length && !rest.some((r) => r.isPrimary)
        ? rest.map((r, i) => ({ ...r, isPrimary: i === 0 }))
        : rest,
    );
  };
  const add = (rep) =>
    onChange([
      ...items,
      emptyRep({
        mode: "existing",
        existing: rep,
        isPrimary: items.length === 0,
      }),
    ]);
  const addNew = () =>
    onChange([...items, emptyRep({ isPrimary: items.length === 0 })]);
  const taken = new Set(
    items.filter((r) => r.mode === "existing").map((r) => r.existing.id),
  );

  return (
    <div>
      <ExistingSearch taken={taken} onAdd={add} />
      <div className="mt-3">
        {items.map((r, i) => {
          const e = errors[r.key] ?? {};
          const title =
            r.mode === "existing"
              ? `${r.existing.firstName} ${r.existing.lastName}`
              : `Representante nuevo ${i + 1}`;
          return (
            <div className="rep-card" key={r.key}>
              <header>
                <div>
                  <strong>{title}</strong>
                  {r.mode === "existing" && (
                    <small className="d-block muted-text">
                      C.I. {r.existing.documentId}
                      {r.existing.phone ? ` · ${r.existing.phone}` : ""} · ya
                      registrado
                    </small>
                  )}
                </div>
                <div className="d-flex align-items-center gap-3">
                  <label className="check-row">
                    <input
                      type="radio"
                      name="primary-rep"
                      checked={r.isPrimary}
                      onChange={() => setPrimary(r.key)}
                    />{" "}
                    Principal
                  </label>
                  <button
                    type="button"
                    className="icon-btn danger"
                    aria-label={`Quitar a ${title}`}
                    onClick={() => remove(r.key)}
                  >
                    <FiTrash2 />
                  </button>
                </div>
              </header>

              {showPhotos && (
                <PhotoPicker
                  file={r.photo}
                  onChange={(f) => patch(r.key, { photo: f })}
                  label="Foto del representante"
                  hint="Opcional. JPG o PNG, hasta 5 MB."
                />
              )}

              {r.mode === "new" && (
                <div className="row g-3">
                  <div className="col-sm-6">
                    <Field
                      label="Nombres"
                      value={r.data.firstName}
                      onChange={(ev) =>
                        patchData(r.key, "firstName", ev.target.value)
                      }
                      error={e.firstName}
                    />
                  </div>
                  <div className="col-sm-6">
                    <Field
                      label="Apellidos"
                      value={r.data.lastName}
                      onChange={(ev) =>
                        patchData(r.key, "lastName", ev.target.value)
                      }
                      error={e.lastName}
                    />
                  </div>
                  <div className="col-sm-6">
                    <Field
                      label="Cédula"
                      value={r.data.documentId}
                      onChange={(ev) =>
                        patchData(r.key, "documentId", ev.target.value)
                      }
                      error={e.documentId}
                    />
                  </div>
                  <div className="col-sm-6">
                    <Field
                      label="Teléfono"
                      type="tel"
                      value={r.data.phone}
                      onChange={(ev) =>
                        patchData(r.key, "phone", ev.target.value)
                      }
                      error={e.phone}
                    />
                  </div>
                  <div className="col-sm-6">
                    <Field
                      label="Correo electrónico (opcional)"
                      type="email"
                      autoComplete="off"
                      value={r.data.email}
                      onChange={(ev) =>
                        patchData(r.key, "email", ev.target.value)
                      }
                      error={e.email}
                    />
                  </div>
                  <div className="col-sm-6">
                    <Field
                      label="Oficio (opcional)"
                      value={r.data.occupation}
                      onChange={(ev) =>
                        patchData(r.key, "occupation", ev.target.value)
                      }
                    />
                  </div>
                  <div className="col-12">
                    <Field
                      label="Dirección (opcional)"
                      value={r.data.address}
                      onChange={(ev) =>
                        patchData(r.key, "address", ev.target.value)
                      }
                    />
                  </div>
                </div>
              )}

              <div className="row g-3 mt-0">
                <div className="col-sm-6">
                  <Field label="Parentesco con el alumno">
                    {(a11y) => (
                      <select
                        className="input"
                        {...a11y}
                        value={r.relationship}
                        onChange={(ev) =>
                          patch(r.key, { relationship: ev.target.value })
                        }
                      >
                        {RELATIONSHIPS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </Field>
                </div>
                {r.relationship === "OTRO" && (
                  <div className="col-sm-6">
                    <Field
                      label="¿Qué parentesco?"
                      value={r.relationshipDetail}
                      onChange={(ev) =>
                        patch(r.key, { relationshipDetail: ev.target.value })
                      }
                      error={e.relationshipDetail}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <button type="button" className="btn-quiet mt-3" onClick={addNew}>
        <FiUserPlus /> Agregar representante nuevo
      </button>
    </div>
  );
}
