import { api } from '../../services/api';

export const rolesService = {
  list: () => api.get('/roles').then((r) => r.data),
  create: (data) => api.post('/roles', data).then((r) => r.data),
  update: (id, data) => api.patch(`/roles/${id}`, data).then((r) => r.data),
  setPermissions: (id, permissionIds) => api.put(`/roles/${id}/permissions`, { permissionIds }).then((r) => r.data),
  remove: (id) => api.delete(`/roles/${id}`).then((r) => r.data),
};
