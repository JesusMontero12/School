import { api } from '../../services/api';

export const teachersService = {
  list: (params) => api.get('/teachers', { params }).then((r) => r.data),
  options: () => api.get('/teachers/options').then((r) => r.data),
  userOptions: (includeUserId) => api.get('/teachers/user-options', { params: { includeUserId } }).then((r) => r.data),
  create: (data) => api.post('/teachers', data).then((r) => r.data),
  update: (id, data) => api.patch(`/teachers/${id}`, data).then((r) => r.data),
};
