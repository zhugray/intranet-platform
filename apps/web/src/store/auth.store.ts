'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'EMPLOYEE' | 'DEPT_EDITOR' | 'DEPT_ADMIN' | 'SUPER_ADMIN';
  deptId?: string;
}

interface AuthState {
  user: User | null;
  _hasHydrated: boolean;
  setUser: (user: User | null) => void;
  setHasHydrated: (state: boolean) => void;
  logout: () => void;
  isAdmin: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      _hasHydrated: false,
      setUser: (user) => set({ user }),
      setHasHydrated: (state) => set({ _hasHydrated: state }),
      logout: () => {
        set({ user: null });
        if (typeof window !== 'undefined') {
          localStorage.removeItem('accessToken');
        }
      },
      isAdmin: () => {
        const role = get().user?.role;
        return role === 'DEPT_ADMIN' || role === 'SUPER_ADMIN';
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
