import { useMemo } from 'react';
import { useAuthStore } from '../modules/auth/store/authStore';

/** Fuente única de verdad para permisos en la UI (el backend siempre vuelve a validar). */
export function usePermission() {
  const permissions = useAuthStore((s) => s.user?.permissions);
  return useMemo(() => {
    const set = new Set(permissions ?? []);
    return {
      can: (p) => set.has(p),
      canAny: (list) => list.some((p) => set.has(p)),
      canAll: (list) => list.every((p) => set.has(p)),
    };
  }, [permissions]);
}
