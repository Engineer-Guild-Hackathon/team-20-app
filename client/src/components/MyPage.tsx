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
}

const MyPage: React.FC<MyPageProps> = ({ histories }) => {
  // 履歴項目クリック時のダミー関数
  const handleHistoryClick = (item: HistoryItem) => {
    // 現状ではマイページでクリックしても何もしない
    // 将来的に詳細表示などに使える
    console.log('History item clicked:', item);
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        マイページ
      </Typography>
      <Typography variant="h6" component="h2" sx={{ mt: 4, mb: 2 }}>
        要約履歴
      </Typography>
      <Box sx={{ height: 'calc(100vh - 250px)' }}>
        <SummaryHistory histories={histories} onHistoryClick={handleHistoryClick} />
      </Box>
    </Container>
  );
};

export default MyPage;