import React, { useState } from 'react';
import './App.css';

function App() {
  const [message, setMessage] = useState('');

  const fetchMessage = () => {
    // Use environment variable for API URL, with a fallback for local development
    const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/';
    fetch(apiUrl)
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then(data => setMessage(data.message))
      .catch(error => {
        console.error('Error fetching data:', error)
        setMessage('Failed to fetch message from backend.');
      });
  };

  return (
    <div className="App">
      <header className="App-header">
        <p>
          {message || 'Press the button to get a message from the backend.'}
        </p>
        <button onClick={fetchMessage}>
          Get Message
        </button>
      </header>
    </div>
  );
}

export default App;
