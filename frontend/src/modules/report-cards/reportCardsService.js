import { api } from '../../services/api';

export const reportCardsService = {
  list: (params) => api.get('/report-cards', { params }).then((r) => r.data),
  get: (enrollmentId) => api.get(`/report-cards/${enrollmentId}`).then((r) => r.data),
};
