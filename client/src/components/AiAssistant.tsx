import React, { useState, useRef, useEffect } from 'react';
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
import 'prismjs/prism'; // Prismオブジェクトをグローバルに公開
import 'prismjs/themes/prism.css';
import 'prismjs/components/prism-python';

// 型定義
export interface Message {
  sender: 'user' | 'ai';
  text: string;
}

export interface HistoryContent {
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
  viewMode: 'new' | 'history' | 'current';
  historicalContents?: HistoryContent[];
  currentMessages: Message[];
  onMessagesChange: (messages: Message[]) => void;
  currentPdfFilePaths?: string[];
}

const AiAssistant = ({ pdfSummaryContent, summaryId, viewMode, historicalContents, currentMessages, onMessagesChange, currentPdfFilePaths }: AiAssistantProps) => {
  const [input, setInput] = useState('');
  const [displayMessages, setDisplayMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleSend = async (messageToSend?: string, displayMessage?: string) => {

    const message = messageToSend || input;
    if (!message.trim()) return;

    // チャット画面に表示するメッセージ
    const userDisplayMessage: Message = { sender: 'user', text: displayMessage || message };
    const newMessages = [...currentMessages, userDisplayMessage];
    onMessagesChange(newMessages); // 親コンポーネントに通知
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message,
          pdf_summary: pdfSummaryContent,
          summary_id: summaryId,
          original_file_paths: summaryId === undefined ? currentPdfFilePaths : undefined, // Only send if no summaryId
        }),
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const data = await response.json();
      const aiMessage: Message = { sender: 'ai', text: data.reply };
      const finalMessages = [...newMessages, aiMessage];
      onMessagesChange(finalMessages); // 親コンポーネントに通知

    } catch (error) {
      console.error('Error fetching AI response:', error);
      const errorMessage: Message = {
        sender: 'ai',
        text: '申し訳ありません。エラーが発生しました。',
      };
      const errorMessages = [...newMessages, errorMessage];
      onMessagesChange(errorMessages); // 親コンポーネントに通知
    } finally {
      setLoading(false);
    }
  };

  // 表示用メッセージの管理
  useEffect(() => {
    if (viewMode === 'history') {
      // 履歴表示モード: 履歴データをロード
      const chatHistory = historicalContents?.find(c => c.section_type === 'ai_chat');
      if (chatHistory && chatHistory.content) {
        try {
          const parsedMessages = JSON.parse(chatHistory.content);
          setDisplayMessages(parsedMessages);
        } catch (e) {
          console.error("Failed to parse chat history:", e);
          setDisplayMessages([]);
        }
      } else {
        setDisplayMessages([]);
      }
    } else {
      // 'new' または 'current' モード: 親から渡されたメッセージを表示
      setDisplayMessages(currentMessages);
    }
  }, [viewMode, historicalContents, currentMessages]);

  // メッセージの追加時に一番下にスクロール
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollTop = messagesEndRef.current.scrollHeight;
    }
  }, [displayMessages]);

  return (
    <Paper
      sx={{
        height: '100%',
        p: 2,
        border: '1px solid #00bcd4',
        borderRadius: 2,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 0 15px rgba(0, 188, 212, 0.7)',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <TryIcon color="secondary" />
        <Typography variant="h6" component="h2">
          AI Assistant
        </Typography>
      </Box>
      <Divider sx={{ mb: 2, borderColor: '#00bcd4' }} />

      <Box sx={{ flexGrow: 1, overflowY: 'auto', mb: 2 }} ref={messagesEndRef}>
        <List>
          {displayMessages.map((msg, index) => (
            <ListItem key={index} sx={{ display: 'flex', justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start' }}>
              <Paper
                elevation={2}
                sx={{
                                    p: 1.5,
                  bgcolor: msg.sender === 'user' ? 'primary.main' : 'background.paper', // AIメッセージの背景色をテーマのpaper色に
                  color: msg.sender === 'user' ? 'primary.contrastText' : 'text.primary',
                  maxWidth: '80%',
                  border: '1px solid #00bcd4', // メッセージのボーダー
                  boxShadow: '0 0 5px rgba(0, 188, 212, 0.5)', // メッセージのシャドウ
                }}
              >
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p style={{ margin: 0 }}>{children}</p>,
                    pre: ({ children }) => (
                      <pre style={{
                        backgroundColor: '#1a1a2e', // ダークな背景色
                        color: '#e0e0e0', // 明るい文字色
                        border: '1px solid #00bcd4', // サイバーチックなボーダー
                        borderRadius: '4px',
                        padding: '10px',
                        overflowX: 'auto', // 横スクロール
                        boxShadow: '0 0 5px rgba(0, 188, 212, 0.5)', // サイバーチックなシャドウ
                        whiteSpace: "break-spaces"
                      }}>
                        {children}
                      </pre>
                    ),
                    code: ({ children }) => (
                      <code style={{
                        fontFamily: '"Share Tech Mono", monospace', // サイバーチックなフォント
                        fontSize: '0.9em',
                      }}>
                        {children}
                      </code>
                    ),
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
            <Button variant="outlined" onClick={() => handleSend('要約された文章からpythonで疑似的に動作させるコードを生成してください。使えるライブラリは組み込みライブラリのみです．', 'Pythonコード生成')}>
              Pythonコード生成
            </Button>
            <Button variant="outlined" onClick={() => handleSend('用語を解説してください', '用語解説')}>
              用語解説
            </Button>
            <Button variant="outlined" onClick={() => handleSend('要約内容が正しいかwebで検索してください', '要約内容チェック')}>
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