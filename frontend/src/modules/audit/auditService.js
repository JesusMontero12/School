import { api } from '../../services/api';

export const auditService = { list: (params) => api.get('/audit-logs', { params }).then((r) => r.data) };
