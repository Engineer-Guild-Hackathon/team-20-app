import React, { useRef, useState } from 'react';
import { Button, CircularProgress, Alert, Snackbar } from '@mui/material';
import { CloudUpload } from '@mui/icons-material';

interface FileUploadButtonProps {
  onSummaryGenerated: (summary: string, filename: string, summaryId?: number, tags?: string[]) => void;
}

const FileUploadButton: React.FC<FileUploadButtonProps> = ({ onSummaryGenerated }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string>('');
  const [showError, setShowError] = useState(false);

  const handleUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('PDFファイルのみアップロード可能です');
      setShowError(true);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('ファイルサイズが大きすぎます (10MB以下にしてください)');
      setShowError(true);
      return;
    }

    setIsUploading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', file);

    

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/upload-pdf`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'アップロードに失敗しました');
      }

      const result = await response.json();
      
      // Pass the summary_id back to the parent component
      onSummaryGenerated(result.summary, result.filename, result.summary_id, result.tags);
      
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
        style={{ display: 'none' }}
      />
      
      <Button 
        variant="contained" 
        color="secondary"
        onClick={handleUpload}
        disabled={isUploading}
        startIcon={isUploading ? <CircularProgress size={20} color="inherit" /> : <CloudUpload />}
      >
        {isUploading ? 'アップロード中...' : 'Upload PDF'}
      </Button>

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