
import React, { createContext, useState, useContext, ReactNode } from 'react';
import { User } from '../types';

interface AuthContextType {
  currentUser: User | null;
  login: (username: string, password: string, rememberMe: boolean) => Promise<User | null>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock user database
import { MOCK_USERS } from '../services/mockdb';

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
    return new Promise((resolve) => {
      setTimeout(() => { // Simulate network delay
        const user = MOCK_USERS.find(u => u.username === username && u.password === password);
        if (user) {
          const { password, ...userWithoutPassword } = user;
          setCurrentUser(userWithoutPassword);
          
          // If "Remember Me" is checked, save to local storage
          if (rememberMe) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(userWithoutPassword));
          } else {
            // If not checked, ensure we don't have stale data
            localStorage.removeItem(STORAGE_KEY);
          }
          
          resolve(userWithoutPassword);
        } else {
          resolve(null);
        }
      }, 500);
    });
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
