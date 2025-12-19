import React, { useState } from 'react';

interface RegisterProps {
  onRegisterSuccess: () => void;
  onSwitchToLogin: () => void;
}

export default function Register({ onRegisterSuccess, onSwitchToLogin }: RegisterProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');

    try {
      const response = await fetch('http://localhost:8000/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('✅ Kayıt Başarılı! Giriş yapabilirsiniz.');
        
        setTimeout(() => {
            onRegisterSuccess();
        }, 1500);
      } else {
        setMessage(`❌ Hata: ${data.error || 'Kayıt olunamadı'}`);
      }
    } catch (error) {
      setMessage('❌ Sunucu hatası.');
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '100px auto', padding: '20px', border: '1px solid #444', borderRadius: '8px', color: 'white', backgroundColor: '#222' }}>
      <h2 style={{ textAlign: 'center' }}>Yeni Hesap Oluştur</h2>
      <form onSubmit={handleRegister}>
        <div style={{ marginBottom: '15px' }}>
          <label>Email:</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: '100%', padding: '8px', marginTop: '5px', borderRadius: '4px' }}
            required
          />
        </div>
        <div style={{ marginBottom: '15px' }}>
          <label>Şifre Belirle:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: '100%', padding: '8px', marginTop: '5px', borderRadius: '4px' }}
            required
          />
        </div>
        <button type="submit" style={{ width: '100%', padding: '10px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
          Kayıt Ol
        </button>
      </form>
    
      <p style={{ textAlign: 'center', marginTop: '15px', fontSize: '14px' }}>
        Zaten hesabın var mı?{' '}
        <span 
            onClick={onSwitchToLogin} 
            style={{ color: '#007bff', cursor: 'pointer', textDecoration: 'underline' }}
        >
            Giriş Yap
        </span>
      </p>

      {message && <p style={{ marginTop: '15px', textAlign: 'center', color: message.startsWith('✅') ? 'lightgreen' : 'tomato' }}>{message}</p>}
    </div>
  );
}