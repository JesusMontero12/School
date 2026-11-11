import { api } from '../../services/api';

export const assignmentsService = {
  list: (params) => api.get('/teaching-assignments', { params }).then((r) => r.data),
  coverage: (params) => api.get('/teaching-assignments/coverage', { params }).then((r) => r.data),
  create: (data) => api.post('/teaching-assignments', data).then((r) => r.data),
  reassign: (id, data) => api.post(`/teaching-assignments/${id}/reassign`, data).then((r) => r.data),
  end: (id, data) => api.post(`/teaching-assignments/${id}/end`, data).then((r) => r.data),
};
