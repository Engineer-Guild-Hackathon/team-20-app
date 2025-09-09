import React, { useState, useRef, useEffect } from 'react';
import { Paper, Typography, Button, Box } from '@mui/material';
import Editor from '@monaco-editor/react';

// PyScriptの型定義 (グローバルスコープに存在するため)
declare global {
  interface Window {
    PyScript: any;
  }
}

const Workspace: React.FC = () => {
  const [code, setCode] = useState<string>('print("Hello, PyScript!")');
  const outputRef = useRef<HTMLDivElement>(null);
  const [pyscriptReady, setPyscriptReady] = useState(false);

  useEffect(() => {
    const handlePyScriptReady = () => {
      console.log('PyScript is fully loaded and all initial scripts are done.');
      setPyscriptReady(true);
      document.removeEventListener('py:done', handlePyScriptReady);
    };

    document.addEventListener('py:done', handlePyScriptReady);

    return () => {
      document.removeEventListener('py:done', handlePyScriptReady);
    };
  }, []);

  const runCode = async () => {
    if (!pyscriptReady) {
      if (outputRef.current) {
        outputRef.current.innerText = 'PyScript is not ready yet. Please wait a moment and try again.';
      }
      return;
    }

    if (outputRef.current) {
      outputRef.current.innerHTML = ''; // Clear previous output
    }

    const pythonCode = `
import js
import sys
import io

# 出力先のDOM要素を取得
output_div = js.document.getElementById('pyscript-output-area')

# 標準出力をキャプチャ
old_stdout = sys.stdout
sys.stdout = captured_output = io.StringIO()

try:
    exec('''${code.replace(/'/g, "\'").replace(/\n/g, '\\n')}''')
finally:
    sys.stdout = old_stdout

# キャプチャした出力をDOMに書き込む
output_content = captured_output.getvalue()
output_div.innerText = output_content
`;

    const scriptRunner = document.createElement('script');
    scriptRunner.type = 'py';
    scriptRunner.id = 'dynamic-pyscript-runner';
    scriptRunner.textContent = pythonCode;

    const existingRunner = document.getElementById('dynamic-pyscript-runner');
    if (existingRunner) {
      existingRunner.remove();
    }

    document.body.appendChild(scriptRunner);

    try {
      if ((scriptRunner as any).evaluate) {
        await (scriptRunner as any).evaluate();
      } else {
        console.warn("evaluate() method not found on the script element.");
        if (outputRef.current) {
          outputRef.current.innerText = "Error: PyScript evaluate() method not found.";
        }
      }
    } catch (e: any) {
      console.error("Error evaluating Python code:", e);
      if (outputRef.current) {
        outputRef.current.innerText = `Error: ${e.message || e}`;
      }
    }
  };

  return (
    <Paper sx={{ height: '100%', p: 2, display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h6" gutterBottom>
        Python Workspace (PyScript)
      </Typography>
      <Box sx={{ flex: 1, border: '1px solid #ccc', borderRadius: '4px', mb: 1, minHeight: '200px' }}>
        <Editor
          height="100%"
          defaultLanguage="python"
          defaultValue={'print("Hello from PyScript!")'}
          onChange={(value) => setCode(value || '')}
          options={{ minimap: { enabled: false } }}
        />
      </Box>
      <Button variant="contained" onClick={runCode} sx={{ mb: 1 }} disabled={!pyscriptReady}>
        {pyscriptReady ? 'Run Code' : 'Loading PyScript...'}
      </Button>
      <Typography variant="subtitle1" gutterBottom>
        Output:
      </Typography>
      <Paper 
        id="pyscript-output-area" // PyScriptの出力先ID
        ref={outputRef} 
        sx={{ 
          flexGrow: 1,
          p: 2, 
          backgroundColor: '#f5f5f5', 
          overflowY: 'auto',
          fontFamily: 'monospace',
          whiteSpace: 'pre-wrap'
        }}
      >
        {/* PyScriptの出力はここに表示される */}
      </Paper>
    </Paper>
  );
};

export default Workspace;