import React, { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { Box, Typography, IconButton, CircularProgress, Paper } from '@mui/material';
import { ChevronLeft, ChevronRight, PictureAsPdf } from '@mui/icons-material';

pdfjs.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs`;

interface PdfDocumentViewerProps {
  pdfFilePath?: number[]; // now contains SharedFile IDs
  filename?: string;
}

const API_BASE = process.env.REACT_APP_API_BASE_URL || '';

const PdfDocumentViewer: React.FC<PdfDocumentViewerProps> = ({ pdfFilePath, filename }) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [httpHeaders, setHttpHeaders] = useState<Record<string, string>>({});

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const isLoggedIn = Boolean(token);
    if (pdfFilePath && pdfFilePath.length > 0 && isLoggedIn) {
      const fileId = pdfFilePath[0];
      setPdfUrl(`${API_BASE}/api/files/${fileId}`);
      if (token) setHttpHeaders({ Authorization: `Bearer ${token}` });
      else setHttpHeaders({});
    } else {
      setPdfUrl(null);
      setHttpHeaders({});
    }
  }, [pdfFilePath]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPageNumber(1); // Reset to first page on new document load
  };

  const goToPrevPage = () =>
    setPageNumber((prevPageNumber) => Math.max(prevPageNumber - 1, 1));

  const goToNextPage = () =>
    setPageNumber((prevPageNumber) => Math.min(prevPageNumber + 1, numPages || 1));

  return (
    <Paper
      sx={{
        height: '100%',
        flexGrow: 1,
        p: 2,
        border: '1px solid #00bcd4',
        borderRadius: 2,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 0 15px rgba(0, 188, 212, 0.7)',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <PictureAsPdf color="error" />
        <Typography variant="h6" component="h2">
          PDF Document
        </Typography>
      </Box>

      {filename && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" color="text.secondary">
            {filename}
          </Typography>
        </Box>
      )}

      <Box sx={{ flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
        {pdfUrl ? (
          <Document
            file={pdfUrl ? { url: pdfUrl, httpHeaders } : undefined}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={<CircularProgress />}
            error={<Typography color="error">PDFの読み込みに失敗しました。</Typography>}
            noData={<Typography>PDFファイルがありません。</Typography>}
          >
            <Page pageNumber={pageNumber} width={Math.min(window.innerWidth * 0.4, 600)} /> {/* Adjust width as needed */}
          </Document>
        ) : (
          <Typography variant="body1" textAlign="center" color="text.secondary">
            PDFファイルを表示するにはログインが必要です
          </Typography>
        )}
      </Box>

      {pdfUrl && numPages && (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mt: 2 }}>
          <IconButton onClick={goToPrevPage} disabled={pageNumber <= 1}>
            <ChevronLeft />
          </IconButton>
          <Typography variant="body2">
            Page {pageNumber} of {numPages}
          </Typography>
          <IconButton onClick={goToNextPage} disabled={pageNumber >= (numPages || 1)}>
            <ChevronRight />
          </IconButton>
        </Box>
      )}
    </Paper>
  );
};

export default PdfDocumentViewer;
