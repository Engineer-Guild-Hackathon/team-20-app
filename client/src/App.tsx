import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Typography, 
  Container, 
  Box, 
  AppBar, 
  Toolbar,
  IconButton,
  Menu,
  MenuItem,
  Snackbar,
  Alert
} from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import PdfViewer from './components/PdfViewer';
import AiAssistant from './components/AiAssistant';
import Workspace from './components/Workspace';
import FileUploadButton from './components/FileUploadButton';
import LoginModal from './components/LoginModal';
import RegisterModal from './components/RegisterModal';
import MyPage from './components/MyPage';
import TeamManagement from './components/TeamManagement';

// 型定義
interface HistoryItem {
  id?: number;
  filename: string;
  summary: string;
  created_at?: string;
  team_id?: number;
  username?: string;
  team_name?: string;
}

interface HistoryContent {
  id: number;
  summary_history_id: number;
  section_type: string;
  content: string;
  created_at: string;
  updated_at: string;
}

function App() {
  const location = useLocation();
  const [pdfSummary, setPdfSummary] = useState<string>('');
  const [pdfFilename, setPdfFilename] = useState<string>('');
  const [pdfSummaryId, setPdfSummaryId] = useState<number | undefined>(undefined);
  const [summaryHistories, setSummaryHistories] = useState<HistoryItem[]>([]);
  const [initialContents, setInitialContents] = useState<HistoryContent[] | undefined>(undefined);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState<boolean>(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const openMenu = Boolean(anchorEl);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error' | 'info' | 'warning'>('success');
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    setIsLoggedIn(!!token);
  }, []);

  useEffect(() => {
    const fetchHistories = async () => {
      if (isLoggedIn) {
        const token = localStorage.getItem('access_token');
        if (!token) return;
        try {
          const response = await fetch('http://localhost:8000/api/summaries', {
            headers: { 'Authorization': `Bearer ${token}` },
          });
          if (response.ok) {
            const data: HistoryItem[] = await response.json();
            setSummaryHistories(data);
            localStorage.removeItem('summary_histories');
          } else {
            console.error('Failed to fetch summary histories');
            setSummaryHistories([]);
          }
        } catch (error) {
          console.error('Error fetching summary histories:', error);
          setSummaryHistories([]);
        }
      } else {
        const localHistories = localStorage.getItem('summary_histories');
        setSummaryHistories(localHistories ? JSON.parse(localHistories) : []);
      }
    };
    fetchHistories();
  }, [isLoggedIn]);

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
  const handleCloseMenu = () => setAnchorEl(null);

  const handleCloseLoginModal = () => {
    setIsLoginModalOpen(false);
    setIsLoggedIn(!!localStorage.getItem('access_token'));
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    setIsLoggedIn(false);
    handleCloseMenu();
    showSnackbar('ログアウトしました。', 'info');
  };

  const showSnackbar = (message: string, severity: 'success' | 'error' | 'info' | 'warning') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  const handleCloseSnackbar = (event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') return;
    setSnackbarOpen(false);
  };

  const handleSummaryGenerated = (summary: string, filename: string, summaryId?: number) => {
    setPdfSummary(summary);
    setPdfFilename(filename);
    setPdfSummaryId(summaryId);
    setInitialContents(undefined); // 新しい要約なので、関連コンテンツはクリア
  };

  const handleHistoryClick = async (item: HistoryItem) => {
    if (!item.id) return;
    const token = localStorage.getItem('access_token');
    if (!token) {
      showSnackbar('詳細の読み込みにはログインが必要です。', 'warning');
      return;
    }
    try {
      const response = await fetch(`http://localhost:8000/api/summaries/${item.id}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('履歴詳細の読み込みに失敗しました。');
      const data = await response.json();
      setPdfSummary(data.summary);
      setPdfFilename(data.filename);
      setPdfSummaryId(data.id);
      setInitialContents(data.contents);
      navigate('/');
    } catch (error) {
      console.error(error);
      showSnackbar(error instanceof Error ? error.message : '不明なエラーです。', 'error');
    }
  };

  const handleSaveSummary = async (summary: string, filename: string, teamId: number | null) => {
    if (!isLoggedIn) {
        const newHistoryItem: HistoryItem = { filename, summary, created_at: new Date().toISOString() };
        const updatedLocalHistories = [newHistoryItem, ...summaryHistories];
        localStorage.setItem('summary_histories', JSON.stringify(updatedLocalHistories));
        setSummaryHistories(updatedLocalHistories);
        showSnackbar('要約をブラウザに保存しました！', 'success');
        return;
    }
    const token = localStorage.getItem('access_token');
    try {
        const response = await fetch('http://localhost:8000/api/save-summary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ filename, summary, team_id: teamId }),
        });
        if (response.ok) {
            const data = await response.json();
            showSnackbar('要約を保存しました！', 'success');
            const newHistoryItem: HistoryItem = { id: data.id, filename, summary, created_at: new Date().toISOString() };
            setSummaryHistories(prev => [newHistoryItem, ...prev]);
            setPdfSummaryId(data.id);
        } else {
            const errorData = await response.json();
            showSnackbar(`保存に失敗しました: ${errorData.detail || '不明なエラー'}`, 'error');
        }
    } catch (error) {
        console.error('Error saving summary:', error);
        showSnackbar('ネットワークエラーが発生しました。', 'error');
    }
  };

  return (
    <>
      <Box sx={{ flexGrow: 1 }}>
        <AppBar position="static" sx={{ backgroundColor: '#1976d2', py: 1 }}>
          <Container maxWidth="xl">
            <Toolbar sx={{ justifyContent: 'space-between', minHeight: 48 }}>
              <Typography variant="h5" component="div" sx={{ fontWeight: 'bold' }}>
                <Link to="/" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center' }}>
                  {location.pathname !== '/' && <HomeIcon sx={{ mr: 1 }} />}
                  CogniStudy
                </Link>
              </Typography>
              {location.pathname === '/' && <FileUploadButton onSummaryGenerated={handleSummaryGenerated} />}
              <IconButton color="inherit" aria-label="account" onClick={handleMenu}>
                <AccountCircleIcon fontSize="large" />
              </IconButton>
              <Menu id="menu-appbar" anchorEl={anchorEl} open={openMenu} onClose={handleCloseMenu}>
                {isLoggedIn ? (
                  [
                    <MenuItem key="mypage" component={Link} to="/mypage" onClick={handleCloseMenu}>マイページ</MenuItem>,
                    <MenuItem key="team-management" component={Link} to="/teams" onClick={handleCloseMenu}>チーム管理</MenuItem>,
                    <MenuItem key="logout" onClick={handleLogout}>ログアウト</MenuItem>
                  ]
                ) : (
                  <>
                    <MenuItem onClick={() => { handleCloseMenu(); setIsLoginModalOpen(true); }}>ログイン</MenuItem>
                    <MenuItem onClick={() => { handleCloseMenu(); setIsRegisterModalOpen(true); }}>新規登録</MenuItem>
                  </>
                )}
              </Menu>
            </Toolbar>
          </Container>
        </AppBar>

        <Routes>
          <Route path="/" element={
            <Container maxWidth="xl" sx={{ mt: 3, px: 2 }}>
              <Box sx={{ display: 'flex', gap: 2, height: 'calc(100vh - 150px)' }}>
                <Box sx={{ flex: 1 }}>
                  <PdfViewer summary={pdfSummary} filename={pdfFilename} onSave={handleSaveSummary} summaryId={pdfSummaryId} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <AiAssistant pdfSummaryContent={pdfSummary} summaryId={pdfSummaryId} initialContents={initialContents} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Workspace />
                </Box>
              </Box>
            </Container>
          } />
          <Route path="/mypage" element={<MyPage histories={summaryHistories} onHistoryClick={handleHistoryClick} />} />
          <Route path="/teams" element={<TeamManagement showSnackbar={showSnackbar} />} />
        </Routes>
      </Box>
      <LoginModal open={isLoginModalOpen} onClose={handleCloseLoginModal} showSnackbar={showSnackbar} />
      <RegisterModal open={isRegisterModalOpen} onClose={() => setIsRegisterModalOpen(false)} />
      <Snackbar open={snackbarOpen} autoHideDuration={6000} onClose={handleCloseSnackbar}>
        <Alert onClose={handleCloseSnackbar} severity={snackbarSeverity} sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </>
  );
}

export default App;
