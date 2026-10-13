import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { errMsg } from '../api';
import PasswordInput from '../components/PasswordInput';

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
    <div className="auth">
      <section className="hero">
        <h1>Inventory and orders, <span>made effortless.</span></h1>
        <p>Browse products, place orders with real-time stock safety, and track everything in one clean workspace.</p>
        <div className="chips">
          <span className="chip">Oversell-proof checkout</span>
          <span className="chip">Role-based access</span>
          <span className="chip">Live sales insights</span>
        </div>
      </section>
      <form className="card" onSubmit={submit}>
        <h2>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
        <p className="muted">{mode === 'login' ? 'Sign in to continue.' : 'It takes less than a minute.'}</p>
        {error && <div className="error">{error}</div>}
        <p><input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required /></p>
        <p><PasswordInput value={password} onChange={setPassword} placeholder="Password (min 8 chars)" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></p>
        <div className="row">
          <button disabled={busy} style={{ flex: 1 }}>{busy ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
          <button type="button" className="secondary" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
            {mode === 'login' ? 'Register' : 'Sign in'}
          </button>
        </div>
      </form>
    </div>
  );
}
