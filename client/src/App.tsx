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
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import PdfViewer from './components/PdfViewer';
import AiAssistant from './components/AiAssistant';
import Workspace from './components/Workspace';
import FileUploadButton from './components/FileUploadButton';
import LoginModal from './components/LoginModal';
import RegisterModal from './components/RegisterModal';
import MyPage from './components/MyPage';

// 履歴項目の型定義
interface HistoryItem {
  id?: number; // DBからの履歴にはidがある
  filename: string;
  summary: string;
  created_at?: string; // DBからの履歴にはcreated_atがある
}

function App() {
  const location = useLocation();
  const [pdfSummary, setPdfSummary] = useState<string>('');
  const [pdfFilename, setPdfFilename] = useState<string>('');
  const [summaryHistories, setSummaryHistories] = useState<HistoryItem[]>([]); // 履歴用のstate
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState<boolean>(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const openMenu = Boolean(anchorEl);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error' | 'info' | 'warning'>('success');

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    setIsLoggedIn(!!token);
  }, []);

  // ログイン状態に応じて履歴を読み込む
  useEffect(() => {
    const fetchHistories = async () => {
      if (isLoggedIn) {
        // ログインしている場合：APIから取得
        const token = localStorage.getItem('access_token');
        if (!token) return;

        try {
          const response = await fetch('http://localhost:8000/api/summaries', {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          if (response.ok) {
            const data: HistoryItem[] = await response.json();
            setSummaryHistories(data);
            // ローカルの履歴はクリアする
            localStorage.removeItem('summary_histories');
          } else {
            console.error('Failed to fetch summary histories');
            setSummaryHistories([]); // エラー時は空にする
          }
        } catch (error) {
          console.error('Error fetching summary histories:', error);
          setSummaryHistories([]);
        }
      } else {
        // ログインしていない場合：ローカルストレージから取得
        const localHistories = localStorage.getItem('summary_histories');
        if (localHistories) {
          setSummaryHistories(JSON.parse(localHistories));
        } else {
          setSummaryHistories([]);
        }
      }
    };

    fetchHistories();
  }, [isLoggedIn]);

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
  };

  const handleCloseLoginModal = () => {
    setIsLoginModalOpen(false);
    const token = localStorage.getItem('access_token');
    setIsLoggedIn(!!token);
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    setIsLoggedIn(false);
    handleCloseMenu();
    showSnackbar('ログアウトしました。', 'info');
  };

  const showSnackbar = (message: string, severity: 'success' | 'error' | 'info' | 'warning' ) => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  const handleCloseSnackbar = (event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbarOpen(false);
  };

  const navigate = useNavigate(); // 追加

  const handleSummaryGenerated = (summary: string, filename: string) => {
    setPdfSummary(summary);
    setPdfFilename(filename);
  };

  const handleHistoryClick = (item: HistoryItem) => {
    setPdfSummary(item.summary);
    setPdfFilename(item.filename);
    navigate('/'); // メインページに遷移
  };

  // 後から保存する関数
  const handleSaveSummary = async (summary: string, filename: string) => {
    if (isLoggedIn) {
      // ログインしている場合：API経由でDBに保存
      const token = localStorage.getItem('access_token');
      if (!token) {
        showSnackbar('ログインしていません。', 'warning');
        return;
      }

      try {
        const response = await fetch('http://localhost:8000/api/save-summary', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ filename, summary }),
        });

        if (response.ok) {
          showSnackbar('要約を保存しました！', 'success');
          // 保存成功後、履歴を再取得して最新の状態にする
          // これはuseEffectがisLoggedInを監視しているので、isLoggedInを一時的にfalseにしてtrueに戻すか、
          // 直接fetchHistoriesを呼び出すか、あるいは楽観的更新を行う
          // ここではシンプルに楽観的更新を行う
          const newHistoryItem: HistoryItem = {
            filename,
            summary,
            created_at: new Date().toISOString(),
          };
          setSummaryHistories(prev => [newHistoryItem, ...prev]);

        } else {
          const errorData = await response.json();
          showSnackbar(`保存に失敗しました: ${errorData.detail || '不明なエラー'}`, 'error');
        }
      } catch (error) {
        console.error('Error saving summary:', error);
        showSnackbar('ネットワークエラーが発生しました。', 'error');
      }
    } else {
      // ログインしていない場合：ローカルストレージに保存
      const newHistoryItem: HistoryItem = {
        filename,
        summary,
        created_at: new Date().toISOString(),
      };
      const currentLocalHistories = JSON.parse(localStorage.getItem('summary_histories') || '[]');
      const updatedLocalHistories = [newHistoryItem, ...currentLocalHistories];
      localStorage.setItem('summary_histories', JSON.stringify(updatedLocalHistories));
      setSummaryHistories(updatedLocalHistories);
      showSnackbar('要約をブラウザに保存しました！', 'success');
    }
  };

  return (
        <>
          <Box sx={{ flexGrow: 1 }}>
            {/* 上部のヘッダーセクション */}
            <AppBar position="static" sx={{ backgroundColor: '#1976d2', py: 1 }}>
              <Container maxWidth="xl">
                <Toolbar sx={{ justifyContent: 'space-between', minHeight: 48 }}>
                  <Typography variant="h5" component="div" sx={{ fontWeight: 'bold' }}>
                    <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
                      CogniStudy
                    </Link>
                  </Typography>
                  {location.pathname === '/' && <FileUploadButton onSummaryGenerated={handleSummaryGenerated} />}
                  <IconButton color="inherit" aria-label="account" onClick={handleMenu}>
                    <AccountCircleIcon fontSize="large" />
                  </IconButton>
                  <Menu
                    id="menu-appbar"
                    anchorEl={anchorEl}
                    anchorOrigin={{
                      vertical: 'top',
                      horizontal: 'right',
                    }}
                    keepMounted
                    transformOrigin={{
                      vertical: 'top',
                      horizontal: 'right',
                    }}
                    open={openMenu}
                    onClose={handleCloseMenu}
                  >
                    {isLoggedIn ? (
                      [
                        <MenuItem key="mypage" component={Link} to="/mypage" onClick={handleCloseMenu}>マイページ</MenuItem>,
                        <MenuItem key="logout" onClick={handleLogout}>ログアウト</MenuItem>
                      ]
                    ) : (
                      <>
                        <MenuItem onClick={() => {
                          handleCloseMenu();
                          setIsLoginModalOpen(true);
                        }}>ログイン</MenuItem>
                        <MenuItem onClick={() => {
                          handleCloseMenu();
                          setIsRegisterModalOpen(true);
                        }}>新規登録</MenuItem>
                      </>
                    )}
                  </Menu>
                </Toolbar>
              </Container>
            </AppBar>

            {/* 下部の3つのセクション */}
            <Routes>
              <Route path="/" element={
                <Container maxWidth="xl" sx={{ mt: 3, px: 2 }}>
                  <Box sx={{ display: 'flex', gap: 2, height: 'calc(100vh - 120px)' }}>
                    <Box sx={{ flex: 1 }}>
                      <PdfViewer summary={pdfSummary} filename={pdfFilename} onSave={handleSaveSummary} />
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <AiAssistant pdfSummaryContent={pdfSummary} />
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Workspace />
                    </Box>
                  </Box>
                </Container>
              } />
              <Route path="/mypage" element={<MyPage histories={summaryHistories} onHistoryClick={handleHistoryClick} />} />
            </Routes>
          </Box>
          <LoginModal
            open={isLoginModalOpen}
            onClose={handleCloseLoginModal}
            showSnackbar={showSnackbar}
          />
          <RegisterModal
            open={isRegisterModalOpen}
            onClose={() => setIsRegisterModalOpen(false)}
          />
          <Snackbar open={snackbarOpen} autoHideDuration={6000} onClose={handleCloseSnackbar}>
            <Alert onClose={handleCloseSnackbar} severity={snackbarSeverity} sx={{ width: '100%' }}>
              {snackbarMessage}
            </Alert>
          </Snackbar>
        </>
      );
}

export default App;