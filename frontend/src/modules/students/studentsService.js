import { api } from '../../services/api';
import { uploadFile } from '../../services/upload';

export const studentsService = {
  list: (params) => api.get('/students', { params }).then((r) => r.data),
  get: (id) => api.get(`/students/${id}`).then((r) => r.data),
  update: (id, data) => api.patch(`/students/${id}`, data).then((r) => r.data),
  history: (id, params) => api.get(`/students/${id}/history`, { params }).then((r) => r.data),
  uploadPhoto: (id, gradeLevelId, file) => uploadFile(`/students/${id}/photos/${gradeLevelId}`, file),
  photoPath: (id, gradeLevelId) => `/students/${id}/photos/${gradeLevelId}/file`,
};
