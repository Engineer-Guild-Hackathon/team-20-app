import React, { createContext, useContext, useState, ReactNode } from 'react';

interface AuthContextType {
  authToken: string | null;
  setAuthToken: (token: string | null) => void;
  isLoggedIn: boolean; // NEW: Derived from authToken
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [authToken, setAuthToken] = useState<string | null>(localStorage.getItem('access_token'));
  const isLoggedIn = !!authToken; // Derive isLoggedIn from authToken

  // authTokenが変更されたらlocalStorageも更新
  React.useEffect(() => {
    if (authToken) {
      localStorage.setItem('access_token', authToken);
    } else {
      localStorage.removeItem('access_token');
    }
  }, [authToken]);

  return (
    <AuthContext.Provider value={{ authToken, setAuthToken, isLoggedIn }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
