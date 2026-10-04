import { forwardRef, useEffect, useId, useState } from 'react';
import { FiEye, FiEyeOff, FiX, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { usePermission } from '../hooks/usePermission';

/** Renderiza hijos solo si la persona tiene el permiso. */
export function Can({ permission, any, children, fallback = null }) {
  const { can, canAny } = usePermission();
  const ok = permission ? can(permission) : any ? canAny(any) : true;
  return ok ? children : fallback;
}

export function PageHeader({ title, description, children }) {
  return (
    <div className="page-head">
      <div><h1>{title}</h1>{description && <p>{description}</p>}</div>
      <div className="d-flex gap-2 flex-wrap">{children}</div>
    </div>
  );
}

/** Campo accesible: label, pista y error enlazados por aria. */
export const Field = forwardRef(function Field({ label, hint, error, className = '', children, ...inputProps }, ref) {
  const id = useId();
  const desc = error ? `${id}-e` : hint ? `${id}-h` : undefined;
  return (
    <div className={`field ${className}`}>
      <label htmlFor={id}>{label}</label>
      {children ? children({ id, 'aria-describedby': desc, 'aria-invalid': !!error })
        : <input id={id} ref={ref} className="input" aria-describedby={desc} aria-invalid={!!error} {...inputProps} />}
      {error ? <span id={`${id}-e`} className="error" role="alert">{error}</span>
        : hint && <span id={`${id}-h`} className="hint">{hint}</span>}
    </div>
  );
});

export const PasswordField = forwardRef(function PasswordField({ label, hint, error, ...rest }, ref) {
  const [show, setShow] = useState(false);
  return (
    <Field label={label} hint={hint} error={error}>
      {(a11y) => (
        <div className="input-wrap">
          <input ref={ref} className="input" type={show ? 'text' : 'password'} {...a11y} {...rest} />
          <button type="button" className="icon-btn toggle" onClick={() => setShow((s) => !s)}
            aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
            {show ? <FiEyeOff /> : <FiEye />}
          </button>
        </div>
      )}
    </Field>
  );
});

export function Spinner() { return <span className="spinner" role="status" aria-label="Cargando" />; }
export const FullPageLoader = () => <div className="fullpage"><Spinner /></div>;

export function EmptyState({ icon: Icon, title, text, children }) {
  return (
    <div className="empty">
      <div className="ico"><Icon size={28} /></div>
      <h3>{title}</h3><p>{text}</p>{children}
    </div>
  );
}

export const StatusPill = ({ active }) => <span className={`pill ${active ? 'on' : 'off'}`}>{active ? 'Activo' : 'Inactivo'}</span>;

export function Pager({ meta, onPage }) {
  if (!meta) return null;
  const from = meta.total === 0 ? 0 : (meta.page - 1) * meta.limit + 1;
  const to = Math.min(meta.page * meta.limit, meta.total);
  return (
    <div className="pager">
      <span>{from}–{to} de {meta.total}</span>
      <div>
        <button className="btn-quiet btn-sm-x" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)} aria-label="Página anterior"><FiChevronLeft /></button>
        <button className="btn-quiet btn-sm-x" disabled={meta.page >= meta.pages} onClick={() => onPage(meta.page + 1)} aria-label="Página siguiente"><FiChevronRight /></button>
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 6 }) {
  return <div style={{ padding: '1rem', display: 'grid', gap: '.8rem' }}>
    {Array.from({ length: rows }, (_, i) => <div key={i} className="skeleton" style={{ height: 44 }} />)}
  </div>;
}

/** Panel lateral modal: cierra con Esc y bloquea el scroll del fondo. */
export function Drawer({ title, onClose, children, footer }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={title}>
        <header><h2>{title}</h2><button className="icon-btn" onClick={onClose} aria-label="Cerrar"><FiX size={20} /></button></header>
        <div className="body">{children}</div>
        {footer && <footer>{footer}</footer>}
      </aside>
    </>
  );
}
