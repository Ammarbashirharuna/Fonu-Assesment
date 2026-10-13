import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '../auth';
import { errMsg } from '../api';

export default function AdminLogin() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={user.role === 'admin' ? '/admin/products' : '/'} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError('');
    try { await login(email, password, true); nav('/admin/products'); }
    catch (err) { setError(errMsg(err)); }
    finally { setBusy(false); }
  };

  return (
    <form className="card" style={{ maxWidth: 400, margin: '60px auto', padding: 32, boxShadow: 'var(--shadow-lg)' }} onSubmit={submit}>
      <span className="logo" style={{ marginBottom: 14 }}><ShieldCheck size={18} /></span>
      <h2>Admin console</h2>
      <p className="muted">Restricted access. Authorised staff only.</p>
      {error && <div className="error">{error}</div>}
      <p><input type="email" placeholder="Admin email" value={email} onChange={(e) => setEmail(e.target.value)} required /></p>
      <p><input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required /></p>
      <button disabled={busy} style={{ width: '100%' }}>{busy ? 'Verifying...' : 'Sign in'}</button>
    </form>
  );
}
