import { api } from '../../services/api';

export const requirementsService = {
  list: (params) => api.get('/requirement-types', { params }).then((r) => r.data),
  create: (data) => api.post('/requirement-types', data).then((r) => r.data),
  update: (id, data) => api.patch(`/requirement-types/${id}`, data).then((r) => r.data),
};
