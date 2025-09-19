import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Typography
} from '@mui/material';

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
  showSnackbar: (message: string, severity: 'success' | 'error' | 'info' | 'warning') => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ open, onClose, showSnackbar }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (open) {
      setErrorMessage(''); // Clear error when modal opens
      setUsername(''); // Clear username
      setPassword(''); // Clear password
    }
  }, [open]);

  const handleLogin = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('access_token', data.access_token);
        showSnackbar('ログインに成功しました！', 'success'); // Call showSnackbar
        setErrorMessage(''); // Clear any previous error
        onClose(); // ログイン成功時にモーダルを閉じる
      } else {
        const errorData = await response.json();
        console.error('ログイン失敗:', errorData.detail);
        setErrorMessage(`ログイン失敗: ${errorData.detail}`); // Set error message
      }
    } catch (error) {
      console.error('ネットワークエラー:', error);
      setErrorMessage('ネットワークエラーが発生しました。'); // Set error message
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
      <DialogTitle>ログイン</DialogTitle>
      <DialogContent>
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
            setErrorMessage(''); // Clear error on input change
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
            setErrorMessage(''); // Clear error on input change
          }}
        />
        {errorMessage && (
          <Typography color="error" variant="body2" sx={{ mt: 2 }}>
            {errorMessage}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button onClick={handleLogin}>ログイン</Button>
      </DialogActions>
    </Dialog>
  );
};

export default LoginModal;
const API_BASE = process.env.REACT_APP_API_BASE_URL || '';
