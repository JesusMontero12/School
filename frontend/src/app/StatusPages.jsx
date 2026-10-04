import { Link } from 'react-router-dom';
import { FiLock, FiCompass } from 'react-icons/fi';
import { EmptyState } from '../components/ui';

export const ForbiddenPage = () => (
  <div className="panel"><EmptyState icon={FiLock} title="No tienes acceso a esta sección" text="Tu rol no incluye este permiso. Si crees que es un error, avisa a un administrador.">
    <Link to="/" className="btn-ink" style={{ textDecoration: 'none' }}>Volver al inicio</Link></EmptyState></div>
);
export const NotFoundPage = () => (
  <div className="panel"><EmptyState icon={FiCompass} title="No encontramos esa página" text="Revisa la dirección o vuelve al inicio.">
    <Link to="/" className="btn-ink" style={{ textDecoration: 'none' }}>Ir al inicio</Link></EmptyState></div>
);
