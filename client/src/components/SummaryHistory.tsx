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
}

interface SummaryHistoryProps {
  histories: HistoryItem[];
  onHistoryClick: (item: HistoryItem) => void;
  onUpdateHistory: (updatedItem: HistoryItem) => void;
}

const SummaryHistory: React.FC<SummaryHistoryProps> = ({ histories, onHistoryClick, onUpdateHistory }) => {
  const [filter, setFilter] = useState('all');
  const [open, setOpen] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<HistoryItem | null>(null);
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [editingTags, setEditingTags] = useState('');
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
      const response = await fetch(`/api/summaries/${summaryId}/comments`, {
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
    setSelectedHistory(item);
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setSelectedHistory(null);
    setIsEditingTags(false); // ダイアログを閉じるときに編集モードをリセット
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
      const response = await fetch(`/api/summaries/${selectedHistory.id}/tags`, {
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

  const handleAddComment = async () => {
    if (!selectedHistory || !selectedHistory.id || !newComment.trim()) return;

    const token = localStorage.getItem('access_token');
    if (!token) {
      console.error('Not logged in');
      return;
    }

    try {
      const response = await fetch('/api/comments', {
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
      const response = await fetch(`/api/comments/${commentId}/reactions`, {
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
      const response = await fetch(`/api/comments/${commentId}/reactions`, {
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
        border: '1px solid #e0e0e0',
        borderRadius: 2,
        display: 'flex',
        flexDirection: 'column',
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
      </Box>
      <Divider sx={{ mb: 1 }} />
      <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
        {displayedHistories.length === 0 ? (
          <Typography sx={{ textAlign: 'center', color: 'text.secondary', mt: 4 }}>
            履歴はありません
          </Typography>
        ) : (
          <List disablePadding>
            {displayedHistories.map((item, index) => (
              <ListItem key={item.id || index} disablePadding>
                <ListItemButton onClick={() => handleHistoryItemClick(item)}>
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
                            color="info"
                            sx={{ ml: 1 }}
                          />
                        )}
                      </Box>
                    }
                    secondary={
                      <>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.5 }}>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, flexGrow: 1 }}>
                            {item.tags?.map((tag, index) => (
                              <Chip key={index} label={tag} size="small" />
                            ))}
                          </Box>
                          <Typography
                            component="span"
                            variant="caption"
                            color="text.secondary"
                            sx={{ flexShrink: 0, ml: 1 }}
                          >
                            {new Date(item.created_at || Date.now()).toLocaleString('ja-JP')}
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
        )}
      </Box>
      {selectedHistory && (
        <Dialog open={open} onClose={handleClose} fullWidth maxWidth="md">
          <DialogTitle>{selectedHistory.filename}</DialogTitle>
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
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" gutterBottom>要約</Typography>
            <DialogContentText
              component="div"
              sx={{
                whiteSpace: 'pre-wrap',
                maxHeight: '30vh', // 変更
                overflowY: 'auto',
                border: '1px solid #e0e0e0', // 枠線
                borderRadius: 1, // 角丸
                p: 2, // パディング
                mt: 1, // 上マージン (必要であれば)
              }}
            >
              <ReactMarkdown>{selectedHistory.summary}</ReactMarkdown>
            </DialogContentText>

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" gutterBottom>コメント</Typography>
            <Box sx={{ maxHeight: '30vh', overflowY: 'auto', mb: 2, border: '1px solid #e0e0e0', borderRadius: 1, p: 1 }}>
              {comments.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>コメントはありません。</Typography>
              ) : (
                <List dense>
                  {comments.map((comment) => (
                    <ListItem key={comment.id} sx={{ flexDirection: 'column', alignItems: 'flex-start', borderBottom: '1px solid #eee', pb: 1, mb: 1 }}>
                      <Box sx={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="caption" color="text.secondary">
                          {comment.username} - {new Date(comment.created_at).toLocaleString('ja-JP')}
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
                              maxWidth: '200px', // 適宜調整
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
                              sx={{ p: '4px 8px' }} // MenuItemのパディングを調整
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
                <Button onClick={handleClose}>閉じる</Button>
                <Button
                  onClick={() => {
                    if (selectedHistory) {
                      onHistoryClick(selectedHistory);
                    }
                    handleClose();
                  }}
                  variant="contained"
                >
                  表示
                </Button>
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