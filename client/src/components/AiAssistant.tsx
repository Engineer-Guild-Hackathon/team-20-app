import React, { useState } from 'react';
import TryIcon from '@mui/icons-material/Try';
import {
  Paper,
  Typography,
  TextField,
  Button,
  Box,
  Divider,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Avatar,
} from '@mui/material';

interface Message {
  sender: 'user' | 'ai';
  text: string;
}

const AiAssistant: React.FC = () => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = { sender: 'user', text: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: input }),
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const data = await response.json();
      const aiMessage: Message = { sender: 'ai', text: data.reply };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error fetching AI response:', error);
      const errorMessage: Message = {
        sender: 'ai',
        text: '申し訳ありません。エラーが発生しました。',
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper
      sx={{
        height: '100%',
        p: 2,
        border: '1px solid #e0e0e0',
        borderRadius: 2,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <TryIcon color="secondary" />
        <Typography variant="h6" component="h2">
          AI Assistant
        </Typography>
      </Box>
      <Divider sx={{ mb: 2 }} />

      <Box sx={{ flexGrow: 1, overflowY: 'auto', mb: 2 }}>
        <List>
          {messages.map((msg, index) => (
            <ListItem key={index} sx={{ display: 'flex', justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start' }}>
              {msg.sender === 'ai' && <Avatar sx={{ mr: 1 }}>AI</Avatar>}
              <Paper
                elevation={2}
                sx={{
                  p: 1.5,
                  bgcolor: msg.sender === 'user' ? 'primary.main' : 'grey.300',
                  color: msg.sender === 'user' ? 'primary.contrastText' : 'text.primary',
                  maxWidth: '80%',
                }}
              >
                <ListItemText primary={msg.text} />
              </Paper>
              {msg.sender === 'user' && <Avatar sx={{ ml: 1 }}>U</Avatar>}
            </ListItem>
          ))}
          {loading && (
            <ListItem sx={{ justifyContent: 'center' }}>
              <CircularProgress />
            </ListItem>
          )}
        </List>
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-around', mb: 2 }}>
        <Button variant="outlined" onClick={() => setInput('コードを生成してください:')}>
          コード生成
        </Button>
        <Button variant="outlined" onClick={() => setInput('用語を解説してください:')}>
          用語解説
        </Button>
        <Button variant="outlined" onClick={() => setInput('検索してください:')}>
          検索
        </Button>
      </Box>
      <Box sx={{ display: 'flex' }}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="メッセージを入力..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && !loading && handleSend()}
          disabled={loading}
        />
        <Button
          variant="contained"
          color="primary"
          onClick={handleSend}
          disabled={loading}
          sx={{ ml: 1 }}
        >
          Send
        </Button>
      </Box>
    </Paper>
  );
};

export default AiAssistant;
