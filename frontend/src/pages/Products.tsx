import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errMsg, type Order, type Page, type Product } from '../api';

export default function Products() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [cart, setCart] = useState<Record<string, { p: Product; qty: number }>>({});
  const [msg, setMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['products', search, page],
    queryFn: async () => (await api.get<Page<Product>>('/products', { params: { search: search || undefined, page, limit: 12 } })).data,
  });

  const add = (p: Product) =>
    setCart((c) => {
      const qty = Math.min((c[p.id]?.qty ?? 0) + 1, p.stock);
      return { ...c, [p.id]: { p, qty } };
    });
  const remove = (id: string) => setCart((c) => { const n = { ...c }; delete n[id]; return n; });

  const lines = Object.values(cart);
  const total = lines.reduce((s, l) => s + l.p.price * l.qty, 0);

  const order = useMutation({
    mutationFn: async () =>
      (await api.post<Order>('/orders', { items: lines.map((l) => ({ productId: l.p.id, quantity: l.qty })) })).data,
    onSuccess: (o) => {
      setCart({});
      setMsg({ type: 'ok', text: `Order placed (total ${o.total.toFixed(2)})` });
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (e) => {
      setMsg({ type: 'error', text: errMsg(e) });
      qc.invalidateQueries({ queryKey: ['products'] });
    },
  });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }}>
      <section>
        <input placeholder="Search products..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <br /><br />
        {msg && <div className={msg.type}>{msg.text}</div>}
        {isLoading && <p>Loading...</p>}
        {error && <div className="error">{errMsg(error)}</div>}
        <div className="grid">
          {data?.data.map((p) => (
            <div className="card" key={p.id}>
              <strong>{p.name}</strong>
              <p className="muted">{p.description}</p>
              <p>${p.price.toFixed(2)} <span className="muted">· {p.stock} in stock</span></p>
              <button disabled={p.stock === 0 || (cart[p.id]?.qty ?? 0) >= p.stock} onClick={() => add(p)}>
                {p.stock === 0 ? 'Out of stock' : 'Add to cart'}
              </button>
            </div>
          ))}
        </div>
        {data && (
          <div className="row">
            <button className="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
            <span className="muted">Page {data.meta.page} of {Math.max(data.meta.totalPages, 1)}</span>
            <button className="secondary" disabled={page >= data.meta.totalPages} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        )}
      </section>
      <aside className="card" style={{ alignSelf: 'start' }}>
        <h3>Cart</h3>
        {lines.length === 0 && <p className="muted">Empty</p>}
        {lines.map(({ p, qty }) => (
          <div className="row" key={p.id} style={{ justifyContent: 'space-between' }}>
            <span>{p.name} × {qty}</span>
            <button className="secondary" onClick={() => remove(p.id)}>x</button>
          </div>
        ))}
        <p><strong>Total: ${total.toFixed(2)}</strong></p>
        <button disabled={!lines.length || order.isPending} onClick={() => order.mutate()}>
          {order.isPending ? 'Placing...' : 'Place order'}
        </button>
      </aside>
    </div>
  );
}
