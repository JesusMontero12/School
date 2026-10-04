import { useEffect, useMemo, useState } from 'react';
import { FiLock, FiPlus, FiShield, FiTrash2 } from 'react-icons/fi';
import { Can, EmptyState, PageHeader, Spinner, TableSkeleton } from '../../components/ui';
import { useAsync } from '../../hooks/useAsync';
import { usePermission } from '../../hooks/usePermission';
import { confirmAction, notify } from '../../utils/alerts';
import { getErrorMessage } from '../../utils/errors';
import { permissionsService } from '../permissions/permissionsService';
import RoleFormDrawer from './RoleFormDrawer';
import { rolesService } from './rolesService';

export default function RolesPage() {
  const { can } = usePermission();
  const { data: roles, loading, error, reload } = useAsync(rolesService.list, []);
  const { data: groups } = useAsync(permissionsService.listGrouped, []);
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);

  const role = roles?.find((r) => r.id === selectedId) ?? roles?.[0];
  const saved = useMemo(() => new Set(role?.permissions.map((p) => p.id) ?? []), [role]);
  useEffect(() => { setDraft(new Set(saved)); }, [saved]);

  const locked = role?.code === 'SUPER_ADMIN' || !can('role.edit');
  const dirty = draft.size !== saved.size || [...draft].some((id) => !saved.has(id));

  const toggle = (id) => setDraft((d) => { const n = new Set(d); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleGroup = (perms) => setDraft((d) => {
    const n = new Set(d); const all = perms.every((p) => n.has(p.id));
    perms.forEach((p) => (all ? n.delete(p.id) : n.add(p.id))); return n;
  });

  const save = async () => {
    setSaving(true);
    try { await rolesService.setPermissions(role.id, [...draft]); notify.success('Permisos guardados'); await reload(); }
    catch (e) { notify.error(getErrorMessage(e)); } finally { setSaving(false); }
  };
  const remove = async () => {
    if (!(await confirmAction({ title: `¿Eliminar el rol ${role.name}?`, text: 'Esta acción no se puede deshacer.', confirmText: 'Eliminar rol', danger: true }))) return;
    try { await rolesService.remove(role.id); notify.success('Rol eliminado'); setSelectedId(null); reload(); }
    catch (e) { notify.error(getErrorMessage(e)); }
  };

  return (
    <>
      <PageHeader title="Roles y permisos" description="Cada rol agrupa lo que una persona puede ver y hacer. Marca los permisos y guarda.">
        <Can permission="role.create"><button className="btn-pencil" onClick={() => setCreating(true)}><FiPlus /> Nuevo rol</button></Can>
      </PageHeader>

      {loading && !roles ? <div className="panel"><TableSkeleton /></div> : error ? (
        <div className="panel"><EmptyState icon={FiShield} title="No pudimos cargar los roles" text={error}><button className="btn-ink" onClick={reload}>Reintentar</button></EmptyState></div>
      ) : (
        <div className="roles-layout">
          <div className="panel" style={{ overflow: 'hidden' }} role="list">
            {roles.map((r) => (
              <button key={r.id} role="listitem" className={`role-item ${r.id === role?.id ? 'active' : ''}`} onClick={() => setSelectedId(r.id)}>
                <strong>{r.name}</strong>
                <small>{r.usersCount} {r.usersCount === 1 ? 'usuario' : 'usuarios'} · {r.code === 'SUPER_ADMIN' ? 'todos los' : r.permissions.length} permisos</small>
              </button>
            ))}
          </div>

          {role && (
            <div className="panel" style={{ overflow: 'hidden' }}>
              <div className="toolbar" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ fontSize: '1.3rem', margin: 0 }}>{role.name} {role.isSystem && <span className="chip ms-1">Del sistema</span>}</h2>
                  <small style={{ color: 'var(--muted)' }}>{role.description}</small>
                </div>
                {!role.isSystem && can('role.delete') && <button className="btn-danger-soft btn-sm-x" onClick={remove}><FiTrash2 /> Eliminar rol</button>}
              </div>
              {role.code === 'SUPER_ADMIN' && <div className="alert-x alert-ok" style={{ margin: '1rem 1.25rem 0' }}><FiLock className="me-2" />Este rol tiene siempre todos los permisos y no se puede modificar.</div>}

              {groups?.map(({ module, permissions }) => {
                const count = permissions.filter((p) => draft.has(p.id)).length;
                return (
                  <section className="matrix-group" key={module}>
                    <h4>{module}
                      {!locked && <button className="btn-quiet btn-sm-x" onClick={() => toggleGroup(permissions)}>{count === permissions.length ? 'Quitar todos' : 'Marcar todos'}</button>}
                    </h4>
                    <div className="perm-grid">
                      {permissions.map((p) => {
                        const on = role.code === 'SUPER_ADMIN' || draft.has(p.id);
                        return (
                          <label key={p.id} className={`perm ${on ? 'on' : ''} ${locked ? 'locked' : ''}`}>
                            <input type="checkbox" checked={on} disabled={locked} onChange={() => toggle(p.id)} />
                            <span className="code">{p.code}</span>
                          </label>
                        );
                      })}
                    </div>
                  </section>
                );
              })}

              {dirty && !locked && (
                <div className="savebar" role="status">
                  <span>Tienes cambios sin guardar</span>
                  <div className="d-flex gap-2">
                    <button className="btn-quiet btn-sm-x" style={{ color: '#fff', borderColor: 'rgba(255,255,255,.3)' }} onClick={() => setDraft(new Set(saved))}>Descartar</button>
                    <button className="btn-pencil btn-sm-x" onClick={save} disabled={saving}>{saving ? <Spinner /> : 'Guardar permisos'}</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {creating && <RoleFormDrawer onClose={() => setCreating(false)} onSaved={(r) => { setCreating(false); setSelectedId(r.id); reload(); }} />}
    </>
  );
}
