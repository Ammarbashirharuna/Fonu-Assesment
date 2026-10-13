import { useQuery } from '@tanstack/react-query';
import { api, errMsg } from '../api';

interface Summary {
  orderCount: number; totalRevenue: number; averageOrderValue: number;
  ordersByStatus: Record<string, number>;
  topProducts: { productId: string; name: string; unitsSold: number; revenue: number }[];
}

export default function Dashboard() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['summary'],
    queryFn: async () => (await api.get<Summary>('/reports/summary')).data,
  });

  if (isLoading) return <p>Loading...</p>;
  if (error) return (
    <div className="error">{errMsg(error)} <button className="secondary" onClick={() => refetch()}>Retry</button></div>
  );
  if (!data) return null;

  return (
    <>
      <h2>Sales summary</h2>
      <div className="grid">
        <div className="card"><div className="muted">Orders</div><h2>{data.orderCount}</h2></div>
        <div className="card"><div className="muted">Revenue</div><h2>${data.totalRevenue.toFixed(2)}</h2></div>
        <div className="card"><div className="muted">Avg order value</div><h2>${data.averageOrderValue.toFixed(2)}</h2></div>
      </div>
      <p>{Object.entries(data.ordersByStatus).map(([s, n]) => <span key={s} className={`badge ${s}`} style={{ marginRight: 8 }}>{s}: {n}</span>)}</p>
      <h3>Top products</h3>
      <table>
        <thead><tr><th>Product</th><th>Units</th><th>Revenue</th></tr></thead>
        <tbody>{data.topProducts.map((t) => <tr key={t.productId}><td>{t.name}</td><td>{t.unitsSold}</td><td>${t.revenue.toFixed(2)}</td></tr>)}</tbody>
      </table>
      <p className="muted">Computed by the Go reporting service.</p>
    </>
  );
}
