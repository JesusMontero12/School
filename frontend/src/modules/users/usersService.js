import { api } from '../../services/api';

export const usersService = {
  list: (params) => api.get('/users', { params }).then((r) => r.data),
  create: (data) => api.post('/users', data).then((r) => r.data),
  update: (id, data) => api.patch(`/users/${id}`, data).then((r) => r.data),
  setStatus: (id, isActive) => api.patch(`/users/${id}/status`, { isActive }).then((r) => r.data),
  remove: (id) => api.delete(`/users/${id}`).then((r) => r.data),
  roleOptions: () => api.get('/roles/options').then((r) => r.data),
};
