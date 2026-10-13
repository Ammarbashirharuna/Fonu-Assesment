import type { ReactNode } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import Login from './pages/Login';
import Products from './pages/Products';
import Orders from './pages/Orders';
import AdminProducts from './pages/AdminProducts';
import Dashboard from './pages/Dashboard';

function Guard({ children, admin }: { children: ReactNode; admin?: boolean }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (admin && user.role !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  const { user, logout } = useAuth();
  return (
    <>
      <nav>
        <strong>Inventory</strong>
        {user && <Link to="/">Shop</Link>}
        {user && <Link to="/orders">{user.role === 'admin' ? 'All orders' : 'My orders'}</Link>}
        {user?.role === 'admin' && <Link to="/admin/products">Manage products</Link>}
        {user?.role === 'admin' && <Link to="/admin/dashboard">Dashboard</Link>}
        <span className="spacer" />
        {user ? (<><span className="muted">{user.email} ({user.role})</span><button onClick={logout}>Logout</button></>)
              : <Link to="/login">Login</Link>}
      </nav>
      <main>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Guard><Products /></Guard>} />
          <Route path="/orders" element={<Guard><Orders /></Guard>} />
          <Route path="/admin/products" element={<Guard admin><AdminProducts /></Guard>} />
          <Route path="/admin/dashboard" element={<Guard admin><Dashboard /></Guard>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}
