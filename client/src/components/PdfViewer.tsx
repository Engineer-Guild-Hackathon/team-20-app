
import React from 'react';
import { Paper, Typography, Box, Divider, Chip } from '@mui/material';
import { PictureAsPdf, AutoAwesome } from '@mui/icons-material';

interface PdfViewerProps {
  summary?: string;
  filename?: string;
}

const PdfViewer: React.FC<PdfViewerProps> = ({ summary, filename }) => {
  return (
    <Paper 
      sx={{ 
        height: '100%', 
        p: 2,
        border: '1px solid #e0e0e0',
        borderRadius: 2,
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <PictureAsPdf color="error" />
        <Typography variant="h6" component="h2">
          PDF Viewer
        </Typography>
      </Box>
      
      {filename && (
        <Box sx={{ mb: 2 }}>
          <Chip 
            label={filename} 
            variant="outlined" 
            color="primary" 
            size="small"
            sx={{ maxWidth: '100%' }}
          />
        </Box>
      )}
      
      <Divider sx={{ mb: 2 }} />
      
      {summary ? (
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <AutoAwesome color="secondary" fontSize="small" />
            <Typography variant="subtitle1" fontWeight="bold" color="secondary">
              AI要約
            </Typography>
          </Box>
          
          <Typography 
            variant="body1" 
            sx={{ 
              lineHeight: 1.8,
              whiteSpace: 'pre-wrap',
              fontFamily: 'inherit'
            }}
          >
            {summary}
          </Typography>
        </Box>
      ) : (
        <Box 
          sx={{ 
            flex: 1, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: 'text.secondary'
          }}
        >
          <Typography variant="body1" textAlign="center">
            PDFファイルをアップロードして<br />
            AI要約を表示してください
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

export default PdfViewer;
