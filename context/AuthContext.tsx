
import React, { createContext, useState, useContext, ReactNode } from 'react';
import { User, Role } from '../types';
import { supabase } from '../services/supabaseClient';

interface AuthContextType {
  currentUser: User | null;
  login: (username: string, password: string, rememberMe: boolean) => Promise<User | null>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'dmi_auth_user';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Initialize state from localStorage to persist login on refresh
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const savedUser = localStorage.getItem(STORAGE_KEY);
      return savedUser ? JSON.parse(savedUser) : null;
    } catch (error) {
      console.error("Failed to load auth from storage", error);
      return null;
    }
  });

  const login = async (username: string, password: string, rememberMe: boolean): Promise<User | null> => {
    try {
      // Query ke tabel app_users di Supabase
      // Menggunakan maybeSingle() agar tidak error jika data tidak ditemukan (user/pass salah)
      const { data, error } = await supabase
        .from('app_users')
        .select('*')
        .eq('username', username)
        .eq('password', password)
        .maybeSingle();

      if (error) {
        console.error("Login error details:", error);
        return null;
      }

      if (!data) {
        // Username atau password salah (data null, bukan error sistem)
        return null;
      }

      const user: User = {
        id: data.id,
        username: data.username,
        role: data.role as Role,
        outlet: data.outlet || undefined
      };

      setCurrentUser(user);
      
      if (rememberMe) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
      
      return user;

    } catch (err) {
      console.error("Unexpected login error", err);
      return null;
    }
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <AuthContext.Provider value={{ currentUser, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
