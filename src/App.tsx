import React, { useState } from 'react';
import './App.css';
import Login from './Login';
import Register from './Register'; 
import TaskApp from './TaskApp'; 

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentView, setCurrentView] = useState<'login' | 'register'>('login'); 

  
  if (!isAuthenticated) {
    if (currentView === 'login') {
        return (
            <div className="auth-wrapper">
                <Login 
                    onLoginSuccess={() => setIsAuthenticated(true)} 
                />
                <p style={{ textAlign: 'center', marginTop: '10px', color: '#ccc' }}>
                    Hesabın yok mu?{' '}
                    <button 
                        onClick={() => setCurrentView('register')}
                        style={{ background: 'none', border: 'none', color: '#007bff', cursor: 'pointer', textDecoration: 'underline', fontSize: '1rem' }}
                    >
                        Kayıt Ol
                    </button>
                </p>
            </div>
        );
    } else {
        return (
            <Register 
                onRegisterSuccess={() => setCurrentView('login')}
                onSwitchToLogin={() => setCurrentView('login')}   
            />
        );
    }
  }

  
  return (
    <>
      <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 1000 }}>
        <button onClick={() => setIsAuthenticated(false)} style={{ padding: '5px 10px', cursor: 'pointer' }}>Çıkış Yap</button>
      </div>
      <TaskApp />
    </>
  );
}

export default App;