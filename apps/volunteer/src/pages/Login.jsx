import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { Navigate } from 'react-router-dom';
import { auth } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

export default function VolunteerLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { status } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      console.error(err);
      setError('Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  if (status === 'AUTHENTICATED') {
    return <Navigate to="/" replace />;
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--color-black)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-body)',
      color: 'var(--color-ivory)',
      padding: '1rem'
    }}>
      <div style={{
        background: 'rgba(15, 10, 5, 0.8)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(212, 175, 55, 0.2)',
        borderRadius: '12px',
        padding: '3rem 2rem',
        width: '100%',
        maxWidth: '400px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
        textAlign: 'center'
      }}>
        <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--color-gold)', fontSize: '1.8rem', marginBottom: '2rem' }}>VOLUNTEER ACCESS</h2>
        
        {error && <div style={{ color: 'var(--color-maroon)', marginBottom: '1rem', fontWeight: 'bold' }}>{error}</div>}
        
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <input
            type="email"
            placeholder="Registered Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              padding: '1rem',
              borderRadius: '8px',
              border: '1px solid rgba(212, 175, 55, 0.4)',
              background: 'rgba(0,0,0,0.5)',
              color: 'var(--color-white)',
              fontSize: '1.1rem',
              outline: 'none'
            }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{
              padding: '1rem',
              borderRadius: '8px',
              border: '1px solid rgba(212, 175, 55, 0.4)',
              background: 'rgba(0,0,0,0.5)',
              color: 'var(--color-white)',
              fontSize: '1.1rem',
              outline: 'none'
            }}
          />
          
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '1rem',
              borderRadius: '50px',
              background: 'linear-gradient(135deg, var(--color-gold), var(--color-orange))',
              border: 'none',
              color: 'var(--color-black)',
              fontWeight: 'bold',
              fontSize: '1.1rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              marginTop: '1rem'
            }}
          >
            {loading ? 'VERIFYING...' : 'LOGIN'}
          </button>
        </form>
      </div>
    </div>
  );
}
