import React, { useState, useEffect } from 'react';
import { 
  Typography, 
  Container, 
  Box, 
  AppBar, 
  Toolbar,
  Paper,
  IconButton,
  Menu,
  MenuItem
} from '@mui/material';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import PdfViewer from './components/PdfViewer';
import AiAssistant from './components/AiAssistant';
import Workspace from './components/Workspace';
import FileUploadButton from './components/FileUploadButton';
import LoginModal from './components/LoginModal';
import RegisterModal from './components/RegisterModal';

function App() {
  const [pdfSummary, setPdfSummary] = useState<string>('');
  const [pdfFilename, setPdfFilename] = useState<string>('');
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState<boolean>(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const openMenu = Boolean(anchorEl);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    setIsLoggedIn(!!token);
  }, []);

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
    console.log('ログアウトしました。');
  };

  const handleSummaryGenerated = (summary: string, filename: string) => {
    setPdfSummary(summary);
    setPdfFilename(filename);
  };
  return (
    <>
      <Box sx={{ flexGrow: 1 }}>
        {/* 上部のヘッダーセクション */}
        <AppBar position="static" sx={{ backgroundColor: '#1976d2', py: 1 }}>
          <Container maxWidth="xl">
            <Toolbar sx={{ justifyContent: 'space-between', minHeight: 48 }}>
              <Typography variant="h5" component="div" sx={{ fontWeight: 'bold' }}>
                CogniStudy
              </Typography>
              <FileUploadButton onSummaryGenerated={handleSummaryGenerated} />
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
                  <MenuItem onClick={handleLogout}>ログアウト</MenuItem>
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
        <Container maxWidth="xl" sx={{ mt: 3, px: 2 }}>
          <Box sx={{ display: 'flex', gap: 2, height: 'calc(100vh - 120px)' }}>
            <Box sx={{ flex: 1 }}>
              <PdfViewer summary={pdfSummary} filename={pdfFilename} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <AiAssistant />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Workspace />
            </Box>
          </Box>
        </Container>
      </Box>
      <LoginModal
        open={isLoginModalOpen}
        onClose={handleCloseLoginModal}
      />
      <RegisterModal
        open={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
      />
    </>
  );
}

export default App;
