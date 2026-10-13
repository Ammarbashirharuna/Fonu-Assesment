import { Link } from 'react-router-dom';
import { ArrowRight, ShoppingCart, X } from 'lucide-react';
import { useCart, usePlaceOrder } from '../cart';
import CartLines from './CartLines';

export default function CartDrawer() {
  const { lines, count, total, open, setOpen } = useCart();
  const place = usePlaceOrder(() => setOpen(false));
  return (
    <>
      <div className={`overlay ${open ? 'show' : ''}`} onClick={() => setOpen(false)} />
      <aside className={`drawer ${open ? 'open' : ''}`} aria-hidden={!open}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>Your cart {count > 0 && <span className="muted">({count})</span>}</h3>
          <button className="secondary icon-btn" onClick={() => setOpen(false)} aria-label="Close cart"><X size={16} /></button>
        </div>
        <div className="drawer-body">
          {lines.length === 0 ? (
            <div className="empty"><ShoppingCart size={32} /><p>Your cart is empty.</p></div>
          ) : <CartLines />}
        </div>
        <div className="drawer-foot">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="muted">Total</span><h3 style={{ margin: 0 }}>${total.toFixed(2)}</h3>
          </div>
          <button style={{ width: '100%', marginTop: 12 }} disabled={!lines.length || place.isPending} onClick={() => place.mutate()}>
            {place.isPending ? 'Placing order...' : 'Place order'}
          </button>
          <Link to="/cart" onClick={() => setOpen(false)} className="link-center">View full cart <ArrowRight size={14} /></Link>
        </div>
      </aside>
    </>
  );
}
