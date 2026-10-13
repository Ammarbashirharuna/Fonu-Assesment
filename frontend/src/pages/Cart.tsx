import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, ShieldCheck, Trash2 } from 'lucide-react';
import { useCart, usePlaceOrder } from '../cart';
import CartLines from '../components/CartLines';
import { ConfirmDialog } from '../components/Modal';

export default function Cart() {
  const { lines, count, total, clear } = useCart();
  const nav = useNavigate();
  const place = usePlaceOrder(() => nav('/orders'));
  const [confirmClear, setConfirmClear] = useState(false);

  if (lines.length === 0) {
    return (
      <div className="empty" style={{ padding: '80px 0' }}>
        <ShoppingCart size={44} />
        <h3 style={{ marginTop: 12 }}>Your cart is empty</h3>
        <p>Add a few products and they will show up here.</p>
        <Link to="/"><button>Browse the shop</button></Link>
      </div>
    );
  }

  return (
    <>
      <div className="page-head">
        <div><h2>Your cart</h2><p className="muted">{count} item{count === 1 ? '' : 's'} ready to order.</p></div>
        <button className="danger" onClick={() => setConfirmClear(true)}><Trash2 size={14} />Clear cart</button>
      </div>
      <div className="cart-layout">
        <div className="card"><CartLines /></div>
        <aside className="card summary">
          <h3>Order summary</h3>
          <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted">Items</span><span>{count}</span></div>
          <div className="row" style={{ justifyContent: 'space-between', margin: '8px 0 14px' }}>
            <span className="muted">Subtotal</span><span>${total.toFixed(2)}</span>
          </div>
          <div className="row total" style={{ justifyContent: 'space-between' }}>
            <strong>Total</strong><h3 style={{ margin: 0 }}>${total.toFixed(2)}</h3>
          </div>
          <button style={{ width: '100%', marginTop: 16 }} disabled={place.isPending} onClick={() => place.mutate()}>
            {place.isPending ? 'Placing order...' : 'Place order'}
          </button>
          <p className="muted secure"><ShieldCheck size={14} /> Prices and stock are verified when you order.</p>
        </aside>
      </div>
      <ConfirmDialog
        open={confirmClear}
        title="Clear your cart?"
        message="All items will be removed from your cart. This cannot be undone."
        confirmLabel="Clear cart"
        onConfirm={() => { clear(); setConfirmClear(false); }}
        onCancel={() => setConfirmClear(false)}
      />
    </>
  );
}
