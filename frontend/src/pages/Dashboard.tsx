import { useQuery } from '@tanstack/react-query';
import { DollarSign, Receipt, ShoppingBag, TrendingUp } from 'lucide-react';
import { api, errMsg } from '../api';

interface Summary {
  orderCount: number; totalRevenue: number; averageOrderValue: number;
  ordersByStatus: Record<string, number>;
  topProducts: { productId: string; name: string; unitsSold: number; revenue: number }[];
}

const money = (n: number) => n.toLocaleString(undefined, { style: 'currency', currency: 'USD' });

export default function Dashboard() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['summary'],
    queryFn: async () => (await api.get<Summary>('/reports/summary')).data,
  });

  if (isLoading) return (
    <div className="grid">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 110 }} />)}</div>
  );
  if (error) return (
    <div className="error row" style={{ justifyContent: 'space-between' }}>
      <span>{errMsg(error)}</span><button className="secondary" onClick={() => refetch()}>Retry</button>
    </div>
  );
  if (!data) return null;

  const maxUnits = Math.max(...data.topProducts.map((t) => t.unitsSold), 1);
  const statuses = Object.entries(data.ordersByStatus);
  const totalOrders = Math.max(data.orderCount, 1);

  const stats = [
    { label: 'Orders', value: String(data.orderCount), icon: ShoppingBag },
    { label: 'Revenue', value: money(data.totalRevenue), icon: DollarSign },
    { label: 'Avg order value', value: money(data.averageOrderValue), icon: Receipt },
  ];

  return (
    <>
      <div className="page-head">
        <div><h2>Insights</h2><p className="muted">Computed by the Go reporting service. Cancelled orders excluded.</p></div>
      </div>
      <div className="grid">
        {stats.map(({ label, value, icon: Icon }) => (
          <div className="card stat" key={label}>
            <div className="stat-icon"><Icon size={18} /></div>
            <div className="muted">{label}</div>
            <h2>{value}</h2>
          </div>
        ))}
      </div>

      <div className="two-col">
        <div className="card">
          <h3><TrendingUp size={16} style={{ verticalAlign: -2, marginRight: 6 }} />Top products</h3>
          {data.topProducts.length === 0 && <p className="muted">No sales yet.</p>}
          {data.topProducts.map((t) => (
            <div className="bar-row" key={t.productId}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span>{t.name}</span><span className="muted">{t.unitsSold} units · {money(t.revenue)}</span>
              </div>
              <div className="bar"><div style={{ width: `${(t.unitsSold / maxUnits) * 100}%` }} /></div>
            </div>
          ))}
        </div>
        <div className="card">
          <h3>Order status</h3>
          <div className="seg">
            {statuses.map(([s, n]) => <div key={s} className={`seg-${s}`} style={{ width: `${(n / totalOrders) * 100}%` }} />)}
          </div>
          <div style={{ marginTop: 14 }}>
            {statuses.map(([s, n]) => (
              <div className="row" key={s} style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                <span className={`badge ${s}`}>{s}</span><strong>{n}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
