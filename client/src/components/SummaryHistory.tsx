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
}

interface SummaryHistoryProps {
  histories: HistoryItem[];
  onHistoryClick: (item: HistoryItem) => void;
}

const SummaryHistory: React.FC<SummaryHistoryProps> = ({ histories, onHistoryClick }) => {
  const [filter, setFilter] = useState('all');
  const [open, setOpen] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<HistoryItem | null>(null);

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
            <DialogContentText component="div" sx={{ whiteSpace: 'pre-wrap', mt: 2, maxHeight: '60vh', overflowY: 'auto' }}>
              {selectedHistory.summary}
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose}>閉じる</Button>
            <Button
              onClick={() => {
                onHistoryClick(selectedHistory);
                handleClose();
              }}
              variant="contained"
            >
              表示
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Paper>
  );
};

export default SummaryHistory;