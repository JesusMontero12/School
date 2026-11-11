import { api } from '../../services/api';

export const subjectsService = {
  list: (params) => api.get('/subjects', { params }).then((r) => r.data),
  options: () => api.get('/subjects/options').then((r) => r.data),
  get: (id) => api.get(`/subjects/${id}`).then((r) => r.data),
  create: (data) => api.post('/subjects', data).then((r) => r.data),
  update: (id, data) => api.patch(`/subjects/${id}`, data).then((r) => r.data),
  termSettings: (schoolYearId) => api.get('/subjects/term-settings', { params: { schoolYearId } }).then((r) => r.data),
  setTermSetting: (subjectId, termId, hasLapsoTest) =>
    api.put(`/subjects/${subjectId}/term-settings/${termId}`, { hasLapsoTest }).then((r) => r.data),
};
