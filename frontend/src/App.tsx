import type { ReactNode } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { BarChart3, Boxes, LogOut, Package, ShoppingBag, ShoppingCart, Store } from 'lucide-react';
import { useAuth } from './auth';
import { useCart } from './cart';
import CartDrawer from './components/CartDrawer';
import Login from './pages/Login';
import AdminLogin from './pages/AdminLogin';
import Products from './pages/Products';
import Cart from './pages/Cart';
import Orders from './pages/Orders';
import AdminProducts from './pages/AdminProducts';
import Dashboard from './pages/Dashboard';

function Guard({ children, admin }: { children: ReactNode; admin?: boolean }) {
  const { user } = useAuth();
  if (!user) return <Navigate to={admin ? '/admin/login' : '/login'} replace />;
  if (admin && user.role !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  const { user, logout } = useAuth();
  const { count, setOpen } = useCart();
  const isAdmin = user?.role === 'admin';
  return (
    <>
      <nav>
        <div className="brand"><span className="logo"><Boxes size={18} /></span>Stockly</div>
        {user && <NavLink to="/" end><Store size={16} />Shop</NavLink>}
        {user && <NavLink to="/orders"><ShoppingBag size={16} />{isAdmin ? 'All orders' : 'My orders'}</NavLink>}
        {isAdmin && <NavLink to="/admin/products"><Package size={16} />Products</NavLink>}
        {isAdmin && <NavLink to="/admin/dashboard"><BarChart3 size={16} />Insights</NavLink>}
        <span className="spacer" />
        {user && (
          <>
            <button className="secondary cart-btn" onClick={() => setOpen(true)} aria-label="Open cart">
              <ShoppingCart size={16} />Cart{count > 0 && <span className="count">{count}</span>}
            </button>
            <span className="badge confirmed">{user.role}</span>
            <span className="avatar" title={user.email}>{user.email[0].toUpperCase()}</span>
            <button className="secondary" onClick={logout}><LogOut size={15} />Logout</button>
          </>
        )}
      </nav>
      <main>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/" element={<Guard><Products /></Guard>} />
          <Route path="/cart" element={<Guard><Cart /></Guard>} />
          <Route path="/orders" element={<Guard><Orders /></Guard>} />
          <Route path="/admin/products" element={<Guard admin><AdminProducts /></Guard>} />
          <Route path="/admin/dashboard" element={<Guard admin><Dashboard /></Guard>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {user && <CartDrawer />}
    </>
  );
}
