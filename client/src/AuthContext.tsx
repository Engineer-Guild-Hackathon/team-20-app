import React, { createContext, useContext, useState, ReactNode } from 'react';

interface AuthContextType {
  authToken: string | null;
  setAuthToken: (token: string | null) => void;
  // 必要に応じて他の認証関連の状態や関数を追加
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [authToken, setAuthToken] = useState<string | null>(localStorage.getItem('access_token'));

  // authTokenが変更されたらlocalStorageも更新
  React.useEffect(() => {
    if (authToken) {
      localStorage.setItem('access_token', authToken);
    } else {
      localStorage.removeItem('access_token');
    }
  }, [authToken]);

  return (
    <AuthContext.Provider value={{ authToken, setAuthToken }}>
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
