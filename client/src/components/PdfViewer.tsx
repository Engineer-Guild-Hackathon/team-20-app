import React, { useState, useEffect, useRef } from 'react';
import { Paper, Typography, Box, Divider, Chip, Button, MenuItem, TextField, List, ListItem, CircularProgress, Menu, IconButton, Snackbar, Alert } from '@mui/material';
import { PictureAsPdf, AutoAwesome, Comment as CommentIcon, AddReaction as AddReactionIcon } from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';



interface PdfViewerProps {
  summary?: string;
  filename?: string;
  summaryId?: number; // 追加
  tags?: string[] | null; // 追加
  username?: string | null;
  isLoggedIn: boolean; // New
  onSave: (summary: string, filename: string, teamId: number | null, teamName: string | null, tags?: string[] | null, username?: string | null) => Promise<number | undefined>; // 戻り値をPromise<number | undefined>に変更
  onCommentAttemptWithoutSave: (commentContent: string) => Promise<void>; // New
}

interface Comment {
  id: number;
  user_id: number;
  username: string;
  content: string;
  created_at: string;
  reactions: {
    id: number;
    user_id: number;
    username: string;
    reaction_type: string;
    created_at: string;
  }[];
  reaction_counts: { [key: string]: number };
}

const PdfViewer: React.FC<PdfViewerProps> = ({ summary, filename, summaryId, tags, onSave, username, isLoggedIn, onCommentAttemptWithoutSave }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newCommentContent, setNewCommentContent] = useState<string>('');
  const [loadingComments, setLoadingComments] = useState<boolean>(false);
  const commentsEndRef = useRef<HTMLUListElement>(null); // New ref
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const openReactionMenu = Boolean(anchorEl);
  const [currentCommentIdForReaction, setCurrentCommentIdForReaction] = useState<number | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error' | 'warning' | 'info'>('info');

  const fetchComments = async (id: number) => {
    setLoadingComments(true);
    const token = localStorage.getItem('access_token');
    if (!token) {
      setLoadingComments(false);
      return;
    }

    try {
      const response = await fetch(`http://localhost:8000/api/summaries/${id}/comments`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data: Comment[] = await response.json();
        setComments(data);
      } else {
        console.error('Failed to fetch comments');
        setComments([]);
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
      setComments([]);
    } finally {
      setLoadingComments(false);
    }
  };

  useEffect(() => {
    if (summaryId && isLoggedIn) {
      fetchComments(summaryId);
    } else {
      setComments([]); // 要約IDがない場合やログアウト時はコメントをクリア
    }
  }, [summaryId, isLoggedIn]);

  useEffect(() => {
    if (commentsEndRef.current) {
      commentsEndRef.current.scrollTop = commentsEndRef.current.scrollHeight;
    }
  }, [comments]); // Scroll to bottom when comments change

  const handleAddComment = async () => {
    if (!newCommentContent.trim()) {
      return; // コメントが空の場合は何もしない
    }

    const token = localStorage.getItem('access_token');
    if (!token) {
      return; // ログインしていない場合は何もしない
    }

    if (!summaryId) {
      // summaryIdがない場合、親コンポーネントにコメント内容を渡して保存を試みてもらう
      await onCommentAttemptWithoutSave(newCommentContent);
      setNewCommentContent(''); // 入力フィールドをクリア
      // コメントリストの更新は親コンポーネントがsummaryIdを更新した後にuseEffectで自動的に行われることを期待
      return;
    }

    // summaryIdがある場合は既存のロジックでコメントを保存
    try {
      const response = await fetch('http://localhost:8000/api/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ summary_id: summaryId, content: newCommentContent }),
      });

      if (response.ok) {
        setNewCommentContent(''); // 入力フィールドをクリア
        fetchComments(summaryId); // コメントリストを更新
      } else {
        console.error('Failed to add comment');
      }
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const handleClickReactionMenu = (event: React.MouseEvent<HTMLButtonElement>, commentId: number) => {
    setAnchorEl(event.currentTarget);
    setCurrentCommentIdForReaction(commentId);
  };

  const handleCloseReactionMenu = () => {
    setAnchorEl(null);
    setCurrentCommentIdForReaction(null);
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
        if (summaryId) {
          fetchComments(summaryId); // コメントリストを再フェッチしてリアクションを更新
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
        if (summaryId) {
          fetchComments(summaryId); // コメントリストを再フェッチしてリアクションを更新
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

  return (
    <Paper 
      sx={{ 
        height: '100%', 
        flexGrow: 1,
        p: 2,
        border: '1px solid #00bcd4',
        borderRadius: 2,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 0 15px rgba(0, 188, 212, 0.7)',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <PictureAsPdf color="error" />
        <Typography variant="h6" component="h2">
          PDF Viewer
        </Typography>
      </Box>
      
      {filename && (
        <Box sx={{ mb: 2 }}>
          <Chip 
            label={filename} 
            variant="outlined" 
            color="primary" 
            size="small"
            sx={{ maxWidth: '100%' }}
          />
        </Box>
      )}
      
      <Divider sx={{ mb: 2, borderColor: '#00bcd4' }} />
      
      {summary ? (
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <AutoAwesome color="secondary" fontSize="small" />
            <Typography variant="subtitle1" fontWeight="bold" color="secondary">
              AI要約
            </Typography>
          </Box>
          
          <ReactMarkdown>
            {summary}
          </ReactMarkdown>
        </Box>
      ) : (
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'text.secondary'
          }}
        >
          <Typography variant="body1" textAlign="center">
            PDFファイルをアップロードして<br />
            AI要約を表示してください
          </Typography>
        </Box>
      )}

      {/* コメントセクション */}
      {summary && ( // Only show comment section if summary exists
        <Box sx={{ mt: 4, p: 2, border: '1px solid #00bcd4', borderRadius: '8px', display: 'flex', flexDirection: 'column', maxHeight: "50%", marginTop: 'auto' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flex: '0 0 auto' }}>
            <CommentIcon color="action" fontSize="small" />
            <Typography variant="h6" component="h3">
              コメント
            </Typography>
          </Box>
          <Divider sx={{ mb: 2, borderColor: '#00bcd4', flex: '0 0 auto' }} />
          {!isLoggedIn ? (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 2, flex: '0 0 auto' }}>
              コメント機能を利用するにはログインが必要です。
            </Typography>
          ) : loadingComments ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', flex: '0 0 auto' }}>
              <CircularProgress size={20} />
            </Box>
          ) : comments.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ flex: '0 0 auto' }}>まだコメントはありません。</Typography>
          ) : (
            <List dense component="ul" sx={{ flex: 1, overflowY: 'auto', maxHeight: '300px', flexDirection: 'column-reverse', justifyContent: 'flex-end' }} ref={commentsEndRef}>
              {comments.map((comment) => (
                <ListItem key={comment.id} sx={{ flexDirection: 'column', alignItems: 'flex-start', borderBottom: '1px solid #eee', pb: 1, mb: 1 }}>
                  <Box sx={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="caption" color="text.secondary">
                      {comment.username} - {new Intl.DateTimeFormat('ja-JP', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      }).format(new Date(comment.created_at + "Z"))}
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
                      onClick={(event) => handleClickReactionMenu(event, comment.id)}
                      sx={{ p: '4px' }}
                    >
                      <AddReactionIcon fontSize="small" />
                    </IconButton>
                    <Menu
                      anchorEl={anchorEl}
                      open={openReactionMenu && currentCommentIdForReaction === comment.id}
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
          <Box sx={{ mt: 2, display: 'flex', gap: 1, flex: '0 0 auto' }}>
            <TextField
              fullWidth
              variant="outlined"
              size="small"
              label="コメントを追加"
              value={newCommentContent}
              onChange={(e) => setNewCommentContent(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleAddComment();
                }
              }}
              disabled={!isLoggedIn} // Disable if not logged in
            />
            <Button
              variant="contained"
              onClick={handleAddComment}
              disabled={!isLoggedIn} // Disable if not logged in
            >
              送信
            </Button>
          </Box>
        </Box>
      )} {/* Closing the conditional rendering for summary */} 
    <Snackbar open={snackbarOpen} autoHideDuration={6000} onClose={() => setSnackbarOpen(false)}>
        <Alert onClose={() => setSnackbarOpen(false)} severity={snackbarSeverity} sx={{ width: '100%'}}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Paper>
  );
};

export default PdfViewer;