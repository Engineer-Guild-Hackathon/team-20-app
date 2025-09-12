import React, { useState } from 'react';
import { Paper, Typography, Button, Box } from '@mui/material';
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs';
import 'prismjs/components/prism-python';
import 'prismjs/themes/prism.css'; // You can choose a different theme

const Workspace: React.FC = () => {
  const [pythonCode, setPythonCode] = useState<string>('print("Input your code here!")');
  const [output, setOutput] = useState<string>('');

  const handleRunCode = async () => {
    setOutput('Executing...');
    // Clear previous PyScript elements
    const oldPyScript = document.getElementById('pyscript-runner');
    if (oldPyScript) {
      oldPyScript.remove();
    }

    // Create a new div to hold the PyScript output
    const outputDiv = document.createElement('div');
    outputDiv.id = 'pyscript-output-target';
    outputDiv.style.display = 'none'; // Hide this div

    // Append the output target div to the body or a specific container
    document.body.appendChild(outputDiv); // Or a more specific container if available

    // Create a new <py-script> element
    const pyScriptElement = document.createElement('py-script');
    pyScriptElement.id = 'pyscript-runner';
    // Redirect stdout to the outputDiv
    pyScriptElement.innerHTML = `
import sys
from js import document

class ConsoleOutput:
    def write(self, s):
        output_target = document.getElementById('pyscript-output-target')
        if output_target: 
            output_target.innerHTML += s
    def flush(self):
        pass

sys.stdout = ConsoleOutput()
sys.stderr = ConsoleOutput()

${pythonCode}
`;

    // Append the <py-script> element to the body to execute
    document.body.appendChild(pyScriptElement);

    // Wait for a short period for PyScript to execute and update the DOM
    // This is a simple approach; a more robust solution would involve PyScript's event listeners
    await new Promise(resolve => setTimeout(resolve, 500));

    // Read the output from the hidden div
    const finalOutput = outputDiv.innerHTML;
    setOutput(finalOutput);

    // Clean up the dynamically created elements
    pyScriptElement.remove();
    outputDiv.remove();
  };

  return (
    <Paper sx={{
        height: '100%',
        p: 2,
        border: '1px solid #00bcd4',
        borderRadius: 2,
        display: 'flex',
                flexDirection: 'column',
        boxShadow: '0 0 15px rgba(0, 188, 212, 0.7)'
      }}
      >
      <Typography variant="h6" gutterBottom>Python Workspace</Typography>
      <Box sx={{
          mb: 2,
          border: '1px solid #00bcd4',
          borderRadius: '4px',
          overflow: 'hidden', // Boxのスクロールを無効化
          height: '400px', // 固定の高さを設定
        }}>
        <Editor
          value={pythonCode}
          onValueChange={setPythonCode}
          highlight={code => highlight(code, languages.python, 'python')}
          padding={10}
                    style={{
            fontFamily: '"Fira code", "Fira Mono", monospace',
            fontSize: 14,
                        height: '100%', // Boxの高さに合わせる
            overflowY: 'auto', // Editor自身がスクロールを管理
          }}
        />
      </Box>
      <Button
        variant="contained"
        color="primary"
        onClick={handleRunCode}
        sx={{ mb: 2 }}
      >
        Run Python Code
      </Button>
      <Typography variant="h6" gutterBottom>Output</Typography>
      <Box
        sx={{
          flexGrow: 1,
          p: 2,
          border: '1px solid #00bcd4', // ボーダー色をサイバーチックに
          borderRadius: '4px',
                    backgroundColor: '#1a1a2e', // 背景色をダークに
          overflow: 'auto',
          fontFamily: 'monospace',
          whiteSpace: 'pre-wrap',
          minHeight: '100px', // 最小高さを設定 (例: 100px)
        }}
      >
        {output || 'No output yet.'}
      </Box>
    </Paper>
  );
};

export default Workspace;