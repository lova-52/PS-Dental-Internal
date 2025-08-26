// context/AuthContext.tsx
// Quản lý trạng thái đăng nhập toàn cục, expose helpers hasRole/can.

import { apiFetch } from '@/services/api';
import { getStoredAuth, loginWP, logoutWP } from '@/services/auth';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

type User = {
  id: number;
  name: string;
  email: string;
  roles: string[];
} | null;

type AuthContextType = {
  user: User;
  loading: boolean;
  login: (u: string, p: string) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (r: string) => boolean;
  can: (perm: Perm) => boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Khai báo các "permission key" dùng ở UI
type Perm = 'appt.view' | 'appt.create' | 'appt.update' | 'appt.delete' | 'customer.add';

function permsFromRoles(roles: string[]): Record<Perm, boolean> {
  const isAdmin = roles.includes('administrator');
  const isTel   = roles.includes('telesale');
  const isAsst  = roles.includes('assistant');
  // Photographer (thợ chụp ảnh): không vào tab -> không cần cấp quyền ở đây

  return {
    'appt.view':   isAdmin || isTel || isAsst,
    'appt.create': isAdmin || isTel,       // phụ tá không được đặt hẹn
    'appt.update': isAdmin || isTel,
    'appt.delete': isAdmin || isTel,
    'customer.add': isAdmin || isTel || isAsst, // cả telesale + phụ tá đều được tạo khách hàng
  };
}

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);

  // Khởi động: nếu có token -> thử gọi /me
  useEffect(() => {
    (async () => {
      try {
        const { token } = await getStoredAuth();
        if (token) {
          const me = await apiFetch('/wp-json/custom/v1/me', { auth: true }) as any;
          setUser(me);
        }
      } catch {
        // token hỏng -> xoá trạng thái
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (username: string, password: string) => {
    setLoading(true);
    try {
      const { me } = await loginWP(username, password);
      setUser(me);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await logoutWP();
    setUser(null);
  };

  const value = useMemo<AuthContextType>(() => ({
    user,
    loading,
    login,
    logout,
    hasRole: (r) => !!user?.roles?.includes(r),
    can: (perm) => permsFromRoles(user?.roles || [])[perm],
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
