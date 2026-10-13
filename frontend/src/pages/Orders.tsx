import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errMsg, type Order, type Page, type Product } from '../api';
import { useAuth } from '../auth';

export default function Orders() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isAdmin = user?.role === 'admin';
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const orders = useQuery({
    queryKey: ['orders', page, status],
    queryFn: async () => (await api.get<Page<Order>>('/orders', { params: { page, limit: 10, status: status || undefined } })).data,
  });
  const products = useQuery({
    queryKey: ['product-names'],
    queryFn: async () => (await api.get<Page<Product>>('/products', { params: { limit: 100, includeInactive: isAdmin || undefined } })).data,
  });
  const names = new Map(products.data?.data.map((p) => [p.id, p.name]));

  const act = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'confirm' | 'cancel' }) => api.post(`/orders/${id}/${action}`),
    onSuccess: () => { setError(''); qc.invalidateQueries({ queryKey: ['orders'] }); qc.invalidateQueries({ queryKey: ['products'] }); },
    onError: (e) => setError(errMsg(e)),
  });

  return (
    <>
      <div className="row">
        <h2 style={{ flex: 1 }}>{isAdmin ? 'All orders' : 'My orders'}</h2>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>
      {error && <div className="error">{error}</div>}
      {orders.isLoading && [0,1,2].map((i) => <div key={i} className="skeleton" style={{ height: 120, marginBottom: 14 }} />)}
      {orders.error && <div className="error">{errMsg(orders.error)}</div>}
      {orders.data?.data.length === 0 && <p className="muted">No orders yet.</p>}
      {orders.data?.data.map((o) => (
        <div className="card" key={o.id}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span><strong>#{o.id.slice(0, 8)}</strong> <span className="muted">{new Date(o.createdAt).toLocaleString()}</span></span>
            <span className={`badge ${o.status}`}>{o.status}</span>
          </div>
          <ul>
            {o.items.map((i) => (
              <li key={i.id}>{names.get(i.productId) ?? i.productId.slice(0, 8)} × {i.quantity} @ ${i.unitPrice.toFixed(2)}</li>
            ))}
          </ul>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <strong>Total ${o.total.toFixed(2)}</strong>
            {o.status === 'pending' && (
              <span className="row">
                {isAdmin && <button disabled={act.isPending} onClick={() => act.mutate({ id: o.id, action: 'confirm' })}>Confirm</button>}
                <button className="danger" disabled={act.isPending} onClick={() => act.mutate({ id: o.id, action: 'cancel' })}>Cancel</button>
              </span>
            )}
          </div>
        </div>
      ))}
      {orders.data && (
        <div className="row">
          <button className="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
          <span className="muted">Page {orders.data.meta.page} of {Math.max(orders.data.meta.totalPages, 1)}</span>
          <button className="secondary" disabled={page >= orders.data.meta.totalPages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
    </>
  );
}
