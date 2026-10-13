import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, errMsg, type Order, type Product } from './api';
import { useAuth } from './auth';
import { useToast } from './toast';

export interface CartLine { product: Product; qty: number }

interface CartCtx {
  lines: CartLine[];
  count: number;
  total: number;
  add: (p: Product, qty?: number) => void;
  setQty: (p: Product, qty: number) => void;
  remove: (id: string) => void;
  clear: () => void;
  open: boolean;
  setOpen: (v: boolean) => void;
}

const Ctx = createContext<CartCtx>(null!);
export const useCart = () => useContext(Ctx);

const load = (key: string): CartLine[] => {
  try { return JSON.parse(localStorage.getItem(key) ?? '[]'); } catch { return []; }
};

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const key = user ? `cart:${user.email}` : null;
  const [lines, setLines] = useState<CartLine[]>([]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  // load this user's cart when they sign in, empty it when they sign out
  useEffect(() => { setLines(key ? load(key) : []); setLoadedKey(key); }, [key]);
  useEffect(() => {
    if (key && loadedKey === key) {
      try { localStorage.setItem(key, JSON.stringify(lines)); } catch { /* storage unavailable */ }
    }
  }, [lines, key, loadedKey]);

  const setQty = useCallback((p: Product, qty: number) => {
    const q = Math.min(Math.floor(qty), p.stock);
    setLines((ls) => {
      const rest = ls.filter((l) => l.product.id !== p.id);
      if (q < 1) return rest;
      const existing = ls.find((l) => l.product.id === p.id);
      // keep position stable when editing an existing line
      return existing
        ? ls.map((l) => (l.product.id === p.id ? { product: p, qty: q } : l))
        : [...rest, { product: p, qty: q }];
    });
  }, []);

  const add = useCallback((p: Product, qty = 1) => {
    setLines((ls) => {
      const cur = ls.find((l) => l.product.id === p.id)?.qty ?? 0;
      const q = Math.min(cur + qty, p.stock);
      if (q < 1) return ls;
      return cur
        ? ls.map((l) => (l.product.id === p.id ? { product: p, qty: q } : l))
        : [...ls, { product: p, qty: q }];
    });
  }, []);

  const remove = useCallback((id: string) => setLines((ls) => ls.filter((l) => l.product.id !== id)), []);
  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<CartCtx>(() => ({
    lines,
    count: lines.reduce((s, l) => s + l.qty, 0),
    total: lines.reduce((s, l) => s + l.product.price * l.qty, 0),
    add, setQty, remove, clear, open, setOpen,
  }), [lines, add, setQty, remove, clear, open]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Places the current cart as an order. The server recomputes prices and re-checks stock. */
export function usePlaceOrder(onSuccess?: (o: Order) => void) {
  const { lines, clear } = useCart();
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: async () =>
      (await api.post<Order>('/orders', {
        items: lines.map((l) => ({ productId: l.product.id, quantity: l.qty })),
      })).data,
    onSuccess: (o) => {
      clear();
      toast('ok', `Order placed. Total $${o.total.toFixed(2)}`);
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      onSuccess?.(o);
    },
    onError: (e) => {
      toast('error', errMsg(e));
      qc.invalidateQueries({ queryKey: ['products'] }); // refresh stock so the user can adjust
    },
  });
}
