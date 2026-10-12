import { api } from '../../services/api';

export const gradeLevelsService = {
  list: () => api.get('/grade-levels').then((r) => r.data),
  update: (id, data) => api.patch(`/grade-levels/${id}`, data).then((r) => r.data),
};

export const sectionsService = {
  list: (params) => api.get('/sections', { params }).then((r) => r.data),
  create: (data) => api.post('/sections', data).then((r) => r.data),
  update: (id, data) => api.patch(`/sections/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/sections/${id}`).then((r) => r.data),
};
