import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errMsg, type Page, type Product } from '../api';

const empty = { name: '', description: '', price: '', stock: '' };

export default function AdminProducts() {
  const qc = useQueryClient();
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState('');

  const list = useQuery({
    queryKey: ['admin-products'],
    queryFn: async () => (await api.get<Page<Product>>('/products', { params: { limit: 100, includeInactive: true } })).data,
  });

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name,
        description: form.description || undefined,
        price: Number(form.price),
        stock: Number(form.stock),
      };
      return editing ? api.patch(`/products/${editing}`, body) : api.post('/products', body);
    },
    onSuccess: () => { setForm(empty); setEditing(null); setError(''); qc.invalidateQueries({ queryKey: ['admin-products'] }); qc.invalidateQueries({ queryKey: ['products'] }); },
    onError: (e) => setError(errMsg(e)),
  });

  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/products/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-products'] }),
    onError: (e) => setError(errMsg(e)),
  });

  const edit = (p: Product) => {
    setEditing(p.id);
    setForm({ name: p.name, description: p.description ?? '', price: String(p.price), stock: String(p.stock) });
  };
  const submit = (e: FormEvent) => { e.preventDefault(); save.mutate(); };
  const set = (k: keyof typeof empty) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  return (
    <>
      <form className="card" onSubmit={submit}>
        <h3>{editing ? 'Edit product' : 'Add product'}</h3>
        {error && <div className="error">{error}</div>}
        <div className="grid">
          <input placeholder="Name" value={form.name} onChange={set('name')} required />
          <input placeholder="Price" type="number" step="0.01" min="0" value={form.price} onChange={set('price')} required />
          <input placeholder="Stock" type="number" min="0" step="1" value={form.stock} onChange={set('stock')} required />
        </div>
        <p><textarea placeholder="Description" value={form.description} onChange={set('description')} /></p>
        <div className="row">
          <button disabled={save.isPending}>{editing ? 'Save changes' : 'Create'}</button>
          {editing && <button type="button" className="secondary" onClick={() => { setEditing(null); setForm(empty); }}>Cancel</button>}
        </div>
      </form>

      {list.isLoading && <p>Loading...</p>}
      {list.error && <div className="error">{errMsg(list.error)}</div>}
      <table>
        <thead><tr><th>Name</th><th>Price</th><th>Stock</th><th>Status</th><th /></tr></thead>
        <tbody>
          {list.data?.data.map((p) => (
            <tr key={p.id}>
              <td>{p.name}</td><td>${p.price.toFixed(2)}</td><td>{p.stock}</td>
              <td>{p.isActive ? 'Active' : 'Inactive'}</td>
              <td className="row">
                <button className="secondary" onClick={() => edit(p)}>Edit</button>
                {p.isActive && <button className="danger" disabled={del.isPending} onClick={() => confirm(`Deactivate ${p.name}?`) && del.mutate(p.id)}>Delete</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
