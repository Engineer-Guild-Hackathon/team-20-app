import React, { useRef, useState } from 'react';
import { Button, CircularProgress, Alert, Snackbar, IconButton, Menu, MenuItem, Box } from '@mui/material';
import { CloudUpload, MoreVert as MoreVertIcon } from '@mui/icons-material';

interface FileUploadButtonProps {
  onSummaryGenerated: (summary: string, filename: string, summaryId?: number, tags?: string[], filePath?: string[]) => void;
  onClearWorkspace: () => void;
}

const FileUploadButton: React.FC<FileUploadButtonProps> = ({ onSummaryGenerated, onClearWorkspace }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string>('');
  const [showError, setShowError] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleMenuClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setError('');
    setShowError(false); // Reset error display

    const formData = new FormData();
    let hasValidationError = false;
    let validationErrorMessages: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (!file.name.toLowerCase().endsWith('.pdf')) {
        validationErrorMessages.push(`${file.name}: PDFファイルのみアップロード可能です。`);
        hasValidationError = true;
        continue;
      }

      if (file.size > 10 * 1024 * 1024) {
        validationErrorMessages.push(`${file.name}: ファイルサイズが大きすぎます (10MB以下にしてください)。`);
        hasValidationError = true;
        continue;
      }
      formData.append('files', file); // Append each file with the key 'files'
    }

    if (hasValidationError) {
      setError(validationErrorMessages.join('\n'));
      setShowError(true);
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    try {
      const response = await fetch('http://localhost:8000/api/upload-pdf', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'アップロードに失敗しました');
      }

      const result = await response.json();
      // The backend now returns a single summary for all files
      onSummaryGenerated(result.summary, result.filename, undefined, result.tags, result.file_path);
      
    } catch (error) {
      console.error('Upload error:', error);
      setError(error instanceof Error ? error.message : 'アップロードに失敗しました');
      setShowError(true);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".pdf"
        multiple
        style={{ display: 'none' }}
      />
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Button 
          variant="contained" 
          color="secondary"
          onClick={handleUpload}
          disabled={isUploading}
          startIcon={isUploading ? <CircularProgress size={20} color="inherit" /> : <CloudUpload />}
        >
          {isUploading ? 'アップロード中...' : 'Upload PDF'}
        </Button>
        <IconButton
          aria-label="more"
          id="long-button"
          aria-controls={open ? 'long-menu' : undefined}
          aria-expanded={open ? 'true' : undefined}
          aria-haspopup="true"
          onClick={handleMenuClick}
          color="inherit"
          sx={{ ml: 1 }}
        >
          <MoreVertIcon />
        </IconButton>
        <Menu
          id="long-menu"
          MenuListProps={{
            'aria-labelledby': 'long-button',
          }}
          anchorEl={anchorEl}
          open={open}
          onClose={handleMenuClose}
          PaperProps={{
            style: {
              maxHeight: 48 * 4.5,
              width: '20ch',
            },
          }}
        >
          <MenuItem onClick={() => { handleMenuClose(); onClearWorkspace(); }}>
            作業内容クリア
          </MenuItem>
        </Menu>
      </Box>

      <Snackbar 
        open={showError} 
        autoHideDuration={6000} 
        onClose={() => setShowError(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={() => setShowError(false)} severity="error">
          {error}
        </Alert>
      </Snackbar>
    </>
  );
};

export default FileUploadButton;
