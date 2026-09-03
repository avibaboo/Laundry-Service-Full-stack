import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import useSocket from '../hooks/useSocket';
import { toast } from '../hooks/useToast';
import DarkModeToggle from '../components/shared/DarkModeToggle';
import { ServiceCardSkeleton } from '../components/Skeleton/Skeleton';
import { useAuth } from '../contexts/AuthContext';

// ── Constants ──────────────────────────────────────────────────────
const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

const STATUS_STEPS = [
  { key: 'PENDING',          icon: '📋', label: 'Order Placed',     sub: 'We received your order' },
  { key: 'CONFIRMED',        icon: '✅', label: 'Confirmed',         sub: 'Order confirmed by team' },
  { key: 'PICKED_UP',        icon: '🚗', label: 'Picked Up',         sub: 'Items collected from you' },
  { key: 'WASHING',          icon: '🫧', label: 'Washing',           sub: 'Being washed with care' },
  { key: 'DRYING',           icon: '💨', label: 'Drying',            sub: 'Tumble dried or air dried' },
  { key: 'FOLDING',          icon: '👕', label: 'Folding',           sub: 'Neatly folded for you' },
  { key: 'QUALITY_CHECK',    icon: '🔍', label: 'Quality Check',     sub: 'Final inspection done' },
  { key: 'OUT_FOR_DELIVERY', icon: '🚚', label: 'Out for Delivery',  sub: 'On its way to you!' },
  { key: 'DELIVERED',        icon: '🏠', label: 'Delivered',         sub: 'Enjoy fresh clothes!' },
];

const CATEGORIES = [
  { key: 'all',         label: 'All Services',  icon: '✨' },
  { key: 'wash',        label: 'Wash & Fold',   icon: '🫧' },
  { key: 'dry',         label: 'Dry Cleaning',  icon: '👔' },
  { key: 'iron',        label: 'Ironing',       icon: '♨️' },
  { key: 'premium',     label: 'Premium',       icon: '⭐' },
];

const SERVICE_ICONS = {
  default: '👕',
  Ironing: '♨️',
  'Wash & Fold': '🫧',
  'Dry Cleaning': '👔',
  Premium: '⭐',
  Blanket: '🛋️',
  Shoe: '👟',
};

function getServiceIcon(name) {
  for (const [key, icon] of Object.entries(SERVICE_ICONS)) {
    if (name?.toLowerCase().includes(key.toLowerCase())) return icon;
  }
  return SERVICE_ICONS.default;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function getInitials(name) {
  return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
}

const TAX_RATE = 0.05; // 5% GST
const BULK_THRESHOLD = 500;
const BULK_DISCOUNT = 0.10;

// ── Component ──────────────────────────────────────────────────────
const CustomerPortal = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [services, setServices]           = useState([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [cart, setCart]                   = useState({});
  const [orders, setOrders]               = useState([]);
  const [view, setView]                   = useState('browse'); // 'browse' | 'checkout' | 'tracking'
  const [wizardStep, setWizardStep]       = useState(1); // 1=summary, 2=details, 3=payment
  const [form, setForm]                   = useState({
    pickupAddress: '', deliveryAddress: '',
    paymentMethod: 'CASH', scheduledPickupTime: '',
  });
  const [pendingOrder, setPendingOrder]   = useState(null);
  const [loading, setLoading]             = useState(false);
  const [category, setCategory]           = useState('all');
  const [notifCount, setNotifCount]       = useState(0);
  const [recentNotifications, setRecentNotifications] = useState([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [priceFlash, setPriceFlash]       = useState({});
  const [updatedOrderId, setUpdatedOrderId] = useState(null);
  const [scrolled, setScrolled]           = useState(false);
  const servicesRef                        = useRef(null);
  const socket                             = useSocket();

  // ── Data fetching ────────────────────────────────────────────────
  useEffect(() => {
    setLoadingServices(true);
    axios.get(`${API}/services`)
      .then(res => setServices(res.data))
      .catch(() => toast.error('Connection Error', 'Could not load services. Is the server running?'))
      .finally(() => setLoadingServices(false));

    if (user) {
      axios.get(`${API}/orders?customerId=${user.id}`)
        .then(res => {
          if (res.data.length > 0) {
            setOrders(res.data);
            setView('tracking');
          }
        })
        .catch(() => {});
    } else {
      setOrders([]);
    }
  }, [user]);

  // ── Scroll detection ─────────────────────────────────────────────
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // ── Socket listeners ─────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    socket.on('servicePricesUpdated', (data) => {
      setServices(data.services);
      // Flash all prices
      const flashes = {};
      data.services.forEach(s => { flashes[s.id] = true; });
      setPriceFlash(flashes);
      setTimeout(() => setPriceFlash({}), 1000);
      setNotifCount(n => n + 1);
      setRecentNotifications(prev => [{ id: Date.now(), title: 'Prices Updated', message: 'Service prices were updated by admin in real time.', time: new Date() }, ...prev]);
      toast.info('💰 Prices Updated', 'Service prices were updated by admin in real time.');
    });

    socket.on('orderStatusUpdated', (data) => {
      setOrders(prev =>
        prev.map(o => o.id === data.orderId ? { ...o, status: data.newStatus } : o)
      );
      setUpdatedOrderId(data.orderId);
      setTimeout(() => setUpdatedOrderId(null), 3000);
      setNotifCount(n => n + 1);
      const stepInfo = STATUS_STEPS.find(s => s.key === data.newStatus);
      setRecentNotifications(prev => [{ id: Date.now(), title: stepInfo?.label || data.newStatus.replace(/_/g, ' '), message: stepInfo?.sub || 'Your order status was updated.', time: new Date() }, ...prev]);
      toast.success(
        `${stepInfo?.icon || '🚀'} ${stepInfo?.label || data.newStatus.replace(/_/g, ' ')}`,
        stepInfo?.sub || 'Your order status was updated.'
      );
    });

    return () => {
      socket.off('servicePricesUpdated');
      socket.off('orderStatusUpdated');
    };
  }, [socket]);

  // ── Cart helpers ─────────────────────────────────────────────────
  const addToCart = useCallback((serviceId) => {
    setCart(prev => ({ ...prev, [serviceId]: (prev[serviceId] || 0) + 1 }));
  }, []);

  const removeFromCart = useCallback((serviceId) => {
    setCart(prev => {
      const next = { ...prev };
      if (next[serviceId] <= 1) delete next[serviceId];
      else next[serviceId]--;
      return next;
    });
  }, []);

  const cartItems = services.filter(s => cart[s.id]);
  const subtotal = cartItems.reduce((sum, s) => sum + s.pricePerUnit * (cart[s.id] || 0), 0);
  const discount = subtotal >= BULK_THRESHOLD ? subtotal * BULK_DISCOUNT : 0;
  const tax = (subtotal - discount) * TAX_RATE;
  const total = subtotal - discount + tax;
  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);

  // ── Filtered services ─────────────────────────────────────────────
  const filteredServices = category === 'all'
    ? services
    : services.filter(s => s.name?.toLowerCase().includes(
        category === 'wash' ? 'wash' :
        category === 'dry'  ? 'dry' :
        category === 'iron' ? 'iron' :
        category === 'premium' ? 'premium' : ''
      ));

  // ── Order placement ───────────────────────────────────────────────
  const handlePlaceOrder = async () => {
    if (!form.pickupAddress || !form.deliveryAddress || !form.scheduledPickupTime) {
      toast.warning('Missing Fields', 'Please fill in all required fields.');
      return;
    }
    setLoading(true);
    try {
      const items = cartItems.map(s => ({ serviceId: s.id, quantity: cart[s.id] }));
      const res = await axios.post(`${API}/orders`, {
        customerId: user.id,
        pickupAddress: form.pickupAddress,
        deliveryAddress: form.deliveryAddress,
        paymentMethod: form.paymentMethod,
        scheduledPickupTime: form.scheduledPickupTime,
        items,
      });
      setPendingOrder(res.data);
      setWizardStep(4); // payment
    } catch {
      toast.error('Order Failed', 'Could not place order. Please make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!pendingOrder) return;
    setLoading(true);
    try {
      const res = await axios.put(`${API}/orders/${pendingOrder.id}/pay`);
      setOrders(prev => [res.data, ...prev]);
      setCart({});
      setPendingOrder(null);
      setWizardStep(1);
      setView('tracking');
      toast.success('🎉 Payment Successful!', 'Your order is confirmed and being processed.');
    } catch {
      toast.error('Payment Failed', 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Wizard step validation ────────────────────────────────────────
  const canProceedToStep2 = cartItems.length > 0;
  const canProceedToStep3 = form.pickupAddress && form.deliveryAddress && form.scheduledPickupTime;

  // ── UI ─────────────────────────────────────────────────────────────
  return (
    <div>
      {/* ── NAVBAR ──────────────────────────────────────────── */}
      <nav className={`cp-nav${scrolled ? ' scrolled' : ''}`} role="banner">
        <div className="cp-nav-inner">
          {/* Logo */}
          <div className="cp-logo">
            <div className="cp-logo-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26C17.81 13.47 19 11.38 19 9c0-3.87-3.13-7-7-7zm2 14h-4v-1h4v1zm-1.5-4.32V13h-1v-1.32C9.44 11.34 8 10.27 8 9c0-.55.45-1 1-1s1 .45 1 1c0 .78.84 1.42 2 1.42s2-.64 2-1.42c0-.55.45-1 1-1s1 .45 1 1c0 1.27-1.44 2.34-3.5 2.68z"/>
              </svg>
            </div>
            <span className="cp-logo-text">FreshWave</span>
          </div>

          {/* Nav links */}
          <nav className="cp-nav-links" aria-label="Main navigation">
            <button
              className={`cp-nav-link ${view === 'browse' ? 'active' : ''}`}
              onClick={() => setView('browse')}
              aria-current={view === 'browse' ? 'page' : undefined}
            >
              Services
            </button>
            {user && orders.length > 0 && (
              <button
                className={`cp-nav-link ${view === 'tracking' ? 'active' : ''}`}
                onClick={() => setView('tracking')}
                aria-current={view === 'tracking' ? 'page' : undefined}
              >
                My Orders
              </button>
            )}
            {user && user.role === 'ADMIN' && (
              <Link
                to="/admin"
                className="cp-nav-link"
                style={{ color: 'var(--primary)', fontWeight: 700 }}
              >
                Admin Portal →
              </Link>
            )}
          </nav>

          {/* Right section */}
          <div className="cp-nav-right">
            {/* Notification bell */}
            <div style={{ position: 'relative' }}>
              <button
                className="cp-bell-btn"
                aria-label={`Notifications — ${notifCount} unread`}
                onClick={() => {
                  setShowNotifDropdown(!showNotifDropdown);
                  if (notifCount > 0) setNotifCount(0);
                }}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                {notifCount > 0 && (
                  <span className="cp-bell-badge" aria-label={`${notifCount} unread`}>
                    {notifCount > 9 ? '9+' : notifCount}
                  </span>
                )}
              </button>
              
              {showNotifDropdown && (
                <div style={{
                  position: 'absolute', top: '120%', right: 0, width: 300, 
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 'var(--r-xl)', padding: '12px 0', zIndex: 1000,
                  boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
                }}>
                  <div style={{ padding: '0 16px 8px', fontWeight: 600, borderBottom: '1px solid var(--border)', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Notifications</span>
                    {recentNotifications.length > 0 && (
                      <button onClick={() => setRecentNotifications([])} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.75rem', cursor: 'pointer' }}>Clear</button>
                    )}
                  </div>
                  <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                    {recentNotifications.length === 0 ? (
                      <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        No new notifications
                      </div>
                    ) : (
                      recentNotifications.map(n => (
                        <div key={n.id} style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{n.title}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{n.message}</div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--primary)', marginTop: 2 }}>{n.time.toLocaleTimeString()}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <DarkModeToggle />

            {/* Cart button (visible when items in cart and in browse) */}
            {cartCount > 0 && view === 'browse' && (
              <button
                className="cp-cart-btn"
                onClick={() => { 
                  if (!user) {
                    navigate('/login');
                  } else {
                    setView('checkout'); 
                    setWizardStep(1); 
                  }
                }}
                aria-label={`View cart — ${cartCount} items, ₹${total.toFixed(2)}`}
              >
                🛒 {cartCount} · ₹{total.toFixed(0)}
              </button>
            )}

            {/* Avatar greeting */}
            {user ? (
              <div className="cp-greeting" aria-label={`Logged in as ${user.fullName}`}>
                <div className="cp-avatar" aria-hidden="true" onClick={logout} style={{ cursor: 'pointer' }} title="Log out">
                  {getInitials(user.fullName)}
                </div>
                <span className="cp-greeting-text">{getGreeting()}, {user.fullName.split(' ')[0]}!</span>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginLeft: 8 }}>
                <Link to="/login" style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem' }}>Sign In</Link>
                <Link to="/signup" className="btn btn-primary btn-sm">Sign Up</Link>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* ── HERO (browse only) ──────────────────────────────── */}
      {view === 'browse' && (
        <section className="cp-hero" id="home" aria-label="Hero section">
          {/* Background blobs */}
          <div className="hero-blob blob-1" aria-hidden="true" />
          <div className="hero-blob blob-2" aria-hidden="true" />

          <div className="cp-hero-inner">
            {/* Left: text content */}
            <div className="cp-hero-left">
              <div className="cp-hero-badge" role="note">
                <span>⭐</span>
                <span>Trusted by 2,400+ happy customers</span>
              </div>

              <h1 className="cp-hero-heading">
                Premium Laundry{' '}
                <span className="gradient-text">at Your</span>
                <br />
                <span className="gradient-text">Doorstep</span>
              </h1>

              <p className="cp-hero-sub">
                Experience the freshness of professionally cleaned clothes.
                We pick up, clean with eco-friendly detergents, and deliver
                your garments with white-glove care.
              </p>

              <div className="cp-hero-ctas">
                <button
                  className="btn btn-success btn-lg"
                  onClick={() => servicesRef.current?.scrollIntoView({ behavior: 'smooth' })}
                  id="hero-book-btn"
                >
                  📅 Book a Service
                </button>
                {user && orders.length > 0 && (
                  <button
                    className="btn btn-ghost btn-lg"
                    onClick={() => setView('tracking')}
                  >
                    📦 Track Orders
                  </button>
                )}
              </div>

              <div className="cp-hero-trusts" role="list" aria-label="Trust indicators">
                {[
                  { icon: '🛡️', text: '100% Safe' },
                  { icon: '🚗', text: 'Free Pickup' },
                  { icon: '⚡', text: '24h Delivery' },
                  { icon: '🌿', text: 'Eco-Friendly' },
                ].map(item => (
                  <div key={item.text} className="cp-trust-item" role="listitem">
                    <div className="cp-trust-icon" aria-hidden="true">{item.icon}</div>
                    <span>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: visual */}
            <div className="cp-hero-visual" aria-hidden="true">
              <div className="cp-hero-image-card">
                <div style={{
                  width: '100%', height: '100%',
                  background: 'linear-gradient(135deg, #DBEAFE 0%, #D1FAE5 50%, #E0F2FE 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexDirection: 'column', gap: 16
                }}>
                  <div style={{ fontSize: '5rem', filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.15))' }}>🫧</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 700, color: '#1E3A5F', opacity: 0.7 }}>
                    Fresh. Clean. Fast.
                  </div>
                </div>
              </div>

              {/* Floating stat cards */}
              <div className="cp-float-card card-orders">
                <div className="cp-float-icon blue" aria-hidden="true">📦</div>
                <div>
                  <div className="cp-float-num">2,847</div>
                  <div className="cp-float-label">Orders This Month</div>
                </div>
              </div>
              <div className="cp-float-card card-rating">
                <div className="cp-float-icon green" aria-hidden="true">⭐</div>
                <div>
                  <div className="cp-float-num">4.9/5</div>
                  <div className="cp-float-label">Customer Rating</div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── SERVICES SECTION (browse only) ─────────────────── */}
      {view === 'browse' && (
        <section
          className="cp-services-section"
          id="services"
          ref={servicesRef}
          aria-labelledby="services-heading"
        >
          <div className="cp-section-header">
            <div className="cp-section-tag" aria-hidden="true">✨ Our Services</div>
            <h2 className="cp-section-title" id="services-heading">
              What can we clean for you?
            </h2>
            <p className="cp-section-sub">
              Prices update live · Add to cart and checkout in seconds
            </p>
          </div>

          {/* Category filter tabs */}
          <div className="cp-categories" role="tablist" aria-label="Service categories">
            {CATEGORIES.map(cat => (
              <button
                key={cat.key}
                role="tab"
                aria-selected={category === cat.key}
                className={`cp-cat-btn ${category === cat.key ? 'active' : ''}`}
                onClick={() => setCategory(cat.key)}
                id={`cat-${cat.key}`}
              >
                <span aria-hidden="true">{cat.icon}</span>
                {cat.label}
              </button>
            ))}
          </div>

          {/* 2-column layout: services + cart */}
          <div className="cp-services-layout">
            {/* Service grid */}
            <div
              className="cp-service-grid"
              role="list"
              aria-label="Available services"
              aria-busy={loadingServices}
              aria-live="polite"
            >
              {loadingServices
                ? Array(6).fill(0).map((_, i) => <ServiceCardSkeleton key={i} />)
                : filteredServices.length === 0
                  ? (
                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                      <div style={{ fontSize: '3rem', marginBottom: 12 }}>🔍</div>
                      <p>No services in this category yet.</p>
                    </div>
                  )
                  : filteredServices.map(service => (
                    <article
                      key={service.id}
                      className={`cp-service-card ${cart[service.id] ? 'in-cart' : ''}`}
                      role="listitem"
                      aria-label={`${service.name} — ₹${service.pricePerUnit} per ${service.unitType}`}
                    >
                      <div className="cp-service-card-top">
                        <div className="cp-service-icon-wrap" aria-hidden="true">
                          {getServiceIcon(service.name)}
                        </div>
                        <div className="cp-service-info">
                          <div className="cp-service-name">{service.name}</div>
                          <div className="cp-service-desc">{service.description}</div>
                          <div className="cp-service-eta">
                            <span aria-hidden="true">⏱</span>
                            <span>{service.estimatedMinutes} min turnaround</span>
                          </div>
                        </div>
                      </div>

                      <div className="cp-service-price-row">
                        <div>
                          <div
                            className={`cp-service-price ${priceFlash[service.id] ? 'price-flash' : ''}`}
                            aria-label={`Price: ₹${service.pricePerUnit} per ${service.unitType}`}
                          >
                            ₹{service.pricePerUnit}
                          </div>
                          <span className="cp-service-unit">per {service.unitType}</span>
                        </div>

                        {cart[service.id] ? (
                          <div className="cp-qty-stepper" aria-label={`${service.name} quantity`}>
                            <button
                              className="cp-qty-btn minus"
                              onClick={() => removeFromCart(service.id)}
                              aria-label={`Remove one ${service.name}`}
                            >−</button>
                            <span className="cp-qty-val" aria-live="polite">{cart[service.id]}</span>
                            <button
                              className="cp-qty-btn plus"
                              onClick={() => addToCart(service.id)}
                              aria-label={`Add another ${service.name}`}
                            >+</button>
                          </div>
                        ) : (
                          <button
                            className="cp-add-btn"
                            onClick={() => addToCart(service.id)}
                            aria-label={`Add ${service.name} to cart`}
                            id={`add-${service.id}`}
                          >
                            <span aria-hidden="true">+</span> Add to Cart
                          </button>
                        )}
                      </div>
                    </article>
                  ))
              }
            </div>

            {/* Sticky cart panel */}
            <aside className="cp-cart-panel" aria-label="Your cart" role="complementary">
              <div className="cp-cart-title">
                🛒 Your Cart
                {cartCount > 0 && (
                  <span className="cp-cart-badge" aria-label={`${cartCount} items`}>{cartCount}</span>
                )}
              </div>

              {cartItems.length === 0 ? (
                <div className="cp-empty-cart" aria-label="Cart is empty">
                  <div className="cp-empty-cart-icon" aria-hidden="true">🧺</div>
                  <p style={{ fontWeight: 600, marginBottom: 6 }}>No items yet</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Add services from the grid</p>
                </div>
              ) : (
                <>
                  <div className="cp-cart-items" role="list">
                    {cartItems.map(s => (
                      <div key={s.id} className="cp-cart-item" role="listitem">
                        <span aria-hidden="true">{getServiceIcon(s.name)}</span>
                        <span className="cp-cart-item-name">{s.name} × {cart[s.id]}</span>
                        <span className="cp-cart-item-price">₹{(s.pricePerUnit * cart[s.id]).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="cp-cart-divider" aria-hidden="true" />

                  <div className="cp-cart-summary">
                    <div className="cp-cart-line">
                      <span>Subtotal</span>
                      <span>₹{subtotal.toFixed(2)}</span>
                    </div>
                    {discount > 0 && (
                      <div className="cp-cart-line" style={{ color: 'var(--success)' }}>
                        <span>🎉 Bulk Discount (10%)</span>
                        <span>−₹{discount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="cp-cart-line">
                      <span>GST (5%)</span>
                      <span>₹{tax.toFixed(2)}</span>
                    </div>
                    <div className="cp-cart-total">
                      <span>Total</span>
                      <span className="cp-cart-total-amount" aria-live="polite">₹{total.toFixed(2)}</span>
                    </div>
                  </div>

                  {subtotal >= BULK_THRESHOLD && (
                    <div style={{
                      background: 'var(--success-light)', color: 'var(--success-dark)',
                      borderRadius: 'var(--r-lg)', padding: '8px 14px',
                      fontSize: '0.78rem', fontWeight: 600, textAlign: 'center',
                    }}>
                      🎉 You saved ₹{discount.toFixed(2)} with the bulk discount!
                    </div>
                  )}

                  <button
                    className="btn btn-primary btn-full"
                    onClick={() => { 
                      if (!user) {
                        navigate('/login');
                      } else {
                        setView('checkout'); 
                        setWizardStep(1); 
                      }
                    }}
                    id="proceed-checkout-btn"
                  >
                    Proceed to Checkout →
                  </button>
                </>
              )}
            </aside>
          </div>
        </section>
      )}

      {/* ── CHECKOUT WIZARD ─────────────────────────────────── */}
      {view === 'checkout' && (
        <main className="cp-wizard-wrap" aria-label="Checkout wizard">
          <div className="cp-wizard-inner">
            {/* Back button */}
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setView('browse')}
              style={{ marginBottom: 28 }}
              aria-label="Back to services"
            >
              ← Back to Services
            </button>

            {/* Progress bar */}
            <div className="cp-progress-bar" role="progressbar" aria-valuenow={wizardStep} aria-valuemin={1} aria-valuemax={4}>
              {[
                { n: 1, label: 'Review' },
                { n: 2, label: 'Details' },
                { n: 3, label: 'Payment' },
                { n: 4, label: 'Confirm' },
              ].map((s, i, arr) => (
                <React.Fragment key={s.n}>
                  <div className={`cp-progress-step ${wizardStep > s.n ? 'done' : wizardStep === s.n ? 'active' : ''}`}>
                    <div className="cp-progress-dot">
                      {wizardStep > s.n ? '✓' : s.n}
                    </div>
                    <span className="cp-progress-label">{s.label}</span>
                  </div>
                  {i < arr.length - 1 && (
                    <div className={`cp-progress-line ${wizardStep > s.n ? 'done' : ''}`} aria-hidden="true" />
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* Step 1: Review cart */}
            {wizardStep === 1 && (
              <div className="cp-wizard-step" role="region" aria-label="Step 1: Review your order">
                <div className="cp-wizard-step-title">Review Your Order</div>
                <div className="cp-wizard-step-sub">Check your items before proceeding</div>

                {cartItems.map(s => (
                  <div key={s.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '12px 0', borderBottom: '1px solid var(--border)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: '1.3rem' }}>{getServiceIcon(s.name)}</span>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{s.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          ₹{s.pricePerUnit} × {cart[s.id]} {s.unitType}
                        </div>
                      </div>
                    </div>
                    <strong style={{ color: 'var(--primary)' }}>₹{(s.pricePerUnit * cart[s.id]).toFixed(2)}</strong>
                  </div>
                ))}

                <div className="cp-order-summary-mini" style={{ marginTop: 20 }}>
                  <div className="cp-summary-row"><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
                  {discount > 0 && <div className="cp-summary-row" style={{ color: 'var(--success)' }}><span>Bulk Discount (10%)</span><span>−₹{discount.toFixed(2)}</span></div>}
                  <div className="cp-summary-row"><span>GST (5%)</span><span>₹{tax.toFixed(2)}</span></div>
                  <div className="cp-summary-total">
                    <span>Total</span>
                    <span className="cp-summary-total-val" aria-live="polite">₹{total.toFixed(2)}</span>
                  </div>
                </div>

                <div className="cp-wizard-nav">
                  <button className="btn btn-ghost" onClick={() => setView('browse')}>Edit Cart</button>
                  <button
                    className="btn btn-primary"
                    onClick={() => setWizardStep(2)}
                    disabled={!canProceedToStep2}
                    id="wizard-next-1"
                  >
                    Next: Delivery Details →
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Delivery details */}
            {wizardStep === 2 && (
              <div className="cp-wizard-step" role="region" aria-label="Step 2: Delivery details">
                <div className="cp-wizard-step-title">Delivery Details</div>
                <div className="cp-wizard-step-sub">Tell us where to pick up and drop off</div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="pickup-addr">📍 Pickup Address</label>
                    <input
                      id="pickup-addr"
                      className="form-control"
                      type="text"
                      placeholder="e.g. 42 Marine Drive, Apartment 3B"
                      value={form.pickupAddress}
                      onChange={e => setForm({ ...form, pickupAddress: e.target.value })}
                      required
                      aria-required="true"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="delivery-addr">📍 Delivery Address</label>
                    <input
                      id="delivery-addr"
                      className="form-control"
                      type="text"
                      placeholder="Same as pickup or different address"
                      value={form.deliveryAddress}
                      onChange={e => setForm({ ...form, deliveryAddress: e.target.value })}
                      required
                      aria-required="true"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="pickup-time">📅 Scheduled Pickup Time</label>
                    <input
                      id="pickup-time"
                      className="form-control"
                      type="datetime-local"
                      value={form.scheduledPickupTime}
                      onChange={e => setForm({ ...form, scheduledPickupTime: e.target.value })}
                      required
                      aria-required="true"
                      min={new Date().toISOString().slice(0, 16)}
                    />
                  </div>
                </div>

                <div className="cp-wizard-nav">
                  <button className="btn btn-ghost" onClick={() => setWizardStep(1)}>← Back</button>
                  <button
                    className="btn btn-primary"
                    onClick={() => setWizardStep(3)}
                    disabled={!canProceedToStep3}
                    id="wizard-next-2"
                  >
                    Next: Payment →
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Payment method */}
            {wizardStep === 3 && (
              <div className="cp-wizard-step" role="region" aria-label="Step 3: Payment method">
                <div className="cp-wizard-step-title">Choose Payment</div>
                <div className="cp-wizard-step-sub">All payments are secured and encrypted 🔒</div>

                <div className="cp-pay-methods" role="radiogroup" aria-label="Payment method">
                  {[
                    { value: 'CASH',   icon: '💵', label: 'Cash on Delivery', hint: 'Pay when your order arrives' },
                    { value: 'CARD',   icon: '💳', label: 'Credit / Debit Card', hint: 'Visa, Mastercard, RuPay' },
                    { value: 'WALLET', icon: '📱', label: 'Digital Wallet', hint: 'PhonePe, Google Pay, Paytm' },
                  ].map(opt => (
                    <div
                      key={opt.value}
                      className={`cp-pay-option ${form.paymentMethod === opt.value ? 'selected' : ''}`}
                      onClick={() => setForm({ ...form, paymentMethod: opt.value })}
                      role="radio"
                      aria-checked={form.paymentMethod === opt.value}
                      tabIndex={0}
                      onKeyDown={e => e.key === 'Enter' && setForm({ ...form, paymentMethod: opt.value })}
                      id={`pay-${opt.value}`}
                    >
                      <div className="cp-pay-icon" aria-hidden="true">{opt.icon}</div>
                      <div>
                        <div className="cp-pay-label">{opt.label}</div>
                        <div className="cp-pay-hint">{opt.hint}</div>
                      </div>
                      <div className="cp-radio-dot" aria-hidden="true" />
                    </div>
                  ))}
                </div>

                {/* Summary */}
                <div className="cp-order-summary-mini" style={{ marginTop: 20 }}>
                  <div className="cp-summary-total">
                    <span>Amount to Pay</span>
                    <span className="cp-summary-total-val">₹{total.toFixed(2)}</span>
                  </div>
                </div>

                <div className="cp-wizard-nav">
                  <button className="btn btn-ghost" onClick={() => setWizardStep(2)}>← Back</button>
                  <button
                    className="btn btn-success btn-lg"
                    onClick={handlePlaceOrder}
                    disabled={loading}
                    id="place-order-btn"
                  >
                    {loading ? '⌛ Placing Order…' : '🛍️ Place Order'}
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Payment confirmation (mock gateway) */}
            {wizardStep === 4 && pendingOrder && (
              <div className="cp-wizard-step" style={{ textAlign: 'center' }} role="region" aria-label="Step 4: Complete payment">
                <div style={{ fontSize: '3.5rem', marginBottom: 16 }} aria-hidden="true">
                  {form.paymentMethod === 'CASH' ? '💵' : form.paymentMethod === 'CARD' ? '💳' : '📱'}
                </div>
                <div className="cp-wizard-step-title">Complete Payment</div>
                <div className="cp-wizard-step-sub">
                  Order #{pendingOrder.id.slice(0, 8)}… · {form.paymentMethod}
                </div>

                <div style={{
                  background: 'linear-gradient(135deg, var(--primary-xlight), rgba(16,185,129,0.08))',
                  border: '1.5px solid var(--border)',
                  borderRadius: 'var(--r-2xl)',
                  padding: '28px',
                  margin: '24px 0',
                }}>
                  <div style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '2.8rem',
                    fontWeight: 900,
                    color: 'var(--primary)',
                    marginBottom: 6,
                  }}>
                    ₹{pendingOrder.finalAmount.toFixed(2)}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    {form.paymentMethod === 'CASH' ? 'Pay on delivery' : 'Charged to your account'}
                  </div>
                </div>

                {/* Mock card fields */}
                {form.paymentMethod === 'CARD' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24, textAlign: 'left' }}>
                    <div className="form-group">
                      <label className="form-label" htmlFor="card-num">Card Number</label>
                      <input id="card-num" className="form-control" type="text" placeholder="4242 4242 4242 4242" maxLength={19} />
                    </div>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label className="form-label" htmlFor="card-exp">Expiry</label>
                        <input id="card-exp" className="form-control" type="text" placeholder="MM / YY" />
                      </div>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label className="form-label" htmlFor="card-cvv">CVV</label>
                        <input id="card-cvv" className="form-control" type="password" placeholder="•••" maxLength={3} />
                      </div>
                    </div>
                  </div>
                )}

                {/* UPI / Digital Wallet QR Code */}
                {form.paymentMethod === 'WALLET' && (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 16,
                    marginBottom: 24,
                    padding: '24px 20px',
                    background: 'var(--bg-card)',
                    border: '1.5px solid var(--border)',
                    borderRadius: 'var(--r-2xl)',
                  }}>
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                      📱 Scan & Pay via UPI
                    </div>
                    <div style={{
                      background: '#fff',
                      borderRadius: 'var(--r-xl)',
                      padding: 12,
                      boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
                    }}>
                      <img
                        src="/upi_qr.png"
                        alt="UPI QR Code - avi2006iitian@okicici"
                        style={{ width: 200, height: 200, display: 'block', borderRadius: 8 }}
                      />
                    </div>
                    <div style={{
                      background: 'var(--primary-xlight)',
                      borderRadius: 'var(--r-md)',
                      padding: '8px 18px',
                      fontSize: '0.88rem',
                      fontWeight: 600,
                      color: 'var(--primary-dark)',
                      letterSpacing: '0.3px',
                    }}>
                      UPI ID: avi2006iitian@okicici
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.6 }}>
                      Open <strong>Google Pay</strong>, <strong>PhonePe</strong>, or <strong>Paytm</strong><br/>
                      and scan the QR code to pay ₹{pendingOrder?.finalAmount?.toFixed(2)}.
                    </div>
                    <div style={{
                      display: 'flex',
                      gap: 10,
                      alignItems: 'center',
                      fontSize: '0.75rem',
                      color: 'var(--text-muted)',
                    }}>
                      <span>🔒 Secure UPI Payment</span>
                      <span>•</span>
                      <span>Instant Confirmation</span>
                    </div>
                  </div>
                )}

                <button
                  className="btn btn-success btn-xl btn-full"
                  onClick={handlePayment}
                  disabled={loading}
                  id="confirm-pay-btn"
                  style={{ marginBottom: 12 }}
                >
                  {loading
                    ? '⌛ Processing…'
                    : form.paymentMethod === 'CASH'
                      ? '✅ Confirm Order (Pay on Delivery)'
                      : `🔒 Pay ₹${pendingOrder.finalAmount.toFixed(2)} Now`
                  }
                </button>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  🔒 256-bit SSL encrypted. Your data is safe.
                </div>
              </div>
            )}
          </div>
        </main>
      )}

      {/* ── ORDER TRACKING ──────────────────────────────────── */}
      {view === 'tracking' && (
        <main className="cp-tracking-section" aria-label="Order tracking">
          <div className="cp-tracking-inner">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div className="cp-section-tag">📦 Live Tracking</div>
                <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Your Orders
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: 4 }}>
                  Status updates arrive in real-time via WebSocket
                </p>
              </div>
              <button
                className="btn btn-success"
                onClick={() => setView('browse')}
                id="new-order-btn"
              >
                + Place New Order
              </button>
            </div>

            {orders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '64px 24px', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '3.5rem', marginBottom: 16 }}>📭</div>
                <p style={{ fontWeight: 600, marginBottom: 8 }}>No orders yet</p>
                <p style={{ fontSize: '0.85rem' }}>Place your first order to start tracking here!</p>
              </div>
            ) : (
              <div role="list" aria-label="Orders">
                {orders.map(order => {
                  const stepIndex = STATUS_STEPS.findIndex(s => s.key === order.status);
                  const isUpdated = updatedOrderId === order.id;

                  return (
                    <article
                      key={order.id}
                      className="cp-order-card"
                      role="listitem"
                      aria-label={`Order ${order.id.slice(0, 8)}, status: ${order.status.replace(/_/g, ' ')}`}
                    >
                      {/* Order header */}
                      <div className="cp-order-card-header">
                        <div>
                          <div className="cp-order-id">Order #{order.id.slice(0, 8).toUpperCase()}…</div>
                          <div className="cp-order-meta">
                            ₹{order.finalAmount.toFixed(2)} · {order.paymentMethod} ·{' '}
                            <span style={{ color: order.paymentStatus === 'PAID' ? 'var(--success)' : 'var(--warning)', fontWeight: 600 }}>
                              {order.paymentStatus}
                            </span>
                          </div>
                        </div>
                        <span
                          className={`badge ${
                            order.status === 'DELIVERED' ? 'badge-success' :
                            order.status === 'CANCELLED' ? 'badge-danger' :
                            order.status === 'OUT_FOR_DELIVERY' ? 'badge-purple' :
                            'badge-primary'
                          }`}
                          aria-live="polite"
                        >
                          {order.status.replace(/_/g, ' ')}
                        </span>
                      </div>

                      {/* Vertical timeline */}
                      <div className="cp-timeline" role="list" aria-label="Order status timeline">
                        {STATUS_STEPS.map((step, i) => {
                          const isDone   = i < stepIndex;
                          const isActive = i === stepIndex;
                          const isFuture = i > stepIndex;
                          return (
                            <div
                              key={step.key}
                              className="cp-timeline-step"
                              role="listitem"
                              aria-label={`${step.label}: ${isDone ? 'Completed' : isActive ? 'In progress' : 'Pending'}`}
                            >
                              <div className="cp-timeline-left">
                                <div
                                  className={`cp-timeline-dot ${isDone ? 'done' : isActive ? `active${isUpdated ? ' new-update' : ''}` : ''}`}
                                  aria-hidden="true"
                                >
                                  {isDone ? '✓' : step.icon}
                                </div>
                                {i < STATUS_STEPS.length - 1 && (
                                  <div className={`cp-timeline-connector ${isDone ? 'done' : ''}`} aria-hidden="true" />
                                )}
                              </div>
                              <div className="cp-timeline-content">
                                <div
                                  className="cp-timeline-title"
                                  style={{ opacity: isFuture ? 0.4 : 1 }}
                                >
                                  {step.label}
                                </div>
                                {(isDone || isActive) && (
                                  <div className="cp-timeline-sub">{step.sub}</div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Map placeholder for driver location */}
                      {order.status === 'OUT_FOR_DELIVERY' && (
                        <div style={{
                          marginTop: 20,
                          background: 'linear-gradient(135deg, var(--primary-xlight), rgba(16,185,129,0.08))',
                          border: '1.5px dashed var(--primary)',
                          borderRadius: 'var(--r-xl)',
                          padding: '20px',
                          textAlign: 'center',
                          animation: 'pulseDot 2s ease-in-out infinite',
                        }}>
                          <div style={{ fontSize: '2rem', marginBottom: 8 }}>🗺️</div>
                          <div style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: 4 }}>
                            Driver is on the way!
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            Live map integration ready — connect Google Maps API key in /config
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      )}

      {/* ── FAB (quick order) ───────────────────────────────── */}
      {view !== 'checkout' && (
        <button
          className="cp-fab"
          onClick={() => { setView('browse'); setTimeout(() => servicesRef.current?.scrollIntoView({ behavior: 'smooth' }), 100); }}
          aria-label="Quick order — scroll to services"
          title="Book a service"
          id="fab-quick-order"
        >
          +
        </button>
      )}
    </div>
  );
};

export default CustomerPortal;
