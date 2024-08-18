import React, { createContext, useContext, useState, ReactNode } from 'react';
import { User } from '@/types';
import { apiFetch } from '@/utils/api';

interface AuthContextType {
  user?: User;
  setUser: (user: User) => void;
  fetchUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User>();

  async function fetchUser() {
    try {
      const user = await apiFetch('auth');
      console.log('user', user);
      localStorage.setItem('gu', user.uid);
      setUser(user);
    } catch (e) {
      console.error('Failed to fetch user', e);
    }
  }

  return (
    <AuthContext.Provider value={{ user, setUser, fetchUser }}>{children}</AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
