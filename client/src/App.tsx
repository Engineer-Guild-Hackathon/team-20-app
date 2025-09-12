import React, { useState, useEffect, useCallback } from 'react';
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
import AiAssistant, { Message } from './components/AiAssistant';
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
  tags?: string[]; // 追加
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
  const [pdfTags, setPdfTags] = useState<string[]>([]); // 追加
  const [summaryHistories, setSummaryHistories] = useState<HistoryItem[]>([]);
  const [initialContents, setInitialContents] = useState<HistoryContent[] | undefined>(undefined);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState<boolean>(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const openMenu = Boolean(anchorEl);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [username, setUsername] = useState<string | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error' | 'info' | 'warning'>('success');
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    setIsLoggedIn(!!token);
  }, []);

  useEffect(() => {
    const fetchUserInfo = async () => {
      const token = localStorage.getItem('access_token');
      if (!token) {
        setUsername(null);
        return;
      }
      try {
        const response = await fetch('http://localhost:8000/api/users/me', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setUsername(data.username);
        } else {
          console.error('Failed to fetch user info');
          setUsername(null);
        }
      } catch (error) {
        console.error('Error fetching user info:', error);
        setUsername(null);
      }
    };

    if (isLoggedIn) {
      fetchUserInfo();
    } else {
      setUsername(null); // ログアウト時はユーザー名をクリア
    }
  }, [isLoggedIn]);

  const fetchHistories = useCallback(async () => {
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
        } else {
          console.error('Failed to fetch summary histories');
          setSummaryHistories([]);
        }
      } catch (error) {
        console.error('Error fetching summary histories:', error);
        setSummaryHistories([]);
      }
    }
  }, [isLoggedIn, setSummaryHistories]);

  useEffect(() => {
    // fetchHistories(); // この行は削除またはコメントアウト
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

  const showSnackbar = useCallback((message: string, severity: 'success' | 'error' | 'info' | 'warning') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  }, [setSnackbarMessage, setSnackbarSeverity, setSnackbarOpen]);

  const handleCloseSnackbar = (event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') return;
    setSnackbarOpen(false);
  };

  const handleSummaryGenerated = (summary: string, filename: string, summaryId?: number, tags?: string[]) => {
    setPdfSummary(summary);
    setPdfFilename(filename);
    setPdfSummaryId(summaryId);
    setPdfTags(tags || []); // 追加
    setInitialContents(undefined);
    setChatMessages([]);
  };

  const handleHistoryClick = useCallback(async (item: HistoryItem) => {
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
  }, [showSnackbar, navigate, setPdfSummary, setPdfFilename, setPdfSummaryId, setInitialContents]);

  const handleMessagesChange = (messages: Message[]) => {
    setChatMessages(messages);
  };

  const handleSaveSummary = async (summary: string, filename: string, teamId: number | null, teamName: string | null, tags?: string[] | null, usernameFromProps?: string | null) => {
    if (!isLoggedIn) {
      showSnackbar('保存機能を利用するにはログインが必要です。', 'warning');
      setIsLoginModalOpen(true);
      return;
    }
    const token = localStorage.getItem('access_token');
    if (!token) return;

    let currentUsername = usernameFromProps; // PdfViewerから渡されたusernameを優先

    // usernameFromPropsがnullまたはundefinedの場合、Appのusernameステートを使用
    if (currentUsername === null || currentUsername === undefined) {
      currentUsername = username;
    }

    // まだusernameがnullの場合、APIから取得を試みる
    if (currentUsername === null) {
      try {
        const response = await fetch('http://localhost:8000/api/users/me', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          currentUsername = data.username;
          setUsername(data.username); // Appのステートも更新
        } else {
          console.error('Failed to fetch user info in handleSaveSummary');
        }
      } catch (error) {
        console.error('Error fetching user info in handleSaveSummary:', error);
      }
    }

    try {
      // 1. 要約を保存して、新しいIDを取得
      const summaryResponse = await fetch('http://localhost:8000/api/save-summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ filename, summary, team_id: teamId, tags: tags }),
      });

      if (!summaryResponse.ok) {
        const errorData = await summaryResponse.json();
        console.error("Error saving summary:", errorData);
        throw new Error(`要約の保存に失敗しました: ${errorData.detail || '不明なエラー'}`);
      }

      const summaryData = await summaryResponse.json();
      const newSummaryId = summaryData.id;
      setPdfSummaryId(newSummaryId);

      // 2. チャット履歴を保存
      if (chatMessages.length > 0) {
        const chatResponse = await fetch('http://localhost:8000/api/history-contents', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            summary_history_id: newSummaryId,
            section_type: 'ai_chat',
            content: JSON.stringify(chatMessages),
          }),
        });

        if (!chatResponse.ok) {
          const errorData = await chatResponse.json();
          throw new Error(`チャット履歴の保存に失敗しました: ${errorData.detail || '不明なエラー'}`);
        }
      }

      showSnackbar('要約とチャット履歴を保存しました！', 'success');
      
      // 履歴リストを更新
      const newHistoryItem: HistoryItem = { 
        id: newSummaryId, 
        filename, 
        summary, 
        created_at: new Date().toISOString(), 
        tags: tags || [],
        team_id: teamId || undefined,
        team_name: teamName || undefined,
        username: currentUsername || undefined // ここを修正
      };
      setSummaryHistories(prev => [newHistoryItem, ...prev]);

    } catch (error) {
        console.error('Error saving history:', error);
        showSnackbar(error instanceof Error ? error.message : '保存中にエラーが発生しました。', 'error');
    }
  };

  const handleUpdateHistoryItem = useCallback((updatedItem: HistoryItem) => {
    setSummaryHistories(prevHistories => 
      prevHistories.map(item => 
        item.id === updatedItem.id ? updatedItem : item
      )
    );
  }, [setSummaryHistories]);

  return (
    <>
      <Box sx={{ flexGrow: 1 }}>
        <AppBar position="static" sx={{ py: 1 }}>
          <Container maxWidth="xl">
            <Toolbar sx={{ justifyContent: 'space-between', minHeight: 48 }}>
              <Typography variant="h5" component="div" sx={{ fontWeight: 'bold' }}>
                <Link to="/" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center' }}>
                  {location.pathname !== '/' && <HomeIcon sx={{ mr: 1 }} />}
                  <img src="./product_logo.svg" alt="Product Logo" style={{ height: '60px', marginLeft: '8px', filter: 'drop-shadow(0 0 2px white)' }} /> {/* 追加 */}
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
                  <PdfViewer summary={pdfSummary} filename={pdfFilename} onSave={handleSaveSummary} summaryId={pdfSummaryId} tags={pdfTags} username={username} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <AiAssistant 
                    pdfSummaryContent={pdfSummary} 
                    initialContents={initialContents} 
                    onMessagesChange={handleMessagesChange} 
                  />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Workspace />
                </Box>
              </Box>
            </Container>
          } />
          <Route path="/mypage" element={<MyPage histories={summaryHistories} onHistoryClick={handleHistoryClick} onUpdateHistory={handleUpdateHistoryItem} fetchHistories={fetchHistories} />} />
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