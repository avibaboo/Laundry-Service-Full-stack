import React, { useEffect, useState, useRef, useCallback } from 'react';
import axios from 'axios';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import useSocket from '../hooks/useSocket';
import { toast } from '../hooks/useToast';
import { KpiCardSkeleton } from '../components/Skeleton/Skeleton';

// ── Constants ──────────────────────────────────────────────────────
const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

const ORDER_STATUSES = [
  'PENDING', 'CONFIRMED', 'PICKED_UP', 'WASHING',
  'DRYING', 'FOLDING', 'QUALITY_CHECK', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED',
];

const KANBAN_COLS = [
  { key: 'PENDING',          label: 'Pending',        color: '#F59E0B', dot: '#F59E0B' },
  { key: 'CONFIRMED',        label: 'Confirmed',      color: '#3B82F6', dot: '#3B82F6' },
  { key: 'PICKED_UP',        label: 'Picked Up',      color: '#6366F1', dot: '#6366F1' },
  { key: 'WASHING',          label: 'Washing',        color: '#8B5CF6', dot: '#8B5CF6' },
  { key: 'OUT_FOR_DELIVERY', label: 'Out for Delivery',color: '#EC4899', dot: '#EC4899' },
  { key: 'DELIVERED',        label: 'Delivered',      color: '#10B981', dot: '#10B981' },
];

const STATUS_BADGE = {
  PENDING:          'badge-warning',
  CONFIRMED:        'badge-primary',
  PICKED_UP:        'badge-primary',
  WASHING:          'badge-purple',
  DRYING:           'badge-purple',
  FOLDING:          'badge-purple',
  QUALITY_CHECK:    'badge-purple',
  OUT_FOR_DELIVERY: 'badge-purple',
  DELIVERED:        'badge-success',
  CANCELLED:        'badge-danger',
};

function getInitials(name) {
  return (name || 'UN').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

// Generate last N-day labels
function getDateLabels(days) {
  const labels = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    labels.push(d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }));
  }
  return labels;
}

// Aggregate orders into chart data
function buildChartData(orders, days) {
  const labels = getDateLabels(days);
  const map = {};
  labels.forEach(l => { map[l] = { date: l, orders: 0, revenue: 0 }; });

  orders.forEach(order => {
    const d = new Date(order.createdAt);
    const label = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    if (map[label]) {
      map[label].orders++;
      map[label].revenue += parseFloat(order.finalAmount || 0);
    }
  });

  return labels.map(l => map[l]);
}

// ── Custom recharts tooltip ────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#1E2A3B', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 12, padding: '12px 16px', color: '#F1F5F9',
    }}>
      <div style={{ fontSize: '0.78rem', color: '#94A3B8', marginBottom: 8 }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.84rem', marginBottom: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
          <span style={{ color: '#94A3B8' }}>{p.name}:</span>
          <strong style={{ color: '#F1F5F9' }}>
            {p.dataKey === 'revenue' ? `₹${p.value.toFixed(0)}` : p.value}
          </strong>
        </div>
      ))}
    </div>
  );
};

// ── Animated count-up hook ─────────────────────────────────────────
function useCountUp(target, duration = 1200) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start = Math.min(start + step, target);
      setVal(Math.floor(start));
      if (start >= target) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return val;
}

// ── Component ──────────────────────────────────────────────────────
const AdminDashboard = () => {
  const [activeTab, setActiveTab]   = useState('overview');
  const [services, setServices]     = useState([]);
  const [newService, setNewService] = useState({ name: '', description: '', unitType: 'KG', pricePerUnit: '', estimatedMinutes: '' });
  const [orders, setOrders]         = useState([]);
  const [customers, setCustomers]   = useState([]);
  const [priceEdits, setPriceEdits] = useState({});
  const [loading, setLoading]       = useState(false);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [chartDays, setChartDays]   = useState(7);
  const [searchCustomer, setSearchCustomer] = useState('');
  const [expandedCustomer, setExpandedCustomer] = useState(null);
  const [draggedOrder, setDraggedOrder] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);
  const socket = useSocket();

  // ── Fetch helpers ────────────────────────────────────────────────
  const fetchServices = useCallback(() => {
    axios.get(`${API}/services`).then(res => {
      setServices(res.data);
      const edits = {};
      res.data.forEach(s => { edits[s.id] = s.pricePerUnit; });
      setPriceEdits(edits);
    }).catch(() => toast.error('Error', 'Failed to load services.'));
  }, []);

  const fetchOrders = useCallback(() => {
    axios.get(`${API}/admin/orders`).then(res => {
      setOrders(res.data);
    }).catch(() => toast.error('Error', 'Failed to load orders.'));
  }, []);

  const fetchCustomers = useCallback(() => {
    axios.get(`${API}/admin/users`).then(res => {
      setCustomers(res.data.filter(u => u.role === 'CUSTOMER'));
    }).catch(() => toast.error('Error', 'Failed to load customers.'));
  }, []);

  useEffect(() => {
    setKpiLoading(true);
    Promise.all([
      axios.get(`${API}/services`),
      axios.get(`${API}/admin/orders`),
      axios.get(`${API}/admin/users`),
    ]).then(([svc, ord, usr]) => {
      setServices(svc.data);
      const edits = {};
      svc.data.forEach(s => { edits[s.id] = s.pricePerUnit; });
      setPriceEdits(edits);
      setOrders(ord.data);
      setCustomers(usr.data.filter(u => u.role === 'CUSTOMER'));
    }).catch(() => toast.error('Error', 'Failed to load dashboard data.'))
    .finally(() => setKpiLoading(false));
  }, []);

  // ── Socket listeners ─────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;
    socket.on('newOrderAlert', (data) => {
      fetchOrders();
      toast.success('🆕 New Order!', `From ${data.orderSummary?.customerName} — ₹${parseFloat(data.orderSummary?.finalAmount || 0).toFixed(2)}`);
    });
    return () => socket.off('newOrderAlert');
  }, [socket, fetchOrders]);

  // ── KPI calculations ─────────────────────────────────────────────
  const totalRevenue = orders
    .filter(o => o.paymentStatus === 'PAID')
    .reduce((sum, o) => sum + parseFloat(o.finalAmount || 0), 0);

  const activeOrders = orders.filter(o =>
    !['DELIVERED', 'CANCELLED'].includes(o.status)
  ).length;

  const newCustomers = customers.filter(c => {
    const created = new Date(c.createdAt);
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    return created > weekAgo;
  }).length;

  const deliveredOrders = orders.filter(o => o.status === 'DELIVERED');
  const avgDelivery = deliveredOrders.length
    ? (deliveredOrders.reduce((sum, o) => {
        if (o.scheduledPickupTime && o.actualDeliveryTime) {
          return sum + (new Date(o.actualDeliveryTime) - new Date(o.scheduledPickupTime)) / 3600000;
        }
        return sum + 24;
      }, 0) / deliveredOrders.length).toFixed(1)
    : '--';

  // Chart data
  const chartData = buildChartData(orders, chartDays);

  // ── Animated KPI values ───────────────────────────────────────────
  const animRevenue = useCountUp(Math.floor(totalRevenue));
  const animActive  = useCountUp(activeOrders);
  const animCust    = useCountUp(customers.length);

  // ── Order status update ───────────────────────────────────────────
  const handleUpdateStatus = async (orderId, status) => {
    try {
      await axios.put(`${API}/admin/orders/${orderId}/status`, { status });
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
      toast.success('✅ Status Updated', `Order moved to "${status.replace(/_/g, ' ')}"`);
    } catch {
      toast.error('Error', 'Failed to update order status.');
    }
  };

  // ── Drag and Drop ─────────────────────────────────────────────────
  const handleDragStart = (e, order) => {
    setDraggedOrder(order);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, colKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCol(colKey);
  };

  const handleDrop = (e, colKey) => {
    e.preventDefault();
    if (draggedOrder && draggedOrder.status !== colKey) {
      handleUpdateStatus(draggedOrder.id, colKey);
    }
    setDraggedOrder(null);
    setDragOverCol(null);
  };

  const handleDragEnd = () => {
    setDraggedOrder(null);
    setDragOverCol(null);
  };

  // ── Price update ───────────────────────────────────────────────────
  const handleUpdatePrice = async (serviceId) => {
    try {
      await axios.put(`${API}/services/${serviceId}/price`, {
        pricePerUnit: parseFloat(priceEdits[serviceId]),
      });
      fetchServices();
      toast.success('💰 Price Updated', 'Customers will see the new price instantly.');
    } catch {
      toast.error('Error', 'Failed to update price.');
    }
  };

  // ── Toggle service visibility ─────────────────────────────────────
  const handleToggleService = async (serviceId, isActive) => {
    try {
      await axios.put(`${API}/services/${serviceId}/toggle`, { isActive: !isActive });
      fetchServices();
      toast.info('Service Updated', `Service ${!isActive ? 'activated' : 'deactivated'}.`);
    } catch {
      toast.error('Error', 'Failed to toggle service.');
    }
  };

  // ── Add Service ──────────────────────────────────────────────────
  const handleAddService = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/services`, newService);
      fetchServices();
      setNewService({ name: '', description: '', unitType: 'KG', pricePerUnit: '', estimatedMinutes: '' });
      toast.success('🎉 Service Added', 'New service added successfully.');
    } catch {
      toast.error('Error', 'Failed to add service.');
    }
  };

  // ── Delete Service ───────────────────────────────────────────────
  const handleDeleteService = async (serviceId) => {
    if (!window.confirm('Are you sure you want to delete this service?')) return;
    try {
      await axios.delete(`${API}/services/${serviceId}`);
      fetchServices();
      toast.success('🗑️ Service Deleted', 'Service removed successfully.');
    } catch (err) {
      toast.error('Error', err.response?.data?.error || 'Failed to delete service. Try toggling visibility instead if it is linked to orders.');
    }
  };

  // ── Block / unblock user ─────────────────────────────────────────
  const handleToggleBlock = async (userId, isBlocked) => {
    try {
      await axios.put(`${API}/admin/users/${userId}/block`, { isBlocked: !isBlocked });
      fetchCustomers();
      toast.success(
        isBlocked ? '🔓 User Unblocked' : '🔒 User Blocked',
        isBlocked ? 'Customer can now place orders.' : 'Customer is now restricted.',
      );
    } catch {
      toast.error('Error', 'Failed to update user status.');
    }
  };

  // ── Filtered customers ─────────────────────────────────────────────
  const filteredCustomers = customers.filter(c =>
    !searchCustomer ||
    c.fullName?.toLowerCase().includes(searchCustomer.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchCustomer.toLowerCase())
  );

  // ── Sidebar navigation items ─────────────────────────────────────
  const navItems = [
    { key: 'overview',   icon: '⊞', label: 'Overview' },
    { key: 'orders',     icon: '📋', label: 'Orders', count: orders.length },
    { key: 'services',   icon: '🏷️', label: 'Services', count: services.length },
    { key: 'customers',  icon: '👥', label: 'Customers', count: customers.length },
  ];

  const tabTitles = {
    overview:  'Dashboard Overview',
    orders:    'Order Management',
    services:  'Service Management',
    customers: 'Customer Management',
  };

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="admin-layout" role="application" aria-label="FreshWave Admin Dashboard">
      {/* ── SIDEBAR ──────────────────────────────────────────── */}
      <aside className="admin-sidebar" aria-label="Admin navigation">
        <div className="admin-sidebar-logo">
          <div className="admin-logo-mark" aria-hidden="true">🌊</div>
          <div>
            <div className="admin-logo-name">FreshWave</div>
            <div className="admin-logo-sub">Admin Portal</div>
          </div>
        </div>

        <nav className="admin-nav" aria-label="Dashboard sections">
          <div className="admin-nav-label">Navigation</div>
          {navItems.map(item => (
            <button
              key={item.key}
              className={`admin-nav-item ${activeTab === item.key ? 'active' : ''}`}
              onClick={() => setActiveTab(item.key)}
              aria-current={activeTab === item.key ? 'page' : undefined}
              id={`admin-nav-${item.key}`}
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
              {item.count !== undefined && (
                <span className="admin-nav-badge" aria-label={`${item.count} total`}>{item.count}</span>
              )}
            </button>
          ))}

          <div className="admin-nav-label" style={{ marginTop: 16 }}>Settings</div>
          <button className="admin-nav-item" aria-label="View live customer portal" onClick={() => window.open('/', '_blank')}>
            <span aria-hidden="true">👁️</span>
            Customer View
          </button>
        </nav>
      </aside>

      {/* ── MAIN CONTENT ─────────────────────────────────────── */}
      <div className="admin-main">
        {/* Top bar */}
        <header className="admin-topbar">
          <h1 className="admin-topbar-title">{tabTitles[activeTab]}</h1>
          <div className="admin-topbar-right">
            <div style={{ fontSize: '0.78rem', color: '#64748B' }}>
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            <div style={{
              width: 34, height: 34, borderRadius: '50%',
              background: 'linear-gradient(135deg, #3B82F6, #10B981)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.75rem', fontWeight: 700, color: '#fff',
            }} aria-label="Admin user">
              AD
            </div>
          </div>
        </header>

        <div className="admin-content">

          {/* ════ OVERVIEW TAB ════ */}
          {activeTab === 'overview' && (
            <div role="region" aria-label="Overview dashboard">
              {/* KPI Cards */}
              <div className="admin-kpi-grid" role="list" aria-label="Key performance indicators">
                {kpiLoading ? (
                  Array(4).fill(0).map((_, i) => <KpiCardSkeleton key={i} />)
                ) : (
                  <>
                    {[
                      { color: 'blue',   icon: '₹', label: 'Total Revenue',    value: `₹${animRevenue.toLocaleString('en-IN')}`, trend: '+12%', up: true },
                      { color: 'green',  icon: '📦', label: 'Active Orders',    value: animActive, trend: `${activeOrders} live`, up: true },
                      { color: 'amber',  icon: '👥', label: 'Total Customers',  value: animCust, trend: `+${newCustomers} this week`, up: true },
                      { color: 'purple', icon: '⏱', label: 'Avg Delivery (h)', value: avgDelivery, trend: 'target: 24h', up: false },
                    ].map(kpi => (
                      <div key={kpi.label} className={`admin-kpi-card ${kpi.color}`} role="listitem">
                        <div className="admin-kpi-header">
                          <div className={`admin-kpi-icon ${kpi.color}`} aria-hidden="true">{kpi.icon}</div>
                          <div className={`admin-kpi-trend ${kpi.up ? 'up' : 'down'}`}>{kpi.trend}</div>
                        </div>
                        <div className="admin-kpi-value" aria-label={`${kpi.label}: ${kpi.value}`}>{kpi.value}</div>
                        <div className="admin-kpi-label">{kpi.label}</div>
                      </div>
                    ))}
                  </>
                )}
              </div>

              {/* Revenue Chart */}
              <div className="admin-chart-card" role="region" aria-label="Revenue and orders chart">
                <div className="admin-chart-header">
                  <div>
                    <div className="admin-chart-title">Revenue & Order Volume</div>
                    <div className="admin-chart-sub">Daily breakdown from your order history</div>
                  </div>
                  <div className="admin-chart-tabs" role="group" aria-label="Chart time range">
                    {[7, 30].map(d => (
                      <button
                        key={d}
                        className={`admin-chart-tab ${chartDays === d ? 'active' : ''}`}
                        onClick={() => setChartDays(d)}
                        aria-pressed={chartDays === d}
                      >
                        {d}d
                      </button>
                    ))}
                  </div>
                </div>

                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#3B82F6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradOrders" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#10B981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: '#64748B', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="revenue"
                      orientation="left"
                      tick={{ fill: '#64748B', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={v => `₹${v}`}
                    />
                    <YAxis
                      yAxisId="orders"
                      orientation="right"
                      tick={{ fill: '#64748B', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      yAxisId="revenue"
                      type="monotone"
                      dataKey="revenue"
                      name="Revenue"
                      stroke="#3B82F6"
                      strokeWidth={2.5}
                      fill="url(#gradRevenue)"
                      dot={{ r: 3, fill: '#3B82F6', strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: '#3B82F6' }}
                    />
                    <Area
                      yAxisId="orders"
                      type="monotone"
                      dataKey="orders"
                      name="Orders"
                      stroke="#10B981"
                      strokeWidth={2.5}
                      fill="url(#gradOrders)"
                      dot={{ r: 3, fill: '#10B981', strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: '#10B981' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Recent orders mini-table */}
              <div className="admin-table-card">
                <div style={{ padding: '18px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="admin-section-title" style={{ fontSize: '1rem', marginBottom: 0 }}>Recent Orders</div>
                </div>
                <table className="admin-table" aria-label="Recent orders">
                  <thead>
                    <tr>
                      <th scope="col">Order ID</th>
                      <th scope="col">Customer</th>
                      <th scope="col">Amount</th>
                      <th scope="col">Status</th>
                      <th scope="col">Payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.slice(0, 8).map(order => (
                      <tr key={order.id}>
                        <td style={{ fontWeight: 600, color: '#F1F5F9', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                          #{order.id.slice(0, 8).toUpperCase()}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                            <div className="admin-customer-avatar" aria-hidden="true">
                              {getInitials(order.customer?.fullName)}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, color: '#E2E8F0', fontSize: '0.84rem' }}>{order.customer?.fullName || '—'}</div>
                              <div style={{ color: '#64748B', fontSize: '0.72rem' }}>{order.customer?.phone}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ fontWeight: 700, color: '#34D399' }}>₹{parseFloat(order.finalAmount || 0).toFixed(2)}</td>
                        <td>
                          <span className={`badge ${STATUS_BADGE[order.status] || 'badge-neutral'}`}>
                            {order.status?.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td>
                          <span style={{
                            color: order.paymentStatus === 'PAID' ? '#34D399' : '#FCD34D',
                            fontWeight: 600, fontSize: '0.8rem',
                          }}>
                            {order.paymentStatus}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {orders.length === 0 && (
                      <tr><td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: '#475569' }}>No orders yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ════ ORDERS TAB — KANBAN ════ */}
          {activeTab === 'orders' && (
            <div role="region" aria-label="Order management Kanban board">
              <div className="admin-section-title">Drag & Drop Kanban Board</div>
              <div className="admin-section-sub">
                Drag order cards between columns to update status — customers get notified instantly.
              </div>

              <div className="admin-kanban" role="list" aria-label="Order Kanban columns">
                {KANBAN_COLS.map(col => {
                  const colOrders = orders.filter(o => o.status === col.key);
                  return (
                    <div
                      key={col.key}
                      className={`admin-kanban-col ${dragOverCol === col.key ? 'drag-over' : ''}`}
                      role="listitem"
                      aria-label={`${col.label} column — ${colOrders.length} orders`}
                      onDragOver={e => handleDragOver(e, col.key)}
                      onDrop={e => handleDrop(e, col.key)}
                      onDragLeave={() => setDragOverCol(null)}
                    >
                      <div className="admin-kanban-col-header">
                        <div className="admin-kanban-col-title">
                          <div className="admin-kanban-col-dot" style={{ background: col.dot }} aria-hidden="true" />
                          {col.label}
                        </div>
                        <span className="admin-kanban-count">{colOrders.length}</span>
                      </div>

                      {colOrders.map(order => (
                        <div
                          key={order.id}
                          className={`admin-order-card ${draggedOrder?.id === order.id ? 'dragging' : ''}`}
                          draggable
                          onDragStart={e => handleDragStart(e, order)}
                          onDragEnd={handleDragEnd}
                          role="article"
                          aria-label={`Order from ${order.customer?.fullName || 'Unknown'}, ₹${parseFloat(order.finalAmount || 0).toFixed(2)}`}
                          tabIndex={0}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              const next = KANBAN_COLS[KANBAN_COLS.findIndex(c => c.key === order.status) + 1];
                              if (next) handleUpdateStatus(order.id, next.key);
                            }
                          }}
                        >
                          <div className="admin-order-card-header">
                            <div className="admin-customer-avatar" aria-hidden="true">
                              {getInitials(order.customer?.fullName)}
                            </div>
                            <span className="admin-order-customer">
                              {order.customer?.fullName || 'Unknown'}
                            </span>
                            <span style={{
                              fontSize: '0.62rem', fontFamily: 'monospace',
                              color: '#475569', flexShrink: 0
                            }}>
                              #{order.id.slice(0, 6)}
                            </span>
                          </div>
                          <div className="admin-order-card-meta">
                            <span className="admin-order-items">
                              📦 {order.totalQuantity || order.items?.length || 0} items
                            </span>
                            <span className="admin-order-amount">
                              ₹{parseFloat(order.finalAmount || 0).toFixed(0)}
                            </span>
                          </div>
                          {/* Quick status selector (keyboard fallback) */}
                          <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
                            <select
                              defaultValue={order.status}
                              id={`status-${order.id}`}
                              style={{
                                flex: 1, padding: '5px 8px', borderRadius: 7,
                                background: 'rgba(255,255,255,0.07)', color: '#F1F5F9',
                                border: '1px solid rgba(255,255,255,0.12)', fontSize: '0.72rem',
                                cursor: 'pointer',
                              }}
                              aria-label={`Change status for order ${order.id.slice(0, 8)}`}
                              onChange={() => {}}
                            >
                              {ORDER_STATUSES.map(s => (
                                <option key={s} value={s} style={{ background: '#1E2A3B' }}>
                                  {s.replace(/_/g, ' ')}
                                </option>
                              ))}
                            </select>
                            <button
                              style={{
                                padding: '5px 10px', background: 'rgba(59,130,246,0.15)',
                                color: '#60A5FA', border: '1px solid rgba(59,130,246,0.2)',
                                borderRadius: 7, cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700,
                                whiteSpace: 'nowrap',
                              }}
                              onClick={() => {
                                const sel = document.getElementById(`status-${order.id}`);
                                if (sel) handleUpdateStatus(order.id, sel.value);
                              }}
                              aria-label={`Update status for order ${order.id.slice(0, 8)}`}
                            >
                              Update
                            </button>
                          </div>
                        </div>
                      ))}

                      {colOrders.length === 0 && (
                        <div style={{
                          textAlign: 'center', padding: '24px 12px',
                          color: '#334155', fontSize: '0.78rem',
                          border: '1.5px dashed rgba(255,255,255,0.06)',
                          borderRadius: 10, marginTop: 4,
                        }}>
                          Drop orders here
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Also show CANCELLED as a mini-list */}
              {orders.filter(o => o.status === 'CANCELLED').length > 0 && (
                <div style={{ marginTop: 24 }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#F87171', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                    ✕ Cancelled Orders ({orders.filter(o => o.status === 'CANCELLED').length})
                  </div>
                  <div className="admin-table-card">
                    <table className="admin-table" aria-label="Cancelled orders">
                      <thead>
                        <tr>
                          <th>Order ID</th>
                          <th>Customer</th>
                          <th>Amount</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orders.filter(o => o.status === 'CANCELLED').map(o => (
                          <tr key={o.id}>
                            <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>#{o.id.slice(0, 8)}</td>
                            <td>{o.customer?.fullName}</td>
                            <td style={{ color: '#F87171' }}>₹{parseFloat(o.finalAmount || 0).toFixed(2)}</td>
                            <td>
                              <button
                                className="admin-actions-btn"
                                onClick={() => handleUpdateStatus(o.id, 'PENDING')}
                              >
                                Reopen
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════ SERVICES TAB ════ */}
          {activeTab === 'services' && (
            <div role="region" aria-label="Service management">
              <div className="admin-section-title">Service Catalogue</div>
              <div className="admin-section-sub">
                Toggle visibility, update prices — customers see changes instantly.
              </div>

              <div className="admin-table-card">
                <table className="admin-table" aria-label="Services list">
                  <thead>
                    <tr>
                      <th scope="col">Service</th>
                      <th scope="col">Unit</th>
                      <th scope="col">Est. Time</th>
                      <th scope="col">Price (₹)</th>
                      <th scope="col">Active</th>
                      <th scope="col">Save</th>
                    </tr>
                  </thead>
                  <tbody>
                    {services.length === 0 ? (
                      <tr><td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: '#475569' }}>No services found.</td></tr>
                    ) : services.map(service => (
                      <tr key={service.id}>
                        <td>
                          <div style={{ fontWeight: 700, color: '#E2E8F0' }}>{service.name}</div>
                          <div style={{ fontSize: '0.74rem', color: '#64748B', marginTop: 2 }}>{service.description}</div>
                        </td>
                        <td style={{ color: '#94A3B8' }}>{service.unitType}</td>
                        <td style={{ color: '#94A3B8' }}>{service.estimatedMinutes} min</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ color: '#64748B', fontSize: '0.82rem' }}>₹</span>
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              className="admin-price-input"
                              value={priceEdits[service.id] ?? service.pricePerUnit}
                              onChange={e => setPriceEdits(prev => ({ ...prev, [service.id]: e.target.value }))}
                              aria-label={`Price for ${service.name}`}
                              id={`price-${service.id}`}
                            />
                          </div>
                        </td>
                        <td>
                          <label className="admin-toggle" aria-label={`Toggle ${service.name} visibility`}>
                            <input
                              type="checkbox"
                              checked={service.isActive !== false}
                              onChange={() => handleToggleService(service.id, service.isActive !== false)}
                            />
                            <span className="admin-toggle-track" />
                          </label>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              style={{
                                padding: '6px 14px',
                                background: 'rgba(16,185,129,0.12)',
                                color: '#34D399',
                                border: '1px solid rgba(16,185,129,0.2)',
                                borderRadius: 8, cursor: 'pointer', fontWeight: 600,
                                fontSize: '0.78rem', transition: 'all 0.2s',
                              }}
                              onClick={() => handleUpdatePrice(service.id)}
                              aria-label={`Save price for ${service.name}`}
                              id={`save-price-${service.id}`}
                            >
                              Save ✓
                            </button>
                            <button
                              style={{
                                padding: '6px 14px',
                                background: 'rgba(239,68,68,0.12)',
                                color: '#F87171',
                                border: '1px solid rgba(239,68,68,0.2)',
                                borderRadius: 8, cursor: 'pointer', fontWeight: 600,
                                fontSize: '0.78rem', transition: 'all 0.2s',
                              }}
                              onClick={() => handleDeleteService(service.id)}
                              aria-label={`Delete ${service.name}`}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Add Service Form */}
              <div className="admin-table-card" style={{ marginTop: 24, padding: 24 }}>
                <div className="admin-section-title" style={{ fontSize: '1.1rem', marginBottom: 16 }}>Add New Service</div>
                <form onSubmit={handleAddService} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                  <input type="text" placeholder="Service Name" required value={newService.name} onChange={e => setNewService({...newService, name: e.target.value})} style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.05)', color: '#F1F5F9', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
                  <input type="text" placeholder="Description" required value={newService.description} onChange={e => setNewService({...newService, description: e.target.value})} style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.05)', color: '#F1F5F9', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
                  <select value={newService.unitType} onChange={e => setNewService({...newService, unitType: e.target.value})} style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.05)', color: '#F1F5F9', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}>
                    <option value="KG" style={{ background: '#1E2A3B' }}>KG</option>
                    <option value="PIECE" style={{ background: '#1E2A3B' }}>PIECE</option>
                  </select>
                  <input type="number" step="0.5" min="0" placeholder="Price (₹)" required value={newService.pricePerUnit} onChange={e => setNewService({...newService, pricePerUnit: e.target.value})} style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.05)', color: '#F1F5F9', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
                  <input type="number" min="0" placeholder="Est. Time (min)" required value={newService.estimatedMinutes} onChange={e => setNewService({...newService, estimatedMinutes: e.target.value})} style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.05)', color: '#F1F5F9', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
                  <button type="submit" className="admin-actions-btn" style={{ padding: '10px', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    + Add Service
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* ════ CUSTOMERS TAB ════ */}
          {activeTab === 'customers' && (
            <div role="region" aria-label="Customer management">
              <div className="admin-section-title">Customer Directory</div>
              <div className="admin-section-sub">
                Search, view order history, and manage customer access.
              </div>

              {/* Search bar */}
              <div className="admin-search-bar" role="search">
                <span style={{ color: '#64748B' }}>🔍</span>
                <input
                  type="search"
                  placeholder="Search by name or email…"
                  value={searchCustomer}
                  onChange={e => setSearchCustomer(e.target.value)}
                  aria-label="Search customers"
                  id="customer-search"
                />
                {searchCustomer && (
                  <button
                    style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}
                    onClick={() => setSearchCustomer('')}
                    aria-label="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="admin-table-card">
                <table className="admin-table" aria-label="Customers list">
                  <thead>
                    <tr>
                      <th scope="col">Customer</th>
                      <th scope="col">Contact</th>
                      <th scope="col">Total Spent</th>
                      <th scope="col">Status</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCustomers.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: '#475569' }}>
                          {searchCustomer ? 'No customers match your search.' : 'No customers yet.'}
                        </td>
                      </tr>
                    ) : filteredCustomers.map(c => (
                      <React.Fragment key={c.id}>
                        <tr
                          style={{ cursor: 'pointer' }}
                          onClick={() => setExpandedCustomer(expandedCustomer === c.id ? null : c.id)}
                          aria-expanded={expandedCustomer === c.id}
                          aria-controls={`customer-detail-${c.id}`}
                        >
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <div className="admin-customer-avatar-lg" aria-hidden="true">
                                {getInitials(c.fullName)}
                              </div>
                              <div>
                                <div style={{ fontWeight: 700, color: '#E2E8F0' }}>{c.fullName}</div>
                                <div style={{ fontSize: '0.72rem', color: '#64748B' }}>
                                  Joined {new Date(c.createdAt).toLocaleDateString('en-IN')}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div style={{ fontSize: '0.82rem', color: '#94A3B8' }}>{c.email}</div>
                            <div style={{ fontSize: '0.76rem', color: '#64748B', marginTop: 2 }}>{c.phone}</div>
                          </td>
                          <td style={{ fontWeight: 800, color: '#34D399', fontSize: '1rem' }}>
                            ₹{parseFloat(c.totalSpent || 0).toFixed(2)}
                          </td>
                          <td>
                            <span className={`badge ${c.isBlocked ? 'badge-danger' : 'badge-success'}`}>
                              {c.isBlocked ? 'Blocked' : 'Active'}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <button
                                className="admin-actions-btn"
                                style={{
                                  color: c.isBlocked ? '#34D399' : '#F87171',
                                  borderColor: c.isBlocked ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
                                }}
                                onClick={e => { e.stopPropagation(); handleToggleBlock(c.id, c.isBlocked); }}
                                aria-label={`${c.isBlocked ? 'Unblock' : 'Block'} ${c.fullName}`}
                                id={`block-${c.id}`}
                              >
                                {c.isBlocked ? '🔓 Unblock' : '🔒 Block'}
                              </button>
                              <button
                                className="admin-actions-btn"
                                onClick={e => { e.stopPropagation(); setExpandedCustomer(expandedCustomer === c.id ? null : c.id); }}
                                aria-label={`${expandedCustomer === c.id ? 'Collapse' : 'Expand'} ${c.fullName} details`}
                              >
                                {expandedCustomer === c.id ? '▲' : '▼'}
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Expandable order history */}
                        {expandedCustomer === c.id && (
                          <tr id={`customer-detail-${c.id}`}>
                            <td colSpan={5} style={{ padding: 0 }}>
                              <div className="admin-expandable-content" style={{ padding: '16px 24px' }}>
                                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748B', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                                  Order History
                                </div>
                                {orders.filter(o => o.customerId === c.id).length === 0 ? (
                                  <div style={{ color: '#475569', fontSize: '0.82rem' }}>No orders from this customer yet.</div>
                                ) : (
                                  orders.filter(o => o.customerId === c.id).slice(0, 5).map(o => (
                                    <div key={o.id} style={{
                                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                      padding: '8px 12px', background: 'rgba(255,255,255,0.03)',
                                      borderRadius: 8, marginBottom: 6, fontSize: '0.82rem',
                                    }}>
                                      <span style={{ fontFamily: 'monospace', color: '#64748B' }}>#{o.id.slice(0, 8)}</span>
                                      <span className={`badge ${STATUS_BADGE[o.status] || 'badge-neutral'}`}>
                                        {o.status?.replace(/_/g, ' ')}
                                      </span>
                                      <span style={{ color: '#34D399', fontWeight: 700 }}>₹{parseFloat(o.finalAmount || 0).toFixed(2)}</span>
                                      <span style={{ color: '#64748B', fontSize: '0.74rem' }}>
                                        {new Date(o.createdAt).toLocaleDateString('en-IN')}
                                      </span>
                                    </div>
                                  ))
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
