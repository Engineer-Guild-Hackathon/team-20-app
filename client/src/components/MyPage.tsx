import React from 'react';
import { Container, Typography, Box } from '@mui/material';
import SummaryHistory from './SummaryHistory'; // インポート

// App.tsxから渡される型
interface HistoryItem {
  id?: number;
  filename: string;
  summary: string;
  created_at?: string;
}

interface MyPageProps {
  histories: HistoryItem[];
  onHistoryClick: (item: HistoryItem) => void; // 追加
}

const MyPage: React.FC<MyPageProps> = ({ histories, onHistoryClick }) => { // onHistoryClickを追加

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        マイページ
      </Typography>
      <Typography variant="h6" component="h2" sx={{ mt: 4, mb: 2 }}>
        要約履歴
      </Typography>
      <Box sx={{ height: 'calc(100vh - 280px)' }}>
        <SummaryHistory histories={histories} onHistoryClick={onHistoryClick} /> {/* onHistoryClickをそのまま渡す */}
      </Box>
    </Container>
  );
};

export default MyPage;