import { api } from '../../services/api';
import { uploadFile } from '../../services/upload';

export const representativesService = {
  list: (params) => api.get('/representatives', { params }).then((r) => r.data),
  get: (id) => api.get(`/representatives/${id}`).then((r) => r.data),
  update: (id, data) => api.patch(`/representatives/${id}`, data).then((r) => r.data),
  uploadPhoto: (id, file) => uploadFile(`/representatives/${id}/photo`, file),
  photoPath: (id) => `/representatives/${id}/photo`,
};
