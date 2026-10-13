import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PackageSearch, Plus, Search } from 'lucide-react';
import { api, errMsg, type Page, type Product } from '../api';
import { useCart } from '../cart';
import { tile } from '../tile';

export default function Products() {
  const { lines, add } = useCart();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ['products', search, page],
    queryFn: async () =>
      (await api.get<Page<Product>>('/products', { params: { search: search || undefined, page, limit: 12 } })).data,
  });

  const inCartQty = (id: string) => lines.find((l) => l.product.id === id)?.qty ?? 0;

  return (
    <>
      <div className="page-head">
        <div><h2>Shop</h2><p className="muted">Live stock, safe checkout.</p></div>
        <div className="search">
          <Search size={16} />
          <input placeholder="Search products" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
      </div>

      {error && <div className="error">{errMsg(error)}</div>}
      {isLoading && (
        <div className="grid">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 250 }} />)}</div>
      )}
      {data?.data.length === 0 && <div className="empty"><PackageSearch size={36} /><p>No products found.</p></div>}

      <div className="grid">
        {data?.data.map((p) => {
          const q = inCartQty(p.id);
          return (
            <div className="card product" key={p.id}>
              <div className="thumb" style={tile(p.name)}>{p.name[0]?.toUpperCase()}</div>
              <div className="row" style={{ justifyContent: 'space-between', marginTop: 14 }}>
                <strong>{p.name}</strong>
                <span className="price">${p.price.toFixed(2)}</span>
              </div>
              <p className="muted clamp">{p.description || 'No description.'}</p>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className={`stock ${p.stock === 0 ? 'out' : p.stock <= 5 ? 'low' : ''}`}>
                  {p.stock === 0 ? 'Out of stock' : p.stock <= 5 ? `Only ${p.stock} left` : `${p.stock} in stock`}
                </span>
                <button disabled={p.stock === 0 || q >= p.stock} onClick={() => add(p)}>
                  <Plus size={15} />{q ? `Add (${q})` : 'Add'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {data && data.meta.totalPages > 1 && (
        <div className="row pager">
          <button className="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
          <span className="muted">Page {data.meta.page} of {data.meta.totalPages}</span>
          <button className="secondary" disabled={page >= data.meta.totalPages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
    </>
  );
}
