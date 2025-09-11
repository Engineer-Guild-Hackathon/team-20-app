import React, { useState, useRef, useEffect, useCallback } from 'react';
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
} from '@mui/material';
import ReactMarkdown from 'react-markdown';

// 型定義
interface Message {
  sender: 'user' | 'ai';
  text: string;
}

interface HistoryContent {
  id: number;
  summary_history_id: number;
  section_type: string;
  content: string;
  created_at: string;
  updated_at: string;
}

interface AiAssistantProps {
  pdfSummaryContent?: string;
  summaryId?: number;
  initialContents?: HistoryContent[];
}

const AiAssistant: React.FC<AiAssistantProps> = ({ pdfSummaryContent, summaryId, initialContents }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // チャット履歴をサーバーに保存する関数
  const saveChatHistory = useCallback(async (updatedMessages: Message[]) => {
    if (!summaryId || updatedMessages.length === 0) {
      return; // 保存対象のIDがない、またはメッセージが空なら何もしない
    }
    const token = localStorage.getItem('access_token');
    if (!token) {
      console.warn('チャット履歴を保存するにはログインが必要です。');
      return;
    }

    try {
      const response = await fetch('http://localhost:8000/api/history-contents', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          summary_history_id: summaryId,
          section_type: 'ai_chat',
          content: JSON.stringify(updatedMessages),
        }),
      });

      if (!response.ok) {
        throw new Error('チャット履歴の保存に失敗しました。');
      }
      console.log('チャット履歴が保存されました。');
    } catch (error) {
      console.error('Error saving chat history:', error);
      // 必要であれば、ここでユーザーにエラー通知を表示する
    }
  }, [summaryId]);

  const handleSend = async (messageToSend?: string) => {
    const message = messageToSend || input;
    if (!message.trim()) return;

    const userMessage: Message = { sender: 'user', text: message };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: message, pdf_summary: pdfSummaryContent }),
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const data = await response.json();
      const aiMessage: Message = { sender: 'ai', text: data.reply };
      
      const updatedMessages = [...newMessages, aiMessage];
      setMessages(updatedMessages);
      
      // AIの応答を受け取った後に履歴を保存
      await saveChatHistory(updatedMessages);

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

  // 初期コンテンツ（履歴）の読み込み
  useEffect(() => {
    const chatHistory = initialContents?.find(c => c.section_type === 'ai_chat');
    if (chatHistory && chatHistory.content) {
      try {
        const parsedMessages = JSON.parse(chatHistory.content);
        setMessages(parsedMessages);
      } catch (e) {
        console.error("Failed to parse chat history:", e);
        setMessages([]);
      }
    } else {
      setMessages([]); // 履歴がない場合はクリア
    }
  }, [initialContents]);

  // 新しいPDFが読み込まれたらチャットをリセット
  useEffect(() => {
      if (!initialContents) {
        setMessages([]);
      }
  }, [pdfSummaryContent, initialContents]);

  // メッセージの追加時に一番下にスクロール
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollTop = messagesEndRef.current.scrollHeight;
    }
  }, [messages]);

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

      <Box sx={{ flexGrow: 1, overflowY: 'auto', mb: 2 }} ref={messagesEndRef}>
        <List>
          {messages.map((msg, index) => (
            <ListItem key={index} sx={{ display: 'flex', justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start' }}>
              <Paper
                elevation={2}
                sx={{
                  p: 1.5,
                  bgcolor: msg.sender === 'user' ? 'primary.main' : 'grey.300',
                  color: msg.sender === 'user' ? 'primary.contrastText' : 'text.primary',
                  maxWidth: '80%',
                }}
              >
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p style={{ margin: 0 }}>{children}</p>,
                }}>
                  {msg.text}
                </ReactMarkdown>
              </Paper>
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
        <Button variant="outlined" onClick={() => handleSend('要約された文章からpythonで疑似的に動作させるコードを生成してください。使えるライブラリは組み込みライブラリのみです．')}>
          コード生成
        </Button>
        <Button variant="outlined" onClick={() => handleSend('用語を解説してください')}>
          用語解説
        </Button>
        <Button variant="outlined" onClick={() => handleSend('要約内容が正しいか検索してください')}>
          要約内容チェック
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
          onClick={() => handleSend()}
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
