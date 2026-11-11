import { api } from '../../services/api';

export const reportsService = {
  performance: (params) => api.get('/reports/performance', { params }).then((r) => r.data),
  students: (params) => api.get('/reports/students', { params }).then((r) => r.data),
  pending: (params) => api.get('/reports/pending', { params }).then((r) => r.data),
};
