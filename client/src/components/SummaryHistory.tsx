import React, { useState } from 'react';
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
} from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';

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
                    secondary={new Date(item.created_at || Date.now()).toLocaleString('ja-JP')}
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
            <DialogContentText component="div" sx={{ whiteSpace: 'pre-wrap', maxHeight: '50vh', overflowY: 'auto' }}>
              {selectedHistory.summary}
            </DialogContentText>
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
    </Paper>
  );
};

export default SummaryHistory;