import { create } from 'zustand';
import { authBridge, refreshSession } from '../../../services/api';
import { authService } from '../../../services/authService';

/**
 * El access token vive SOLO en memoria (no localStorage): un XSS no puede robarlo.
 * Al recargar, `bootstrap()` recupera la sesión con la cookie HttpOnly del refresh token.
 */
export const useAuthStore = create((set, get) => ({
  status: 'idle', // idle | loading | authenticated | anonymous
  accessToken: null,
  user: null,

  setSession: ({ accessToken, user }) => set({ accessToken, user, status: 'authenticated' }),
  clear: () => set({ accessToken: null, user: null, status: 'anonymous' }),

  bootstrap: async () => {
    if (get().status !== 'idle') return;
    set({ status: 'loading' });
    try { await refreshSession(); } catch { get().clear(); }
  },

  login: async (credentials) => {
    const session = await authService.login(credentials);
    get().setSession(session);
    return session.user;
  },

  logout: async () => {
    try { await authService.logout(); } finally { get().clear(); }
  },
}));

authBridge.getToken = () => useAuthStore.getState().accessToken;
authBridge.setSession = (s) => useAuthStore.getState().setSession(s);
authBridge.clear = () => useAuthStore.getState().clear();
