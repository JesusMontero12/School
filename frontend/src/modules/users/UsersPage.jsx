import { useState } from 'react';
import { FiEdit2, FiPlus, FiSearch, FiSlash, FiCheckCircle, FiTrash2, FiUsers } from 'react-icons/fi';
import { Can, EmptyState, PageHeader, Pager, StatusPill, TableSkeleton } from '../../components/ui';
import { useAsync } from '../../hooks/useAsync';
import { useDebounce } from '../../hooks/useDebounce';
import { usePermission } from '../../hooks/usePermission';
import { confirmAction, notify } from '../../utils/alerts';
import { getErrorMessage } from '../../utils/errors';
import { formatDate, initials } from '../../utils/format';
import { useAuthStore } from '../auth/store/authStore';
import UserFormDrawer from './UserFormDrawer';
import { usersService } from './usersService';

export default function UsersPage() {
  const { can } = usePermission();
  const me = useAuthStore((s) => s.user);
  const [filters, setFilters] = useState({ search: '', roleCode: '', status: '' });
  const [page, setPage] = useState(1);
  const [drawer, setDrawer] = useState(null); // null | 'new' | user
  const search = useDebounce(filters.search);

  const { data, loading, error, reload } = useAsync(
    () => usersService.list({ page, limit: 10, search: search || undefined, roleCode: filters.roleCode || undefined, status: filters.status || undefined }),
    [page, search, filters.roleCode, filters.status]);
  const { data: roles } = useAsync(usersService.roleOptions, []);

  const setFilter = (k) => (e) => { setPage(1); setFilters((f) => ({ ...f, [k]: e.target.value })); };
  const run = async (fn, okMsg) => { try { await fn(); notify.success(okMsg); reload(); } catch (e) { notify.error(getErrorMessage(e)); } };

  const toggle = async (u) => {
    const next = !u.isActive;
    if (!next && !(await confirmAction({ title: `¿Desactivar a ${u.firstName}?`, text: 'Se cerrarán sus sesiones y no podrá entrar hasta que lo reactives.', confirmText: 'Desactivar', danger: true }))) return;
    run(() => usersService.setStatus(u.id, next), next ? 'Usuario activado' : 'Usuario desactivado');
  };
  const remove = async (u) => {
    if (await confirmAction({ title: `¿Eliminar a ${u.firstName} ${u.lastName}?`, text: 'Dejará de aparecer en el sistema. Su historial de auditoría se conserva.', confirmText: 'Eliminar usuario', danger: true }))
      run(() => usersService.remove(u.id), 'Usuario eliminado');
  };

  const filtered = !!(search || filters.roleCode || filters.status);

  return (
    <>
      <PageHeader title="Usuarios" description="Quién puede entrar al sistema y con qué rol.">
        <Can permission="user.create"><button className="btn-pencil" onClick={() => setDrawer('new')}><FiPlus /> Nuevo usuario</button></Can>
      </PageHeader>

      <div className="panel">
        <div className="toolbar">
          <div className="search">
            <FiSearch aria-hidden />
            <input className="input" type="search" placeholder="Buscar por nombre o correo" aria-label="Buscar usuarios" value={filters.search} onChange={setFilter('search')} />
          </div>
          <select className="input" aria-label="Filtrar por rol" value={filters.roleCode} onChange={setFilter('roleCode')}>
            <option value="">Todos los roles</option>
            {roles?.map((r) => <option key={r.id} value={r.code}>{r.name}</option>)}
          </select>
          <select className="input" aria-label="Filtrar por estado" value={filters.status} onChange={setFilter('status')}>
            <option value="">Cualquier estado</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </select>
        </div>

        {loading && !data ? <TableSkeleton /> : error ? (
          <EmptyState icon={FiUsers} title="No pudimos cargar los usuarios" text={error}><button className="btn-ink" onClick={reload}>Reintentar</button></EmptyState>
        ) : data.data.length === 0 ? (
          <EmptyState icon={FiUsers} title={filtered ? 'Sin resultados' : 'Aún no hay usuarios'}
            text={filtered ? 'Prueba con otro nombre o quita algún filtro.' : 'Crea la primera cuenta para dar acceso al sistema.'}>
            {!filtered && can('user.create') && <button className="btn-pencil" onClick={() => setDrawer('new')}><FiPlus /> Nuevo usuario</button>}
          </EmptyState>
        ) : (
          <div className="table-scroll" style={{ opacity: loading ? 0.55 : 1, transition: 'opacity .15s' }}>
            <table className="data">
              <thead><tr><th>Usuario</th><th>Roles</th><th>Estado</th><th>Último ingreso</th><th><span className="visually-hidden">Acciones</span></th></tr></thead>
              <tbody>
                {data.data.map((u) => (
                  <tr key={u.id}>
                    <td><div className="person"><span className="avatar sm">{initials(u.firstName, u.lastName)}</span>
                      <div><strong>{u.firstName} {u.lastName}{u.id === me.id && <span className="chip ms-2">Tú</span>}</strong><small>{u.email}</small></div></div></td>
                    <td><div className="chips">{u.roles.map((r) => <span key={r.id} className={`chip ${r.code === 'SUPER_ADMIN' ? 'is-super' : ''}`}>{r.name}</span>)}</div></td>
                    <td><StatusPill active={u.isActive} /></td>
                    <td>{formatDate(u.lastLoginAt)}</td>
                    <td><div className="actions">
                      <Can permission="user.edit">
                        <button className="icon-btn" onClick={() => setDrawer(u)} aria-label={`Editar a ${u.firstName}`}><FiEdit2 /></button>
                        {u.id !== me.id && <button className="icon-btn" onClick={() => toggle(u)} aria-label={u.isActive ? `Desactivar a ${u.firstName}` : `Activar a ${u.firstName}`}>{u.isActive ? <FiSlash /> : <FiCheckCircle />}</button>}
                      </Can>
                      <Can permission="user.delete">
                        {u.id !== me.id && <button className="icon-btn danger" onClick={() => remove(u)} aria-label={`Eliminar a ${u.firstName}`}><FiTrash2 /></button>}
                      </Can>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager meta={data?.meta} onPage={setPage} />
      </div>

      {drawer && roles && (
        <UserFormDrawer user={drawer === 'new' ? null : drawer} roles={roles} onClose={() => setDrawer(null)}
          onSaved={() => { setDrawer(null); reload(); }} />
      )}
    </>
  );
}
