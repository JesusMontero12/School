import { api } from '../../services/api';

export const schoolYearsService = {
  list: (params) => api.get('/school-years', { params }).then((r) => r.data),
  options: () => api.get('/school-years/options').then((r) => r.data),
  get: (id) => api.get(`/school-years/${id}`).then((r) => r.data),
  create: (data) => api.post('/school-years', data).then((r) => r.data),
  update: (id, data) => api.patch(`/school-years/${id}`, data).then((r) => r.data),
  setStatus: (id, status) => api.patch(`/school-years/${id}/status`, { status }).then((r) => r.data),
  setTermStatus: (id, number, status) => api.patch(`/school-years/${id}/terms/${number}/status`, { status }).then((r) => r.data),
};
