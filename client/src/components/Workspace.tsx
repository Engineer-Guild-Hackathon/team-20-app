import React, { useState } from 'react';
import { Paper, Typography, Button, Box } from '@mui/material';
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs';
import 'prismjs/components/prism-python';
import 'prismjs/themes/prism.css'; // You can choose a different theme

const Workspace: React.FC = () => {
  const [pythonCode, setPythonCode] = useState<string>('print("Hello from PyScript!")');
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
        border: '1px solid #e0e0e0',
        borderRadius: 2,
        display: 'flex',
        flexDirection: 'column'
      }}
      >
      <Typography variant="h6" gutterBottom>Python Workspace</Typography>
      <Box sx={{ mb: 2, border: '1px solid #ccc', borderRadius: '4px', overflow: 'hidden' }}>
        <Editor
          value={pythonCode}
          onValueChange={setPythonCode}
          highlight={code => highlight(code, languages.python, 'python')}
          padding={10}
          style={{
            fontFamily: '"Fira code", "Fira Mono", monospace',
            fontSize: 14,
            minHeight: '200px',
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
          border: '1px solid #ccc',
          borderRadius: '4px',
          backgroundColor: '#f5f5f5',
          overflow: 'auto',
          fontFamily: 'monospace',
          whiteSpace: 'pre-wrap',
        }}
      >
        {output || 'No output yet.'}
      </Box>
    </Paper>
  );
};

export default Workspace;