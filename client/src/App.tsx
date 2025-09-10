import React, { useState } from 'react';
import { 
  Typography, 
  Container, 
  Box, 
  AppBar, 
  Toolbar,
  Paper,
  IconButton
} from '@mui/material';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import PdfViewer from './components/PdfViewer';
import AiAssistant from './components/AiAssistant';
import Workspace from './components/Workspace';
import FileUploadButton from './components/FileUploadButton';
import LoginModal from './components/LoginModal';

function App() {
  const [pdfSummary, setPdfSummary] = useState<string>('');
  const [pdfFilename, setPdfFilename] = useState<string>('');
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);

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
              <IconButton color="inherit" aria-label="account" onClick={() => setIsLoginModalOpen(true)}>
                <AccountCircleIcon fontSize="large" />
              </IconButton>
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
        onClose={() => setIsLoginModalOpen(false)}
      />
    </>
  );
}

export default App;
