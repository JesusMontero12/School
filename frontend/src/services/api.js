import axios from 'axios';

/** Puente hacia el store de auth (evita la dependencia circular store → service → api → store). */
export const authBridge = { getToken: () => null, setSession: () => {}, clear: () => {} };

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1',
  withCredentials: true, // envía la cookie HttpOnly del refresh token
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = authBridge.getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Una sola renovación en vuelo: si 5 peticiones fallan a la vez, se refresca una sola vez.
let refreshing = null;
export const refreshSession = () => {
  refreshing ??= api.post('/auth/refresh').then((r) => { authBridge.setSession(r.data); return r.data; })
    .finally(() => { refreshing = null; });
  return refreshing;
};

const AUTH_PATHS = ['/auth/login', '/auth/refresh', '/auth/logout', '/auth/forgot-password', '/auth/reset-password'];

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const { config, response } = error;
    const isAuthCall = AUTH_PATHS.some((p) => config?.url?.includes(p));
    if (response?.status === 401 && config && !config._retry && !isAuthCall) {
      config._retry = true;
      try {
        const { accessToken } = await refreshSession();
        config.headers.Authorization = `Bearer ${accessToken}`;
        return api(config);
      } catch {
        authBridge.clear();
      }
    }
    return Promise.reject(error);
  },
);
