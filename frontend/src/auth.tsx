import { createContext, useContext, useState, type ReactNode } from 'react';
import { api } from './api';

interface User { email: string; role: 'admin' | 'customer' }
interface AuthCtx {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

function decode(token: string | null): User | null {
  if (!token) return null;
  try {
    const p = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (p.exp && p.exp * 1000 < Date.now()) return null;
    return { email: p.email, role: p.role };
  } catch { return null; }
}

const Ctx = createContext<AuthCtx>(null!);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => decode(localStorage.getItem('token')));

  const login = async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', data.access_token);
    setUser(decode(data.access_token));
  };
  const register = async (email: string, password: string) => {
    await api.post('/auth/register', { email, password });
    await login(email, password);
  };
  const logout = () => { localStorage.removeItem('token'); setUser(null); };

  return <Ctx.Provider value={{ user, login, register, logout }}>{children}</Ctx.Provider>;
}
