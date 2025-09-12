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
}

const RegisterModal: React.FC<RegisterModalProps> = ({ open, onClose }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  const handleRegister = async () => {
    try {
      const response = await fetch('https://team-20-app-client-7kr4.vercel.app/register', {
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
        // Optionally, you might want to automatically log in the user or redirect to login
        // For now, just close the modal after a short delay
        setTimeout(() => {
          onClose();
          setMessage(''); // Clear message after closing
          setUsername('');
          setPassword('');
        }, 1500);
      } else {
        setMessage(data.detail || '登録失敗');
        setIsError(true);
      }
    } catch (error) {
      setMessage('ネットワークエラーが発生しました。');
      setIsError(true);
    }
  };

  return (
    <Dialog open={open} onClose={onClose}>
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
          variant="standard"
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
          variant="standard"
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
