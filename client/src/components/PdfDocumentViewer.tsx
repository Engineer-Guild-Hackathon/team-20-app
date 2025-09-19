import React, { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { Box, Typography, IconButton, CircularProgress, Paper, Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import { ChevronLeft, ChevronRight, PictureAsPdf, Add, Remove } from '@mui/icons-material';
import { useAuth } from '../AuthContext'; // Import useAuth

pdfjs.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs`;

interface PdfDocumentViewerProps {
  pdfFilePath?: number[]; // now contains SharedFile IDs
  filename?: string;
}

const API_BASE = process.env.REACT_APP_API_BASE_URL || '';

const PdfDocumentViewer: React.FC<PdfDocumentViewerProps> = ({ pdfFilePath, filename }) => {
  const { authToken } = useAuth(); // Use authToken from AuthContext
  const isLoggedIn = React.useMemo(() => Boolean(authToken), [authToken]); // Derive isLoggedIn from authToken

  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [selectedFileIndex, setSelectedFileIndex] = useState<number>(0);
  const [scale, setScale] = useState<number>(1.0); // NEW: PDFズームスケール

  const memoizedPdfFilePath = React.useMemo(() => pdfFilePath, [pdfFilePath]);

  useEffect(() => {
    let revokeUrl: string | null = null;

    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);

    const loadPdf = async () => {
      if (memoizedPdfFilePath && memoizedPdfFilePath.length > 0) {
        const safeIndex = Math.min(Math.max(selectedFileIndex, 0), memoizedPdfFilePath.length - 1);
        const fileId = memoizedPdfFilePath[safeIndex];
        try {
          const resp = await fetch(`${API_BASE}/api/files/${fileId}`, {
            headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
          });
          if (!resp.ok) throw new Error('Failed to fetch PDF');
          const blob = await resp.blob();
          const objUrl = URL.createObjectURL(blob);
          revokeUrl = objUrl;
          setPdfUrl(objUrl);
          setPageNumber(1);
        } catch (e) {
          console.error('Failed to load PDF:', e);
          setPdfUrl(null);
        }
      } else {
        setPdfUrl(null);
      }
    };
    loadPdf();
    return () => {
      if (revokeUrl) URL.revokeObjectURL(revokeUrl);
      window.removeEventListener('resize', updateWidth);
    };
  }, [memoizedPdfFilePath, selectedFileIndex, authToken, isLoggedIn]);

  // Reset selected file index when the file list changes
  useEffect(() => {
    setSelectedFileIndex(0);
  }, [JSON.stringify(pdfFilePath)]);

  const displayNames: string[] = React.useMemo(() => {
    if (!filename) return [];
    return filename.split(',').map((s) => s.trim()).filter(Boolean);
  }, [filename]);

  const currentDisplayName = React.useMemo(() => {
    if (displayNames.length > 0) {
      return displayNames[Math.min(selectedFileIndex, displayNames.length - 1)] || filename || undefined;
    }
    return filename;
  }, [displayNames, selectedFileIndex, filename]);

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
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Typography variant="subtitle2" color="text.secondary">
            {currentDisplayName}
          </Typography>
          {pdfFilePath && pdfFilePath.length > 1 && (
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel id="pdf-file-selector-label">PDFファイル</InputLabel>
              <Select
                labelId="pdf-file-selector-label"
                value={selectedFileIndex}
                label="PDFファイル"
                onChange={(e) => setSelectedFileIndex(Number(e.target.value))}
              >
                {pdfFilePath.map((id, idx) => (
                  <MenuItem key={id} value={idx}>
                    {displayNames[idx] || `File ${idx + 1}`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Box>
      )}

      <Box ref={containerRef} sx={{ flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', maxWidth: '100%', overflowX: "hidden" }}>
        {pdfUrl ? (
          <Document
            file={pdfUrl || undefined}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={<CircularProgress />}
            error={<Typography color="error">PDFの読み込みに失敗しました。</Typography>}
            noData={<Typography>PDFファイルがありません。</Typography>}
          >
            <Page pageNumber={pageNumber} scale={scale} />
          </Document>
        ) : (
          <Typography variant="body1" textAlign="center" color="text.secondary">
            PDFファイルを表示するにはログインが必要です
          </Typography>
        )}
      </Box>

      {pdfUrl && numPages && (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mt: 2, gap: 2 }}>
          <IconButton onClick={goToPrevPage} disabled={pageNumber <= 1}>
            <ChevronLeft />
          </IconButton>
          <Typography variant="body2">
            Page {pageNumber} of {numPages}
          </Typography>
          <IconButton onClick={goToNextPage} disabled={pageNumber >= (numPages || 1)}>
            <ChevronRight />
          </IconButton>

          {/* NEW: Zoom Controls */}
          <IconButton onClick={() => setScale(prev => Math.max(0.5, prev - 0.1))} disabled={scale <= 0.5}>
            <Remove />
          </IconButton>
          <Typography variant="body2">
            {Math.round(scale * 100)}%
          </Typography>
          <IconButton onClick={() => setScale(prev => Math.min(3.0, prev + 0.1))} disabled={scale >= 3.0}>
            <Add />
          </IconButton>
        </Box>
      )}
    </Paper>
  );
};

export default PdfDocumentViewer;
