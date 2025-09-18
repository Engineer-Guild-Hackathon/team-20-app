import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { BrowserRouter } from 'react-router-dom';
import { createTheme, ThemeProvider, CssBaseline } from '@mui/material'; // 追加
import { AuthProvider } from './AuthContext'; // 追加


const darkCyberTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#00bcd4', // シアン系の色
    },
    secondary: {
      main: '#ff4081', // マゼンタ系の色
    },
    background: {
      default: '#1a1a2e', // ダークな背景色
      paper: '#2a2a4a', // カードなどの背景色
    },
    text: {
      primary: '#e0e0e0', // 明るいテキスト色
      secondary: '#a0a0a0', // 補助的なテキスト色
    },
  },
  typography: {
    fontFamily: '"Share Tech Mono", monospace', // サイバーチックなフォント
    h1: {
      color: '#00bcd4',
    },
    h2: {
      color: '#00bcd4',
    },
    h3: {
      color: '#00bcd4',
    },
    h4: {
      color: '#00bcd4',
    },
    h5: {
      color: '#00bcd4',
    },
    h6: {
      color: '#00bcd4',
    },
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#1a1a2e', // AppBarの背景色もダークに
          border: "none",
          boxShadow: "none",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: '#2a2a4a', // Paperコンポーネントの背景色
          border: '1px solid #00bcd4', // サイバーチックなボーダー
          boxShadow: '0 0 10px rgba(0, 188, 212, 0.5)', // サイバーチックなシャドウ
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderColor: '#00bcd4',
          // color: '#00bcd4', // この行を削除またはコメントアウト
          '&:hover': {
            backgroundColor: 'rgba(0, 188, 212, 0.1)',
            borderColor: '#00bcd4',
          },
        },
        containedPrimary: { // variant="contained" かつ color="primary" の場合
          color: '#e0e0e0', // 明るいテキスト色に設定
        },
        containedSecondary: { // variant="contained" かつ color="secondary" の場合
          color: '#e0e0e0', // 明るいテキスト色に設定
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          color: '#00bcd4',
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          '&:hover': {
            backgroundColor: 'rgba(0, 188, 212, 0.1)',
          },
        },
      },
    },
    MuiInputBase: { // TextFieldなどの入力フィールド
      styleOverrides: {
        root: {
          color: '#e0e0e0',
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: '#00bcd4',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: '#00bcd4',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#00bcd4',
          },
        },
      },
    },
    MuiFormLabel: { // TextFieldのラベル
      styleOverrides: {
        root: {
          color: '#a0a0a0',
          '&.Mui-focused': {
            color: '#00bcd4',
          },
        },
      },
    },
  },
});

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider theme={darkCyberTheme}> {/* 追加 */}
        <CssBaseline /> {/* 追加: MUIのベースラインCSSを適用 */}
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);


// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();