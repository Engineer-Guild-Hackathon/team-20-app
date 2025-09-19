import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Typography
} from '@mui/material';

interface RegisterModalProps {
  open: boolean;
  onClose: () => void;
  onLoginSuccess: (token: string) => void;
  showSnackbar: (message: string, severity: 'success' | 'error' | 'info' | 'warning') => void;
  setAuthToken: (token: string | null) => void; // NEW: Add setAuthToken
}

const RegisterModal: React.FC<RegisterModalProps> = ({ open, onClose, onLoginSuccess, showSnackbar, setAuthToken }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  const handleRegister = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(data.message || '登録成功！');
        setIsError(false);

        // --- 自動ログイン処理 ---
        try {
          const loginResponse = await fetch(`${API_BASE}/api/login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
          });

          if (loginResponse.ok) {
            const loginData = await loginResponse.json();
            localStorage.removeItem('access_token'); // Remove old token if any
            setAuthToken(loginData.access_token); // Use setAuthToken to update AuthContext and localStorage
            onLoginSuccess(loginData.access_token); // Call the new callback
            showSnackbar('登録とログインに成功しました！', 'success');
            onClose();
            setMessage('');
            setUsername('');
            setPassword('');
          } else {
            const loginErrorData = await loginResponse.json();
            setMessage(`登録は成功しましたが、自動ログインに失敗しました: ${loginErrorData.detail}`);
            setIsError(true);
            showSnackbar('登録は成功しましたが、自動ログインに失敗しました。', 'warning');
            // Still close after a delay if auto-login fails but registration succeeded
            setTimeout(() => {
              onClose();
              setMessage('');
              setUsername('');
              setPassword('');
            }, 1500);
          }
        } catch (loginError) {
          setMessage('登録は成功しましたが、自動ログイン中にネットワークエラーが発生しました。');
          setIsError(true);
          showSnackbar('登録は成功しましたが、自動ログイン中にネットワークエラーが発生しました。', 'warning');
          setTimeout(() => {
            onClose();
            setMessage('');
            setUsername('');
            setPassword('');
          }, 1500);
        }
        // --- 自動ログイン処理 終わり ---

      } else {
        setMessage(data.detail || '登録失敗');
        setIsError(true);
        showSnackbar(data.detail || '登録失敗', 'error'); // Show snackbar for registration failure
      }
    } catch (error) {
      setMessage('ネットワークエラーが発生しました。');
      setIsError(true);
    }
  };

  return (
    <Dialog open={open} onClose={onClose}
      PaperProps={{
        sx: {
          border: '1px solid #00bcd4', // サイバーチックなボーダー色に変更
          boxShadow: '0 0 15px rgba(0, 188, 212, 0.7)', // より強調されたシャドウ
        }
      }}
    >
      <DialogTitle>新規登録</DialogTitle>
      <DialogContent>
        {message && (
          <Typography color={isError ? "error" : "primary"} variant="body2" sx={{ mb: 2 }}>
            {message}
          </Typography>
        )}
        <TextField
          autoFocus
          margin="dense"
          label="ユーザー名"
          type="text"
          fullWidth
          variant="outlined"
          value={username}
          onChange={(e) => {
            setUsername(e.target.value);
            setMessage(''); // Clear message on input change
          }}
        />
        <TextField
          margin="dense"
          label="パスワード"
          type="password"
          fullWidth
          variant="outlined"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setMessage(''); // Clear message on input change
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button onClick={handleRegister}>登録</Button>
      </DialogActions>
    </Dialog>
  );
};

export default RegisterModal;
const API_BASE = process.env.REACT_APP_API_BASE_URL || '';
