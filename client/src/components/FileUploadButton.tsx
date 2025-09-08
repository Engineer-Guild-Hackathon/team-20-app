import React from 'react';
import { Button } from '@mui/material';

const FileUploadButton = () => {
  const handleUpload = () => {
    console.log('UPLOAD PDF button clicked');
    // 今後の拡張のために、ここにファイルアップロードのロジックを追加します。
  };

  return (
    <Button 
      variant="contained" 
      color="secondary"
      sx={{ backgroundColor: '#f50057' }}
      onClick={handleUpload}
    >
      Upload PDF
    </Button>
  );
};

export default FileUploadButton;
