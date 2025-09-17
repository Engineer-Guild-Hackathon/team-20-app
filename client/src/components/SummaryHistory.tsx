import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Paper,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Divider,
  Box,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
  Menu, // 追加
  MenuItem, // 追加
  IconButton, // 追加
  Snackbar, // 追加
  Alert, // 追加
} from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import AddReactionIcon from '@mui/icons-material/AddReaction'; // 追加
import AccountTreeIcon from '@mui/icons-material/AccountTree'; // 追加
import SummaryTreeGraph from './SummaryTreeGraph'; // 追加
import { Message, HistoryContent } from './AiAssistant'; // AiAssistantと関連する型をインポート

// App.tsxから渡されるHistoryItemの型を再利用
interface HistoryItem {
  id?: number;
  filename: string;
  summary: string;
  created_at?: string;
  team_id?: number; // 追加
  username?: string; // 追加
  team_name?: string; // 追加
  tags?: string[]; // 追加
  contents?: HistoryContent[]; // 追加
  chat_history_id?: number; // チャット履歴IDを追加
}

interface SummaryHistoryProps {
  histories: HistoryItem[];
  onHistoryClick: (item: HistoryItem) => void;
  onUpdateHistory: (updatedItem: HistoryItem) => void;
  currentUsername: string | null; // 追加
}

// チャット履歴表示用のコンポーネント
const ChatHistoryDisplay: React.FC<{ chatHistoryId?: number }> = ({ chatHistoryId }) => {
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchChatHistory = async () => {
      if (!chatHistoryId) {
        setChatMessages([]);
        return;
      }

      setLoading(true);
      setError(null);

      const token = localStorage.getItem('access_token');
      if (!token) {
        setError('認証情報がありません');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`http://localhost:8000/api/history-contents/${chatHistoryId}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });

        if (!response.ok) {
          throw new Error('チャット履歴の読み込みに失敗しました');
        }

        const data = await response.json();
        if (data.content) {
          const messages = JSON.parse(data.content);
          setChatMessages(messages);
        } else {
          setChatMessages([]);
        }
      } catch (err) {
        console.error('Error fetching chat history:', err);
        setError(err instanceof Error ? err.message : 'チャット履歴の読み込みに失敗しました');
        setChatMessages([]);
      } finally {
        setLoading(false);
      }
    };

    fetchChatHistory();
  }, [chatHistoryId]);

  if (loading) {
    return <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>チャット履歴を読み込み中...</Typography>;
  }

  if (error) {
    return <Typography variant="body2" color="error" sx={{ p: 1 }}>{error}</Typography>;
  }

  if (!chatHistoryId || chatMessages.length === 0) {
    return <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>AI Assistant とのチャット履歴はありません。</Typography>;
  }

  return (
    <List>
      {chatMessages.map((msg: Message, index: number) => (
        <ListItem key={index} sx={{ display: 'flex', flexDirection: 'column', alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start', px: 0 }}>
          {msg.sender === 'user' && msg.username && (
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, mr: 1 }}>
              {msg.username}
            </Typography>
          )}
          <Paper
            elevation={2}
            sx={{
              p: 1.5,
              bgcolor: msg.sender === 'user' ? 'primary.main' : 'background.paper',
              color: msg.sender === 'user' ? 'primary.contrastText' : 'text.primary',
              maxWidth: '80%',
              border: '1px solid #00bcd4',
              boxShadow: '0 0 5px rgba(0, 188, 212, 0.5)',
            }}
          >
            <ReactMarkdown
              components={{
                p: ({ children }) => <p style={{ margin: 0 }}>{children}</p>,
                pre: ({ children }) => (
                  <pre style={{
                    backgroundColor: '#1a1a2e',
                    color: '#e0e0e0',
                    border: '1px solid #00bcd4',
                    borderRadius: '4px',
                    padding: '10px',
                    overflowX: 'auto',
                    boxShadow: '0 0 5px rgba(0, 188, 212, 0.5)',
                    whiteSpace: "break-spaces"
                  }}>
                    {children}
                  </pre>
                ),
                code: ({ children }) => (
                  <code style={{
                    fontFamily: '"Share Tech Mono", monospace',
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
    </List>
  );
};

const SummaryHistory: React.FC<SummaryHistoryProps> = ({ histories, onHistoryClick, onUpdateHistory, currentUsername }) => {
  const [filter, setFilter] = useState('all');
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'tree'
  const [open, setOpen] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<HistoryItem | null>(null);
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [editingTags, setEditingTags] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitle, setEditingTitle] = useState('');
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const openReactionMenu = Boolean(anchorEl);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error' | 'warning' | 'info'>('info');

  // コメントをフェッチする関数
  const fetchComments = async (summaryId: number) => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      console.error('Not logged in');
      return;
    }
    try {
      const response = await fetch(`http://localhost:8000/api/summaries/${summaryId}/comments`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setComments(data);
      } else {
        console.error('Failed to fetch comments');
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  // selectedHistoryが変更されたらコメントをフェッチ
  useEffect(() => {
    if (selectedHistory && selectedHistory.id) {
      fetchComments(selectedHistory.id);
    } else {
      setComments([]); // 選択解除されたらコメントをクリア
    }
  }, [selectedHistory]);

  const displayedHistories = histories.filter(item => {
    if (filter === 'personal') {
      return !item.team_id;
    }
    if (filter === 'team') {
      return !!item.team_id;
    }
    return true; // 'all'
  });

  const handleHistoryItemClick = (item: HistoryItem) => {
    // currentUsername propを使用
    if (currentUsername && item.username && item.username === currentUsername) {
      onHistoryClick(item); // メインページに転送
    } else {
      setSelectedHistory(item);
      setOpen(true); // モーダルウィンドウで表示
    }
  };

  const handleClose = () => {
    setOpen(false);
    setSelectedHistory(null);
    setIsEditingTags(false); // ダイアログを閉じるときに編集モードをリセット
    setIsEditingTitle(false); // タイトル編集モードもリセット
  };

  const handleEditTags = () => {
    if (selectedHistory) {
      setEditingTags(selectedHistory.tags?.join(', ') || '');
      setIsEditingTags(true);
    }
  };

  const handleCancelEdit = () => {
    setIsEditingTags(false);
  };

  const handleSaveTags = async () => {
    if (!selectedHistory || !selectedHistory.id) return;

    const token = localStorage.getItem('access_token');
    if (!token) {
      console.error('Not logged in');
      return;
    }

    const tagsArray = editingTags.split(',').map(t => t.trim()).filter(t => t);

    try {
      const response = await fetch(`http://localhost:8000/api/summaries/${selectedHistory.id}/tags`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ tags: tagsArray }),
      });

      if (response.ok) {
        const updatedHistory = { ...selectedHistory, tags: tagsArray };
        onUpdateHistory(updatedHistory);
        setSelectedHistory(updatedHistory); // モーダル内の表示も即時更新
        setIsEditingTags(false);
      } else {
        console.error('Failed to update tags');
      }
    } catch (error) {
      console.error('Error saving tags:', error);
    }
  };

  const handleEditTitle = () => {
    if (selectedHistory) {
      setEditingTitle(selectedHistory.filename);
      setIsEditingTitle(true);
    }
  };

  const handleCancelTitleEdit = () => {
    setIsEditingTitle(false);
  };

  const handleSaveTitle = async () => {
    if (!selectedHistory || !selectedHistory.id || !editingTitle.trim()) return;

    const token = localStorage.getItem('access_token');
    if (!token) {
      console.error('Not logged in');
      return;
    }

    try {
      const response = await fetch(`http://localhost:8000/api/summaries/${selectedHistory.id}/title`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ filename: editingTitle }),
      });

      if (response.ok) {
        const updatedHistory = { ...selectedHistory, filename: editingTitle };
        onUpdateHistory(updatedHistory);
        setSelectedHistory(updatedHistory); // モーダル内の表示も即時更新
        setIsEditingTitle(false);
      } else {
        console.error('Failed to update title');
        const errorData = await response.json();
        setSnackbarMessage(errorData.detail || 'タイトルの更新に失敗しました');
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
      }
    } catch (error) {
      console.error('Error saving title:', error);
      setSnackbarMessage('タイトルの保存中にエラーが発生しました');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  const handleAddComment = async () => {
    if (!selectedHistory || !selectedHistory.id || !newComment.trim()) return;

    const token = localStorage.getItem('access_token');
    if (!token) {
      console.error('Not logged in');
      return;
    }

    try {
      const response = await fetch('http://localhost:8000/api/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ summary_id: selectedHistory.id, content: newComment }),
      });

      if (response.ok) {
        setNewComment('');
        fetchComments(selectedHistory.id); // コメントリストを再フェッチ
      } else {
        console.error('Failed to add comment');
      }
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const handleAddReaction = async (commentId: number, reactionType: string) => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      console.error('Not logged in');
      return;
    }

    try {
      const response = await fetch(`http://localhost:8000/api/comments/${commentId}/reactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ reaction_type: reactionType }),
      });

      if (response.ok) {
        if (selectedHistory && selectedHistory.id) {
          fetchComments(selectedHistory.id); // コメントリストを再フェッチしてリアクションを更新
        }
      } else {
        const errorData = await response.json();
        console.error('Failed to add reaction:', errorData.detail);
        setSnackbarMessage(errorData.detail);
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
      }
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
  };

  const handleRemoveReaction = async (commentId: number, reactionType: string) => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      console.error('Not logged in');
      return;
    }

    try {
      const response = await fetch(`http://localhost:8000/api/comments/${commentId}/reactions`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ reaction_type: reactionType }),
      });

      if (response.ok) {
        if (selectedHistory && selectedHistory.id) {
          fetchComments(selectedHistory.id); // コメントリストを再フェッチしてリアクションを更新
        }
      } else {
        const errorData = await response.json();
        console.error('Failed to remove reaction:', errorData.detail);
        setSnackbarMessage(errorData.detail);
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
      }
    } catch (error) {
      console.error('Error removing reaction:', error);
    }
  };

  const handleClickReactionMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleCloseReactionMenu = () => {
    setAnchorEl(null);
  };

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
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <HistoryIcon color="primary" />
          <Typography variant="h6" component="h2">
            要約履歴
          </Typography>
        </Box>
        <ToggleButtonGroup
          value={filter}
          exclusive
          onChange={(event, newFilter) => {
            if (newFilter !== null) {
              setFilter(newFilter);
            }
          }}
          aria-label="history filter"
          size="small"
          sx={{
            border: '1px solid #00bcd4', // ボーダーを追加
            boxShadow: '0 0 5px rgba(0, 188, 212, 0.5)', // シャドウを追加
          }}
        >
          <ToggleButton value="all" aria-label="all histories">
            すべて
          </ToggleButton>
          <ToggleButton value="personal" aria-label="personal histories">
            個人
          </ToggleButton>
          <ToggleButton value="team" aria-label="team histories">
            チーム
          </ToggleButton>
        </ToggleButtonGroup>
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={(event, newViewMode) => {
            if (newViewMode !== null) {
              setViewMode(newViewMode);
            }
          }}
          aria-label="view mode"
          size="small"
          sx={{
            ml: 2,
            border: '1px solid #00bcd4',
            boxShadow: '0 0 5px rgba(0, 188, 212, 0.5)',
          }}
        >
          <ToggleButton value="list" aria-label="list view">
            <HistoryIcon fontSize="small" />
          </ToggleButton>
          <ToggleButton value="tree" aria-label="tree view">
            <AccountTreeIcon fontSize="small" />
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>
      <Divider sx={{ mb: 1, borderColor: '#00bcd4' }} />
      <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
        {viewMode === 'list' ? (
          displayedHistories.length === 0 ? (
            <Typography sx={{ textAlign: 'center', color: 'text.secondary', mt: 4 }}>
              履歴はありません
            </Typography>
          ) : (
            <List disablePadding>
              {displayedHistories.map((item, index) => (
                <ListItem key={item.id || index} disablePadding>
                  <ListItemButton
                    onClick={() => handleHistoryItemClick(item)}
                    sx={{
                      '&:hover': {
                        backgroundColor: 'rgba(0, 188, 212, 0.1)', // ホバー時の背景色
                      },
                    }}
                  >
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Typography
                            component="span"
                            variant="body2"
                            fontWeight={500}
                            noWrap
                            sx={{ flexGrow: 1 }}
                          >
                            {item.filename}
                          </Typography>
                          {item.team_id && (
                            <Chip
                              label={`チーム共有: ${item.team_name || '不明'} (${item.username || '不明'})`}
                              size="small"
                              // color="info" // 削除
                              sx={{ ml: 1, border: '1px solid #00bcd4' }} // ボーダーを追加
                            />
                          )}
                        </Box>
                      }
                      secondary={
                        <>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.5 }}>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, flexGrow: 1 }}>
                              {item.tags?.map((tag, index) => (
                                <Chip key={index} label={tag} size="small" sx={{ border: '1px solid #00bcd4' }} /> // ボーダーを追加
                              ))}
                            </Box>
                            <Typography
                              component="span"
                              variant="caption"
                              color="text.secondary"
                              sx={{ flexShrink: 0, ml: 1 }}
                            >
                              {item.created_at && !isNaN(new Date(item.created_at).getTime())
                                ? new Intl.DateTimeFormat('ja-JP', {
                                    year: 'numeric',
                                    month: '2-digit',
                                    day: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit',
                                  }).format(new Date(item.created_at))
                                : '日付不明'}
                            </Typography>
                          </Box>
                        </>
                      }
                      secondaryTypographyProps={{ component: 'span' }}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          )
        ) : (
          <SummaryTreeGraph onNodeClick={handleHistoryItemClick} />
        )}
      </Box>
      {selectedHistory && (
        <Dialog open={open} onClose={handleClose} fullWidth maxWidth="md">
          <DialogTitle>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {isEditingTitle ? (
                <TextField
                  fullWidth
                  variant="outlined"
                  size="small"
                  value={editingTitle}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditingTitle(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleSaveTitle();
                    }
                  }}
                  sx={{ mr: 1 }}
                />
              ) : (
                <Typography variant="h6" component="span" sx={{ flexGrow: 1 }}>
                  {selectedHistory.filename}
                </Typography>
              )}
              <Box>
                {isEditingTitle ? (
                  <>
                    <Button onClick={handleCancelTitleEdit} size="small">キャンセル</Button>
                    <Button onClick={handleSaveTitle} variant="contained" size="small" sx={{ ml: 1 }}>保存</Button>
                  </>
                ) : (
                  <Button onClick={handleEditTitle} size="small">タイトル編集</Button>
                )}
              </Box>
            </Box>
          </DialogTitle>
          <DialogContent>
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>タグ</Typography>
              {isEditingTags ? (
                <TextField
                  fullWidth
                  variant="outlined"
                  size="small"
                  value={editingTags}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditingTags(e.target.value)}
                  placeholder="カンマ区切りでタグを入力"
                />
              ) : (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                  {selectedHistory.tags && selectedHistory.tags.length > 0 ? (
                    selectedHistory.tags.map((tag, index) => (
                      <Chip key={index} label={tag} />
                    ))
                  ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>タグはありません</Typography>
                  )}
                  <Button size="small" onClick={handleEditTags}>編集</Button>
                </Box>
              )}
            </Box>
            <Divider sx={{ my: 2, borderColor: '#00bcd4' }} />
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2" gutterBottom>要約</Typography>
                <DialogContentText
                  component="div"
                  sx={{
                    whiteSpace: 'pre-wrap',
                    maxHeight: '30vh',
                    overflowY: 'auto',
                    border: '1px solid #00bcd4',
                    borderRadius: 1,
                    p: 2,
                    mt: 1,
                  }}
                >
                  <ReactMarkdown>{selectedHistory.summary}</ReactMarkdown>
                </DialogContentText>
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2" gutterBottom>AI Assistant チャット履歴</Typography>
                <Box sx={{ maxHeight: '30vh', overflowY: 'auto', border: '1px solid #00bcd4', borderRadius: 1, p: 1 }}>
                  <ChatHistoryDisplay chatHistoryId={selectedHistory.chat_history_id} />
                </Box>
              </Box>
            </Box>

            <Divider sx={{ my: 2, borderColor: '#00bcd4' }} />

            <Typography variant="subtitle2" gutterBottom>コメント</Typography>
            <Box sx={{ maxHeight: '30vh', overflowY: 'auto', mb: 2, border: '1px solid #00bcd4', borderRadius: 1, p: 1 }}>
              {comments.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>コメントはありません。</Typography>
              ) : (
                <List dense>
                  {comments.map((comment) => (
                    <ListItem key={comment.id} sx={{ flexDirection: 'column', alignItems: 'flex-start', borderBottom: '1px solid #00bcd4', pb: 1, mb: 1 }}>
                      <Box sx={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="caption" color="text.secondary">
                          {comment.username} - {comment.created_at && !isNaN(new Date(comment.created_at + "Z").getTime())
                            ? new Intl.DateTimeFormat('ja-JP', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                              }).format(new Date(comment.created_at + "Z"))
                            : '日付不明'}
                        </Typography>
                      </Box>
                      <Typography variant="body2" sx={{ mt: 0.5 }}>{comment.content}</Typography>
                      <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {Object.entries(comment.reaction_counts || {}).map(([type, count]) => (
                          <Chip
                            key={type}
                            label={`${type} ${count}`}
                            size="small"
                            onClick={() => handleRemoveReaction(comment.id, type)}
                            sx={{ cursor: 'pointer' }}
                          />
                        ))}
                        <IconButton
                          aria-label="add reaction"
                          size="small"
                          onClick={handleClickReactionMenu}
                          sx={{ p: '4px' }}
                        >
                          <AddReactionIcon fontSize="small" />
                        </IconButton>
                        <Menu
                          anchorEl={anchorEl}
                          open={openReactionMenu}
                          onClose={handleCloseReactionMenu}
                          MenuListProps={{
                            'aria-labelledby': 'basic-button',
                            sx: {
                              display: 'flex',
                              flexWrap: 'wrap',
                              maxWidth: '200px',
                            }
                          }}
                        >
                          {['👍', '❤️', '😂', '🎉', '😊', '😢'].map((emoji) => (
                            <MenuItem
                              key={emoji}
                              onClick={() => {
                                handleAddReaction(comment.id, emoji);
                                handleCloseReactionMenu();
                              }}
                              sx={{ p: '4px 8px' }}
                            >
                              {emoji}
                            </MenuItem>
                          ))}
                        </Menu>
                      </Box>
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>

            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <TextField
                fullWidth
                variant="outlined"
                size="small"
                placeholder="コメントを追加..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddComment()}
              />
              <Button variant="contained" onClick={handleAddComment}>
                投稿
              </Button>
            </Box>
          </DialogContent>
          <DialogActions>
            {isEditingTags ? (
              <>
                <Button onClick={handleCancelEdit}>キャンセル</Button>
                <Button onClick={handleSaveTags} variant="contained">保存</Button>
              </>
            ) : (
              <>
                {selectedHistory && selectedHistory.username !== currentUsername && (
                  <Button onClick={() => {
                    onHistoryClick(selectedHistory);
                    handleClose(); // Close the modal after importing
                  }} variant="contained" color="primary">
                    メイン画面にインポート
                  </Button>
                )}
                <Button onClick={handleClose}>閉じる</Button>
              </>
            )}
          </DialogActions>
        </Dialog>
      )}
    <Snackbar open={snackbarOpen} autoHideDuration={6000} onClose={() => setSnackbarOpen(false)}>
        <Alert onClose={() => setSnackbarOpen(false)} severity={snackbarSeverity} sx={{ width: '100%'}}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Paper>
  );
};

export default SummaryHistory;