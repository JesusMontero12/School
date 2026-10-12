import { useState } from "react";
import RepresentativesEditor from "../RepresentativesEditor";
import { validateReps } from "../representativesForm";

/** Paso 2: representantes (uno principal obligatorio). */
export default function RepresentativesStep({ items, onNext, onBack }) {
  const [list, setList] = useState(items);
  const [check, setCheck] = useState({ general: null, byKey: {} });

  const next = () => {
    const result = validateReps(list);
    setCheck(result);
    if (result.ok) onNext(list);
  };

  return (
    <div className="panel">
      <div className="panel-body">
        <p className="muted-text">
          Reutiliza representantes ya registrados o agrega uno nuevo. Debe haber
          un representante principal.
        </p>
        {check.general && (
          <div className="alert-x" role="alert">
            {check.general}
          </div>
        )}
        <RepresentativesEditor
          items={list}
          onChange={(next2) => {
            setList(next2);
            if (check.general || Object.keys(check.byKey).length)
              setCheck(validateReps(next2));
          }}
          errors={check.byKey}
          showPhotos
        />
        <div className="wizard-actions">
          <button
            type="button"
            className="btn-quiet"
            onClick={() => onBack(list)}
          >
            Atrás
          </button>
          <button type="button" className="btn-ink" onClick={next}>
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
}
