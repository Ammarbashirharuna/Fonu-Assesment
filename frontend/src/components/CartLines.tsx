import { Minus, Plus, Trash2 } from 'lucide-react';
import { useCart } from '../cart';
import { tile } from '../tile';

export default function CartLines() {
  const { lines, setQty, remove } = useCart();
  return (
    <>
      {lines.map(({ product: p, qty }) => (
        <div className="line" key={p.id}>
          <div className="mini" style={tile(p.name)}>{p.name[0]?.toUpperCase()}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong>{p.name}</strong>
            <div className="muted">${p.price.toFixed(2)} each{p.stock <= 5 && <span className="stock low"> · only {p.stock} left</span>}</div>
            <div className="stepper">
              <button type="button" className="secondary" onClick={() => setQty(p, qty - 1)} aria-label="Decrease"><Minus size={13} /></button>
              <input
                className="qty" type="number" min={1} max={p.stock} value={qty}
                onChange={(e) => setQty(p, Number(e.target.value) || 1)}
                aria-label={`Quantity for ${p.name}`}
              />
              <button type="button" className="secondary" disabled={qty >= p.stock} onClick={() => setQty(p, qty + 1)} aria-label="Increase"><Plus size={13} /></button>
            </div>
          </div>
          <div className="col-end">
            <strong>${(p.price * qty).toFixed(2)}</strong>
            <button type="button" className="danger" onClick={() => remove(p.id)} aria-label={`Remove ${p.name}`}><Trash2 size={14} /></button>
          </div>
        </div>
      ))}
    </>
  );
}
