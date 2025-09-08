import React from 'react';
import { 
  Button, 
  Typography, 
  Container, 
  Box, 
  AppBar, 
  Toolbar,
  Paper
} from '@mui/material';
import PdfViewer from './components/PdfViewer';
import AiAssistant from './components/AiAssistant';
import Workspace from './components/Workspace';

function App() {
  return (
    <Box sx={{ flexGrow: 1 }}>
      {/* 上部のヘッダーセクション */}
      <AppBar position="static" sx={{ backgroundColor: '#1976d2', py: 1 }}>
        <Container maxWidth="xl">
          <Toolbar sx={{ justifyContent: 'space-between', minHeight: 48 }}>
            <Typography variant="h5" component="div" sx={{ fontWeight: 'bold' }}>
              CogniStudy
            </Typography>
            <Button 
              variant="contained" 
              color="secondary"
              sx={{ backgroundColor: '#f50057' }}
            >
              Upload PDF
            </Button>
          </Toolbar>
        </Container>
      </AppBar>

      {/* 下部の3つのセクション */}
      <Container maxWidth="xl" sx={{ mt: 3, px: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, height: 'calc(100vh - 120px)' }}>
          <Box sx={{ flex: 1 }}>
            <PdfViewer />
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
  );
}

export default App;
