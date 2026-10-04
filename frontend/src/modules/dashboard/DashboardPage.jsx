import { Link } from 'react-router-dom';
import { NAV_ITEMS } from '../../app/navigation';
import { usePermission } from '../../hooks/usePermission';
import { useAuthStore } from '../auth/store/authStore';

const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'; };

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const { can } = usePermission();
  const tiles = NAV_ITEMS.filter((i) => i.path !== '/' && can(i.permission));

  return (
    <>
      <section className="hello">
        <h1>{greeting()}, {user.firstName}.</h1>
        <p>Tienes acceso a {user.permissions.length} permisos mediante {user.roles.length === 1 ? 'el rol' : 'los roles'} {user.roles.map((r) => r.replace('_', ' ').toLowerCase()).join(', ')}.</p>
      </section>
      {tiles.length > 0 ? (
        <div className="tiles">
          {tiles.map(({ path, label, description, icon: Icon }) => (
            <Link to={path} className="tile" key={path}>
              <span className="ico"><Icon /></span>
              <div><strong>{label}</strong><span>{description}</span></div>
            </Link>
          ))}
        </div>
      ) : (
        <p style={{ color: 'var(--muted)' }}>Aún no tienes módulos disponibles. Pide a un administrador que revise tus permisos.</p>
      )}
    </>
  );
}
