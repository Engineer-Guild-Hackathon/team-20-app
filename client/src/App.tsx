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
  Alert,
  Button,
  FormControl, // Added
  InputLabel, // Added
  Select // Added
} from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import SaveIcon from '@mui/icons-material/Save'; // Added
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
  chat_history_id?: number; // チャット履歴IDを追加
}

interface HistoryContent {
  id: number;
  summary_history_id: number;
  section_type: string;
  content: string;
  created_at: string;
  updated_at: string;
}

interface Team {
  id: number;
  name: string;
  role: string;
}

function App() {
  const location = useLocation();
  const [pdfSummary, setPdfSummary] = useState<string>(() => {
    try {
      return sessionStorage.getItem('currentPdfSummary') || '';
    } catch (e) {
      console.error('Failed to restore PDF summary from sessionStorage:', e);
      return '';
    }
  });
  const [pdfFilename, setPdfFilename] = useState<string>(() => {
    try {
      return sessionStorage.getItem('currentPdfFilename') || '';
    } catch (e) {
      console.error('Failed to restore PDF filename from sessionStorage:', e);
      return '';
    }
  });
  const [pdfSummaryId, setPdfSummaryId] = useState<number | undefined>(() => {
    try {
      const saved = sessionStorage.getItem('currentPdfSummaryId');
      return saved ? parseInt(saved) : undefined;
    } catch (e) {
      console.error('Failed to restore PDF summary ID from sessionStorage:', e);
      return undefined;
    }
  });
  const [pdfTags, setPdfTags] = useState<string[]>(() => {
    try {
      const saved = sessionStorage.getItem('currentPdfTags');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error('Failed to restore PDF tags from sessionStorage:', e);
      return [];
    }
  });
  const [pdfFilePath, setPdfFilePath] = useState<string>(() => {
    try {
      return sessionStorage.getItem('currentPdfFilePath') || '';
    } catch (e) {
      console.error('Failed to restore PDF file path from sessionStorage:', e);
      return '';
    }
  });
  const [summaryHistories, setSummaryHistories] = useState<HistoryItem[]>([]);
  const [viewMode, setViewMode] = useState<'new' | 'history' | 'current'>(() => {
    // sessionStorage から復元、チャットメッセージがあればcurrentモードに
    try {
      const savedMessages = sessionStorage.getItem('currentChatMessages');
      if (savedMessages) {
        const messages = JSON.parse(savedMessages);
        return messages.length > 0 ? 'current' : 'new';
      }
    } catch (e) {
      console.error('Failed to restore viewMode from sessionStorage:', e);
    }
    return 'new';
  });
  const [historicalContents, setHistoricalContents] = useState<HistoryContent[] | undefined>(undefined);
  const [chatMessages, setChatMessages] = useState<Message[]>(() => {
    // sessionStorage から初期値を復元
    try {
      const saved = sessionStorage.getItem('currentChatMessages');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error('Failed to restore chat messages from sessionStorage:', e);
      return [];
    }
  });
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState<boolean>(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const openMenu = Boolean(anchorEl);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [username, setUsername] = useState<string | null>(null);
  const [myTeams, setMyTeams] = useState<Team[]>([]); // New
  const [selectedTeamId, setSelectedTeamId] = useState<number | '' | '個人用'>(''); // New
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error' | 'info' | 'warning'>('success');
  const navigate = useNavigate();

  // 履歴表示前の状態を保存するためのstate
  const [previousPdfSummary, setPreviousPdfSummary] = useState<string | undefined>(undefined);
  const [previousPdfFilename, setPreviousPdfFilename] = useState<string | undefined>(undefined);
  const [previousPdfSummaryId, setPreviousPdfSummaryId] = useState<number | undefined>(undefined);
  const [previousPdfTags, setPreviousPdfTags] = useState<string[] | undefined>(undefined);
  const [previousPdfFilePath, setPreviousPdfFilePath] = useState<string | undefined>(undefined);
  const [previousChatMessages, setPreviousChatMessages] = useState<Message[] | undefined>(undefined);
  const [previousViewMode, setPreviousViewMode] = useState<'new' | 'history' | 'current' | undefined>(undefined);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    setIsLoggedIn(!!token);
  }, []);

  // New useEffect for fetching teams
  useEffect(() => {
    const fetchMyTeams = async () => {
      const token = localStorage.getItem('access_token');
      if (!token) {
        setMyTeams([]);
        return;
      }

      try {
        const response = await fetch('http://localhost:8000/api/users/me/teams', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data: Team[] = await response.json();
          setMyTeams(data);
        } else {
          console.error('Failed to fetch teams for App.tsx');
          setMyTeams([]);
        }
      } catch (error) {
        console.error('Error fetching teams for App.tsx:', error);
        setMyTeams([]);
      }
    };

    if (isLoggedIn) {
      fetchMyTeams();
    } else {
      setMyTeams([]); // ログアウト時はチームをクリア
    }
  }, [isLoggedIn]);

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
    fetchHistories();
  }, [isLoggedIn, fetchHistories]);

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

    // ログアウト時は作業データもクリア（オプション）
    try {
      sessionStorage.removeItem('currentPdfSummary');
      sessionStorage.removeItem('currentPdfFilename');
      sessionStorage.removeItem('currentPdfSummaryId');
      sessionStorage.removeItem('currentPdfTags');
      sessionStorage.removeItem('currentPdfFilePath');
      sessionStorage.removeItem('currentChatMessages');
    } catch (e) {
      console.error('Failed to clear session data on logout:', e);
    }
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

  const handleSummaryGenerated = (summary: string, filename: string, summaryId?: number, tags?: string[], filePath?: string) => {
    setPdfSummary(summary);
    setPdfFilename(filename);
    setPdfSummaryId(summaryId);
    setPdfTags(tags || []); // 追加
    setPdfFilePath(filePath || ''); // ファイルパス追加

    // sessionStorage に PDF 関連データを保存
    try {
      sessionStorage.setItem('currentPdfSummary', summary);
      sessionStorage.setItem('currentPdfFilename', filename);
      if (summaryId) {
        sessionStorage.setItem('currentPdfSummaryId', summaryId.toString());
      } else {
        sessionStorage.removeItem('currentPdfSummaryId');
      }
      sessionStorage.setItem('currentPdfTags', JSON.stringify(tags || []));
      sessionStorage.setItem('currentPdfFilePath', filePath || '');
    } catch (e) {
      console.error('Failed to save PDF data to sessionStorage:', e);
    }

    // 新規モードに設定
    setViewMode('new');
    setHistoricalContents(undefined);
    setChatMessages([]);
    // チャットメッセージのみクリア
    try {
      sessionStorage.removeItem('currentChatMessages');
    } catch (e) {
      console.error('Failed to clear chat messages from sessionStorage:', e);
    }
  };

  const handleHistoryClick = useCallback(async (item: HistoryItem) => {
    if (!item.id) return;
    const token = localStorage.getItem('access_token');
    if (!token) {
      showSnackbar('詳細の読み込みにはログインが必要です。', 'warning');
      return;
    }
    // 現在の作業状態を一時保存
    setPreviousPdfSummary(pdfSummary);
    setPreviousPdfFilename(pdfFilename);
    setPreviousPdfSummaryId(pdfSummaryId);
    setPreviousPdfTags(pdfTags);
    setPreviousPdfFilePath(pdfFilePath);
    setPreviousChatMessages(chatMessages);
    setPreviousViewMode(viewMode);

    try {
      const response = await fetch(`http://localhost:8000/api/summaries/${item.id}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('履歴詳細の読み込みに失敗しました。');
      const data = await response.json();

      // 基本情報の設定
      setPdfSummary(data.summary);
      setPdfFilename(data.filename);
      setPdfSummaryId(data.id);
      setPdfTags(data.tags ? data.tags.split(',').filter((t: string) => t.trim()) : []); // タグも設定
      setPdfFilePath(data.original_file_path || ''); // ファイルパスも設定

      // AIチャット履歴のロード
      const aiChatHistoryContent = data.contents?.find((content: HistoryContent) => content.section_type === 'ai_chat');
      if (aiChatHistoryContent && aiChatHistoryContent.content) {
        try {
          const parsedChatMessages = JSON.parse(aiChatHistoryContent.content);
          setChatMessages(parsedChatMessages);
        } catch (e) {
          console.error("Failed to parse AI chat history from historical contents:", e);
          setChatMessages([]);
        }
      } else {
        setChatMessages([]);
      }

      // sessionStorage に履歴データを保存（表示内容として）
      try {
        sessionStorage.setItem('currentPdfSummary', data.summary);
        sessionStorage.setItem('currentPdfFilename', data.filename);
        sessionStorage.setItem('currentPdfSummaryId', data.id.toString());
        if (data.tags) {
          sessionStorage.setItem('currentPdfTags', JSON.stringify(data.tags.split(',').filter((t: string) => t.trim())));
        }
        sessionStorage.setItem('currentPdfFilePath', data.original_file_path || '');
        sessionStorage.setItem('currentChatMessages', JSON.stringify(chatMessages)); // ロードしたチャットメッセージも保存
      } catch (e) {
        console.error('Failed to save history PDF data to sessionStorage:', e);
      }

      // 現在のチャットモードに切り替え
      setViewMode('current');
      setHistoricalContents(undefined); // 履歴モードではないのでクリア

      navigate('/');
    } catch (error) {
      console.error(error);
      showSnackbar(error instanceof Error ? error.message : '不明なエラーです。', 'error');
    }
  }, [showSnackbar, navigate, setPdfSummary, setPdfFilename, setPdfSummaryId, setPdfTags, setPdfFilePath, setChatMessages, pdfSummary, pdfFilename, pdfSummaryId, pdfTags, pdfFilePath, chatMessages, viewMode]);

  const handleMessagesChange = (messages: Message[]) => {
    setChatMessages(messages);
    // sessionStorage に保存
    try {
      sessionStorage.setItem('currentChatMessages', JSON.stringify(messages));
    } catch (e) {
      console.error('Failed to save chat messages to sessionStorage:', e);
    }
    // チャットが開始されたら current モードに切り替え
    if (messages.length > 0 && viewMode === 'new') {
      setViewMode('current');
    }
  };

  const handleExitHistoryView = useCallback(() => {
    // 一時保存した状態を復元
    setPdfSummary(previousPdfSummary || '');
    setPdfFilename(previousPdfFilename || '');
    setPdfSummaryId(previousPdfSummaryId);
    setPdfTags(previousPdfTags || []);
    setPdfFilePath(previousPdfFilePath || '');
    setChatMessages(previousChatMessages || []);
    setViewMode(previousViewMode || 'new'); // previousViewModeがundefinedの場合は'new'に

    // 一時保存状態をクリア
    setPreviousPdfSummary(undefined);
    setPreviousPdfFilename(undefined);
    setPreviousPdfSummaryId(undefined);
    setPreviousPdfTags(undefined);
    setPreviousPdfFilePath(undefined);
    setPreviousChatMessages(undefined);
    setPreviousViewMode(undefined);

    // sessionStorageも更新
    try {
      sessionStorage.setItem('currentPdfSummary', previousPdfSummary || '');
      sessionStorage.setItem('currentPdfFilename', previousPdfFilename || '');
      if (previousPdfSummaryId) {
        sessionStorage.setItem('currentPdfSummaryId', previousPdfSummaryId.toString());
      } else {
        sessionStorage.removeItem('currentPdfSummaryId');
      }
      sessionStorage.setItem('currentPdfTags', JSON.stringify(previousPdfTags || []));
      sessionStorage.setItem('currentPdfFilePath', previousPdfFilePath || '');
      sessionStorage.setItem('currentChatMessages', JSON.stringify(previousChatMessages || []));
    } catch (e) {
      console.error('Failed to restore session data on exit history view:', e);
    }

  }, [setPdfSummary, setPdfFilename, setPdfSummaryId, setPdfTags, setPdfFilePath, setChatMessages, setViewMode,
      previousPdfSummary, previousPdfFilename, previousPdfSummaryId, previousPdfTags, previousPdfFilePath, previousChatMessages, previousViewMode]);

  const handleSaveSummary = async (summary: string, filename: string, teamId: number | null, teamName: string | null, tags?: string[] | null, usernameFromProps?: string | null): Promise<number | undefined> => {
    if (!isLoggedIn) {
      showSnackbar('保存機能を利用するにはログインが必要です。', 'warning');
      setIsLoginModalOpen(true);
      return undefined; // Return undefined on failure
    }
    const token = localStorage.getItem('access_token');
    if (!token) return undefined; // Return undefined on failure

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
          body: JSON.stringify({
            filename,
            summary,
            team_id: teamId,
            tags: tags,
            original_file_path: pdfFilePath,
            ai_chat_history: chatMessages.length > 0 ? JSON.stringify(chatMessages) : undefined, // チャット履歴を追加
          }),
      });

      if (!summaryResponse.ok) {
        const errorData = await summaryResponse.json();
        console.error("Error saving summary:", errorData);
        throw new Error(`要約の保存に失敗しました: ${errorData.detail || '不明なエラー'}`);
      }

      const summaryData = await summaryResponse.json();
      const newSummaryId = summaryData.id;
      setPdfSummaryId(newSummaryId);

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
      return newSummaryId; // Return the new summary ID

    } catch (error) {
        console.error('Error saving history:', error);
        showSnackbar(error instanceof Error ? error.message : '保存中にエラーが発生しました。', 'error');
        return undefined; // Return undefined on error
    }
  };

  const handleCommentAttemptWithoutSave = async (commentContent: string) => {
    if (!isLoggedIn) {
      showSnackbar('コメント機能を利用するにはログインが必要です。', 'warning');
      setIsLoginModalOpen(true);
      return;
    }

    let targetSummaryId = pdfSummaryId;

    // もし要約がまだ保存されていない場合、まず要約を保存する
    if (!targetSummaryId && pdfSummary && pdfFilename) {
      showSnackbar('コメントを保存するために、まず要約を保存します。', 'info');
      targetSummaryId = await handleSaveSummary(pdfSummary, pdfFilename, selectedTeamId === '' ? null : Number(selectedTeamId), null, pdfTags, username);
      if (!targetSummaryId) {
        showSnackbar('要約の保存に失敗したため、コメントを保存できませんでした。', 'error');
        return;
      }
    }

    if (!targetSummaryId) {
      showSnackbar('コメントを保存するための要約IDがありません。', 'error');
      return;
    }

    const token = localStorage.getItem('access_token');
    if (!token) {
      showSnackbar('ログインしていません。', 'error');
      return;
    }

    try {
      const response = await fetch('http://localhost:8000/api/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ summary_id: targetSummaryId, content: commentContent }),
      });

      if (response.ok) {
        showSnackbar('コメントを保存しました！', 'success');
        // PdfViewerがsummaryIdを更新した後にコメントを再フェッチするようにトリガー
        // これはPdfViewerのuseEffect(..., [summaryId, isLoggedIn])で処理される
      } else {
        const errorData = await response.json();
        console.error('Failed to add comment:', errorData.detail);
        showSnackbar(`コメントの保存に失敗しました: ${errorData.detail || '不明なエラー'}`, 'error');
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      showSnackbar('コメントの保存中にエラーが発生しました。', 'error');
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
                  <img src="./product_logo.svg" alt="Product Logo" style={{ height: '34px', marginLeft: '8px', filter: 'drop-shadow(0 0 2px white)' }} /> {/* 追加 */}
                </Link>
              </Typography>
              {location.pathname === '/' && ( // pdfSummaryがある場合のみボタンを表示
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {pdfSummary && ( // pdfSummaryがある場合のみボタンを表示
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {isLoggedIn && myTeams.length > 0 && ( // ログインしていてチームがある場合のみ表示
                        <FormControl variant="outlined" size="small" sx={{ minWidth: 150, mr: 1 }}>
                          <InputLabel id="team-select-label">保存先を選択</InputLabel>
                          <Select
                            labelId="team-select-label"
                            value={selectedTeamId}
                            onChange={(e) => setSelectedTeamId(e.target.value as number | '')}
                            label="保存先を選択"
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
                        onClick={() => {
                          let teamName: string | null = null;
                          if (selectedTeamId !== '' && selectedTeamId !== '個人用') {
                            const selectedTeam = myTeams.find(team => team.id === Number(selectedTeamId));
                            if (selectedTeam) {
                              teamName = selectedTeam.name;
                            }
                          }
                          handleSaveSummary(pdfSummary, pdfFilename, selectedTeamId === '' ? null : Number(selectedTeamId), teamName, pdfTags, username);
                        }}
                        startIcon={<SaveIcon />}
                      >
                        現在の内容を保存
                      </Button>
                    </Box>
                  )}
                  <FileUploadButton onSummaryGenerated={handleSummaryGenerated} />
                </Box>
              )}
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
              {(previousPdfSummary !== undefined) && (
                <Box sx={{ mb: 2, p: 2, bgcolor: 'primary.main', borderRadius: 1 }}>
                  <Typography variant="body1" sx={{ display: 'inline', mr: 2 }}>
                    履歴モード: {pdfFilename}
                  </Typography>
                  <Button variant="contained" color="secondary" size="small" onClick={handleExitHistoryView}>
                    元の作業に戻る
                  </Button>
                </Box>
              )}
              <Box sx={{ display: 'flex', gap: 2, height: 'calc(100vh - 150px)' }}>
                <Box sx={{ flex: 1 }}>
                  <PdfViewer
                    summary={pdfSummary}
                    filename={pdfFilename}
                    onSave={handleSaveSummary}
                    summaryId={pdfSummaryId}
                    tags={pdfTags}
                    username={username}
                    isLoggedIn={isLoggedIn} // Pass isLoggedIn prop
                    onCommentAttemptWithoutSave={handleCommentAttemptWithoutSave} // New prop
                  />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <AiAssistant
                    pdfSummaryContent={pdfSummary}
                    summaryId={pdfSummaryId}
                    viewMode={viewMode}
                    historicalContents={historicalContents}
                    currentMessages={chatMessages}
                    onMessagesChange={handleMessagesChange}
                  />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Workspace />
                </Box>
              </Box>
            </Container>
          } />
          <Route path="/mypage" element={<MyPage histories={summaryHistories} onHistoryClick={handleHistoryClick} onUpdateHistory={handleUpdateHistoryItem} fetchHistories={fetchHistories} currentUsername={username} />} />
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
