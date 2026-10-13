import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { api, errMsg, type Page, type Product } from '../api';
import { ConfirmDialog, Modal } from '../components/Modal';
import { tile } from '../tile';
import { useToast } from '../toast';

const empty = { name: '', description: '', price: '', stock: '' };

export default function AdminProducts() {
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<Product | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [toDelete, setToDelete] = useState<Product | null>(null);

  const list = useQuery({
    queryKey: ['admin-products'],
    queryFn: async () => (await api.get<Page<Product>>('/products', { params: { limit: 100, includeInactive: true } })).data,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin-products'] });
    qc.invalidateQueries({ queryKey: ['products'] });
  };

  const openCreate = () => { setEditing(null); setForm(empty); setFormError(''); setFormOpen(true); };
  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({ name: p.name, description: p.description ?? '', price: String(p.price), stock: String(p.stock) });
    setFormError('');
    setFormOpen(true);
  };
  const closeForm = () => setFormOpen(false);

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        price: Number(form.price),
        stock: Number(form.stock),
      };
      return editing ? api.patch(`/products/${editing.id}`, body) : api.post('/products', body);
    },
    onSuccess: () => {
      toast('ok', editing ? 'Product updated' : 'Product created');
      setFormOpen(false);
      refresh();
    },
    onError: (e) => setFormError(errMsg(e)),
  });

  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/products/${id}`),
    onSuccess: () => { toast('ok', 'Product deactivated'); setToDelete(null); refresh(); },
    onError: (e) => { toast('error', errMsg(e)); setToDelete(null); },
  });

  const submit = (e: FormEvent) => { e.preventDefault(); setFormError(''); save.mutate(); };
  const set = (k: keyof typeof empty) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  return (
    <>
      <div className="page-head">
        <div><h2>Products</h2><p className="muted">Manage your catalogue and stock levels.</p></div>
        <button onClick={openCreate}><Plus size={16} />Add product</button>
      </div>

      {list.isLoading && <div className="skeleton" style={{ height: 240 }} />}
      {list.error && <div className="error">{errMsg(list.error)}</div>}

      {list.data && (
        <table>
          <thead><tr><th>Product</th><th>Price</th><th>Stock</th><th>Status</th><th /></tr></thead>
          <tbody>
            {list.data.data.map((p) => (
              <tr key={p.id}>
                <td>
                  <div className="row">
                    <div className="mini sm" style={tile(p.name)}>{p.name[0]?.toUpperCase()}</div>
                    <strong>{p.name}</strong>
                  </div>
                </td>
                <td>${p.price.toFixed(2)}</td>
                <td><span className={`stock ${p.stock === 0 ? 'out' : p.stock <= 5 ? 'low' : ''}`}>{p.stock}</span></td>
                <td><span className={`badge ${p.isActive ? 'confirmed' : 'cancelled'}`}>{p.isActive ? 'Active' : 'Inactive'}</span></td>
                <td>
                  <div className="row" style={{ justifyContent: 'flex-end' }}>
                    <button className="secondary" onClick={() => openEdit(p)}><Pencil size={14} />Edit</button>
                    {p.isActive && <button className="danger" onClick={() => setToDelete(p)}><Trash2 size={14} />Delete</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editing ? 'Edit product' : 'Add product'}
        subtitle={editing ? 'Update details and stock.' : 'Add a new item to the catalogue.'}
        footer={
          <>
            <button type="button" className="secondary" onClick={closeForm}>Cancel</button>
            <button type="submit" form="product-form" disabled={save.isPending}>
              {save.isPending ? 'Saving...' : editing ? 'Save changes' : 'Create product'}
            </button>
          </>
        }
      >
        <form id="product-form" onSubmit={submit} className="form">
          {formError && <div className="error">{formError}</div>}
          <label>Name<input value={form.name} onChange={set('name')} placeholder="e.g. Wireless mouse" required autoFocus /></label>
          <div className="form-2">
            <label>Price (USD)<input type="number" step="0.01" min="0" value={form.price} onChange={set('price')} placeholder="0.00" required /></label>
            <label>Stock<input type="number" step="1" min="0" value={form.stock} onChange={set('stock')} placeholder="0" required /></label>
          </div>
          <label>Description<textarea rows={3} value={form.description} onChange={set('description')} placeholder="Optional" /></label>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        title="Delete this product?"
        message={`"${toDelete?.name}" will be hidden from the shop. Existing orders keep their history.`}
        confirmLabel="Delete product"
        busy={del.isPending}
        onConfirm={() => toDelete && del.mutate(toDelete.id)}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}
