import React from 'react';

function App() {
  return (
    <div style={{ padding: '20px', backgroundColor: '#f0f0f0', minHeight: '100vh' }}>
      <h1>LTL Driver Management System</h1>
      <p>If you can see this, the React app is working!</p>
      <div style={{ marginTop: '20px' }}>
        <a href="/login" style={{ 
          padding: '10px 20px', 
          backgroundColor: '#007bff', 
          color: 'white', 
          textDecoration: 'none',
          borderRadius: '5px'
        }}>
          Go to Login
        </a>
      </div>
    </div>
  );
}

export default App;