import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { errMsg } from '../api';

export default function Login() {
  const { user, login, register } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await (mode === 'login' ? login : register)(email, password);
      nav('/');
    } catch (err) { setError(errMsg(err)); }
    finally { setBusy(false); }
  };

  return (
    <form className="card" style={{ maxWidth: 360, margin: '40px auto' }} onSubmit={submit}>
      <h2>{mode === 'login' ? 'Sign in' : 'Create account'}</h2>
      {error && <div className="error">{error}</div>}
      <p><input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required /></p>
      <p><input type="password" placeholder="Password (min 8 chars)" value={password} onChange={(e) => setPassword(e.target.value)} required /></p>
      <div className="row">
        <button disabled={busy}>{busy ? '...' : mode === 'login' ? 'Login' : 'Register'}</button>
        <button type="button" className="secondary" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? 'Need an account?' : 'Have an account?'}
        </button>
      </div>
    </form>
  );
}
