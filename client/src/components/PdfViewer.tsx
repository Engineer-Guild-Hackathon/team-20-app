import React, { useState, useEffect } from 'react';
import { Paper, Typography, Box, Divider, Chip, Button, FormControl, InputLabel, Select, MenuItem, TextField, List, ListItem, CircularProgress, Menu, IconButton, Snackbar, Alert } from '@mui/material';
import { PictureAsPdf, AutoAwesome, Save as SaveIcon, Comment as CommentIcon, AddReaction as AddReactionIcon } from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';



interface PdfViewerProps {
  summary?: string;
  filename?: string;
  summaryId?: number; // 追加
  tags?: string[] | null; // 追加
  username?: string | null;
  onSave: (summary: string, filename: string, teamId: number | null, teamName: string | null, tags?: string[] | null, username?: string | null) => Promise<void>; // 戻り値をPromise<void>に変更
}

interface Team {
  id: number;
  name: string;
  role: string;
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

const PdfViewer: React.FC<PdfViewerProps> = ({ summary, filename, summaryId, tags, onSave, username }) => {
  const [myTeams, setMyTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<number | '' | '個人用'>('');
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newCommentContent, setNewCommentContent] = useState<string>('');
  const [loadingComments, setLoadingComments] = useState<boolean>(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const openReactionMenu = Boolean(anchorEl);
  const [currentCommentIdForReaction, setCurrentCommentIdForReaction] = useState<number | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error' | 'warning' | 'info'>('info');

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    setIsLoggedIn(!!token);

    const fetchMyTeams = async () => {
      if (!token) return;

      try {
        const response = await fetch('https://team-20-app-client-7kr4.vercel.app/users/me/teams', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data: Team[] = await response.json();
          setMyTeams(data);
        } else {
          console.error('Failed to fetch teams for PdfViewer');
        }
      } catch (error) {
        console.error('Error fetching teams for PdfViewer:', error);
      }
    };

    if (token) {
      fetchMyTeams();
    }
  }, [isLoggedIn]);

  const fetchComments = async (id: number) => {
    setLoadingComments(true);
    const token = localStorage.getItem('access_token');
    if (!token) {
      setLoadingComments(false);
      return;
    }

    try {
      const response = await fetch(`https://team-20-app-client-7kr4.vercel.app/summaries/${id}/comments`, {
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

  const handleSaveClick = () => {
    let teamName: string | null = null;
    if (selectedTeamId !== '' && selectedTeamId !== '個人用') { // '個人用'はチームではないので除外
      const selectedTeam = myTeams.find(team => team.id === Number(selectedTeamId));
      if (selectedTeam) {
        teamName = selectedTeam.name;
      }
    }
    onSave(summary || '', filename || '', selectedTeamId === '' ? null : Number(selectedTeamId), teamName, tags, username);
  };

  const handleAddComment = async () => {
    if (!summaryId || !newCommentContent.trim()) {
      return; // 要約IDがないか、コメントが空の場合は何もしない
    }

    const token = localStorage.getItem('access_token');
    if (!token) {
      return; // ログインしていない場合は何もしない
    }

    try {
      const response = await fetch('https://team-20-app-client-7kr4.vercel.app/comments', {
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
      const response = await fetch(`https://team-20-app-client-7kr4.vercel.app/comments/${commentId}/reactions`, {
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
      const response = await fetch(`https://team-20-app-client-7kr4.vercel.app/comments/${commentId}/reactions`, {
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
        p: 2,
        border: '1px solid #e0e0e0',
        borderRadius: 2,
        display: 'flex',
        flexDirection: 'column'
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
      
      <Divider sx={{ mb: 2 }} />
      
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
          {summary && ( // 要約がある場合のみボタンを表示
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
              {isLoggedIn && myTeams.length > 0 && (
                <FormControl variant="outlined" size="small" sx={{ minWidth: 140, mr: 1 }}>
                  <InputLabel id="team-select-label">チームに保存</InputLabel>
                  <Select
                    labelId="team-select-label"
                    value={selectedTeamId}
                    onChange={(e) => setSelectedTeamId(e.target.value as number | '')}
                    label="チームに保存"
                  >
                    <MenuItem value="個人用">個人用</MenuItem>
                    {myTeams.map((team) => (
                      <MenuItem key={team.id} value={team.id}>
                        {team.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
              <Button
                variant="contained"
                color="primary"
                onClick={handleSaveClick}
                startIcon={<SaveIcon />}
              >
                この要約を保存
              </Button>
            </Box>
          )}

          {/* コメントセクション */}
          {summaryId && isLoggedIn && (
            <Box sx={{ mt: 4, p: 2, border: '1px solid #eee', borderRadius: '8px' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <CommentIcon color="action" fontSize="small" />
                <Typography variant="h6" component="h3">
                  コメント
                </Typography>
              </Box>
              <Divider sx={{ mb: 2 }} />
              {loadingComments ? (
                <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                  <CircularProgress size={20} />
                </Box>
              ) : comments.length === 0 ? (
                <Typography variant="body2" color="text.secondary">まだコメントはありません。</Typography>
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
              <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
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
                />
                <Button variant="contained" onClick={handleAddComment}>
                  送信
                </Button>
              </Box>
            </Box>
          )}
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
    <Snackbar open={snackbarOpen} autoHideDuration={6000} onClose={() => setSnackbarOpen(false)}>
        <Alert onClose={() => setSnackbarOpen(false)} severity={snackbarSeverity} sx={{ width: '100%'}}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Paper>
  );
};

export default PdfViewer;