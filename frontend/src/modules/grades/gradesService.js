import { api } from '../../services/api';

export const gradesService = {
  sheet: (params) => api.get('/grade-sheet', { params }).then((r) => r.data),
  listEvaluations: (params) => api.get('/evaluations', { params }).then((r) => r.data),
  createEvaluation: (data) => api.post('/evaluations', data).then((r) => r.data),
  updateEvaluation: (id, data) => api.patch(`/evaluations/${id}`, data).then((r) => r.data),
  voidEvaluation: (id, reason) => api.post(`/evaluations/${id}/void`, { reason }).then((r) => r.data),
  saveScores: (id, scores, reason) => api.put(`/evaluations/${id}/scores`, { scores, reason }).then((r) => r.data),
};
