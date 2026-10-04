import { api } from '../../services/api';

export const permissionsService = { listGrouped: () => api.get('/permissions').then((r) => r.data) };
