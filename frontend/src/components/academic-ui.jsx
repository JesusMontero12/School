import { useEffect, useRef, useState } from "react";
import { FiCamera } from "react-icons/fi";
import { api } from "../services/api";
import { MAX_PHOTO_BYTES } from "../utils/academic";
import { initials } from "../utils/format";

/** Etiqueta de estado con color semántico (ok, warn, bad, info, muted). */
export const Tag = ({ tone = "muted", children }) => (
  <span className={`tag ${tone}`}>{children}</span>
);

export const StatusTag = ({ map, value }) => (
  <Tag tone={map[value]?.tone}>{map[value]?.label ?? value}</Tag>
);

/** Pares etiqueta/valor para fichas de detalle. */
export const KeyValues = ({ items }) => (
  <dl className="kv">
    {items.filter(Boolean).map(([k, v]) => (
      <div key={k}>
        <dt>{k}</dt>
        <dd>{v || "—"}</dd>
      </div>
    ))}
  </dl>
);

/** Descarga una imagen privada (con token) y la entrega como URL temporal. */
export function useProtectedImage(path, version = 0) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!path) {
      setUrl(null);
      return undefined;
    }
    let objectUrl;
    let alive = true;
    api
      .get(path, { responseType: "blob" })
      .then((r) => {
        if (alive) {
          objectUrl = URL.createObjectURL(r.data);
          setUrl(objectUrl);
        }
      })
      .catch(() => alive && setUrl(null));
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path, version]);
  return url;
}

/** Foto de persona; si no hay (path nulo) o falla, muestra iniciales. */
export function PersonPhoto({ path, version, first, last, size = "md" }) {
  const url = useProtectedImage(path, version);
  return url ? (
    <img
      className={`photo ${size}`}
      src={url}
      alt={`Foto de ${first} ${last}`}
    />
  ) : (
    <span className={`photo ${size} fallback`} aria-hidden>
      {initials(first, last)}
    </span>
  );
}

/** Botón que abre el selector de archivos; entrega el File elegido a onPick. */
export function FilePick({
  accept = "image/jpeg,image/png",
  onPick,
  children,
  disabled,
  className = "btn-quiet",
}) {
  const ref = useRef(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onPick(f);
        }}
      />
      <button
        type="button"
        className={className}
        disabled={disabled}
        onClick={() => ref.current?.click()}
      >
        {children ?? (
          <>
            <FiCamera /> Cambiar foto
          </>
        )}
      </button>
    </>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={value === t.value}
          className={value === t.value ? "active" : ""}
          onClick={() => onChange(t.value)}
        >
          {t.label}
          {t.count != null && <span className="count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** Barra de ocupación de una sección (ocupados / cupo). */
export function Occupancy({ occupied, max }) {
  if (occupied == null) return <span className="muted-text">—</span>;
  const pct = Math.min(100, Math.round((occupied / max) * 100));
  const tone = occupied >= max ? "bad" : pct >= 85 ? "warn" : "ok";
  return (
    <div className="occupancy" title={`${occupied} de ${max} cupos reservados`}>
      <div className="bar">
        <span className={tone} style={{ width: `${pct}%` }} />
      </div>
      <small>
        {occupied}/{max}
      </small>
    </div>
  );
}

/**
 * Selector de foto con vista previa inmediata (solo JPG/PNG). El archivo se queda en el navegador
 * hasta que se registra la inscripción; aquí solo se valida tipo y tamaño.
 */
export function PhotoPicker({
  file,
  onChange,
  label = "Foto del alumno",
  hint = "JPG o PNG, hasta 5 MB.",
}) {
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const pick = (f) => {
    if (!["image/jpeg", "image/png"].includes(f.type))
      return setError("Solo se aceptan imágenes JPG o PNG.");
    if (f.size > MAX_PHOTO_BYTES)
      return setError(
        `La imagen supera el máximo de ${MAX_PHOTO_BYTES / 1024 / 1024} MB.`,
      );
    setError("");
    return onChange(f);
  };

  return (
    <div className="photo-picker">
      {preview ? (
        <img
          className="photo lg"
          src={preview}
          alt="Vista previa de la foto seleccionada"
        />
      ) : (
        <span className="photo lg fallback" aria-hidden>
          <FiCamera size={30} />
        </span>
      )}
      <div>
        <strong>{label}</strong>
        <small className="d-block muted-text">
          {file
            ? `${file.name} · ${Math.max(1, Math.round(file.size / 1024))} KB`
            : hint}
        </small>
        <div className="d-flex gap-2 flex-wrap mt-2">
          <FilePick onPick={pick}>
            {file ? "Cambiar foto" : "Elegir foto"}
          </FilePick>
          {file && (
            <button
              type="button"
              className="btn-quiet"
              onClick={() => {
                setError("");
                onChange(null);
              }}
            >
              Quitar
            </button>
          )}
        </div>
        {error && (
          <span className="error d-block mt-1" role="alert">
            {error}
          </span>
        )}
      </div>
    </div>
  );
}
