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
            <Paper 
              sx={{ 
                height: '100%', 
                p: 2,
                border: '1px solid #e0e0e0',
                borderRadius: 2
              }}
            >
              {/* セクション1 - 空 */}
            </Paper>
          </Box>
          <Box sx={{ flex: 1 }}>
            <Paper 
              sx={{ 
                height: '100%', 
                p: 2,
                border: '1px solid #e0e0e0',
                borderRadius: 2
              }}
            >
              {/* セクション2 - 空 */}
            </Paper>
          </Box>
          <Box sx={{ flex: 1 }}>
            <Paper 
              sx={{ 
                height: '100%', 
                p: 2,
                border: '1px solid #e0e0e0',
                borderRadius: 2
              }}
            >
              {/* セクション3 - 空 */}
            </Paper>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}

export default App;
