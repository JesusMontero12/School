import { api } from "../../services/api";
import { uploadFile } from "../../services/upload";

export const enrollmentsService = {
  list: (params) => api.get("/enrollments", { params }).then((r) => r.data),
  get: (id) => api.get(`/enrollments/${id}`).then((r) => r.data),
  create: (data) => api.post("/enrollments", data).then((r) => r.data),
  update: (id, data) =>
    api.patch(`/enrollments/${id}`, data).then((r) => r.data),
  setStatus: (id, status, reason) =>
    api
      .patch(`/enrollments/${id}/status`, {
        status,
        reason: reason || undefined,
      })
      .then((r) => r.data),
  setRepresentatives: (id, representatives) =>
    api
      .put(`/enrollments/${id}/representatives`, { representatives })
      .then((r) => r.data),
  lookupStudents: (search) =>
    api
      .get("/enrollments/lookup/students", { params: { search } })
      .then((r) => r.data),
  lookupRepresentatives: (search) =>
    api
      .get("/enrollments/lookup/representatives", { params: { search } })
      .then((r) => r.data),

  updateDocument: (id, typeId, data) =>
    api
      .patch(`/enrollments/${id}/documents/${typeId}`, data)
      .then((r) => r.data),
  uploadDocumentFile: (id, typeId, file) =>
    uploadFile(`/enrollments/${id}/documents/${typeId}/file`, file),
  removeDocumentFile: (id, typeId) =>
    api
      .delete(`/enrollments/${id}/documents/${typeId}/file`)
      .then((r) => r.data),
  documentFilePath: (id, typeId) =>
    `/enrollments/${id}/documents/${typeId}/file`,

  uploadStudentPhoto: (id, file) =>
    uploadFile(`/enrollments/${id}/student-photo`, file),
  uploadRepresentativePhoto: (id, representativeId, file) =>
    uploadFile(
      `/enrollments/${id}/representatives/${representativeId}/photo`,
      file,
    ),
};
