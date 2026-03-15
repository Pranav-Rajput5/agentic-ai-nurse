
import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

let stylesInjected = false;
export const injectDashboardStyles = () => {
  if (stylesInjected) return;
  stylesInjected = true;

  const link = document.createElement('link');
  link.href = 'https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,400&family=DM+Mono:wght@400;500&display=swap';
  link.rel = 'stylesheet';
  document.head.appendChild(link);

  const style = document.createElement('style');
  style.id = 'ds-global';
  style.textContent = `
    :root {
      --ds-navy:        #0B1629;
      --ds-navy2:       #162035;
      --ds-navy3:       #1E2D42;
      --ds-teal:        #0D9488;
      --ds-teal-light:  #14B8A6;
      --ds-cyan:        #06B6D4;
      --ds-slate:       #64748B;
      --ds-slate-light: #CBD5E1;
      --ds-bg:          #F1F5F9;
      --ds-white:       #FFFFFF;
      --ds-border:      #E2E8F0;
      --ds-text:        #0F172A;
      --ds-text-muted:  #64748B;
      --ds-red:         #EF4444;
      --ds-amber:       #F59E0B;
      --ds-green:       #22C55E;
      --ds-sidebar-w:   240px;
    }

    /* ── Reset ── */
    *, *::before, *::after { box-sizing: border-box; }

    /* ── Sidebar ── */
    .ds-sidebar {
      position: fixed; top: 0; left: 0; bottom: 0;
      width: var(--ds-sidebar-w);
      background: var(--ds-navy);
      display: flex; flex-direction: column;
      z-index: 50;
      border-right: 1px solid rgba(255,255,255,0.06);
    }
    .ds-sidebar-logo {
      display: flex; align-items: center; gap: 10px;
      padding: 20px 20px 16px;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      text-decoration: none;
    }
    .ds-logo-text {
      font-family: 'Sora', sans-serif; font-weight: 800; font-size: 16px;
      color: #F1F5F9; line-height: 1;
    }
    .ds-logo-text span { color: #2DD4BF; }
    .ds-logo-sub {
      font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase;
      color: #475569; font-weight: 600; margin-top: 2px;
    }
    .ds-sidebar-section { padding: 16px 12px 4px; }
    .ds-sidebar-label {
      font-size: 9px; font-weight: 800; letter-spacing: 0.14em;
      text-transform: uppercase; color: #334155; padding: 0 8px; margin-bottom: 6px;
    }
    .ds-nav-item {
      display: flex; align-items: center; gap: 10px;
      padding: 9px 12px; border-radius: 10px; margin-bottom: 2px;
      font-family: 'DM Sans', sans-serif; font-size: 13.5px; font-weight: 500;
      color: #64748B; text-decoration: none; cursor: pointer; border: none;
      background: none; width: 100%; transition: all 0.15s;
    }
    .ds-nav-item:hover { background: rgba(255,255,255,0.05); color: #CBD5E1; }
    .ds-nav-item.active {
      background: rgba(13,148,136,0.15); color: #2DD4BF;
      border: 1px solid rgba(13,148,136,0.2);
    }
    .ds-nav-item.active .ds-nav-icon { color: #2DD4BF; }
    .ds-nav-icon { width: 16px; height: 16px; flex-shrink: 0; opacity: 0.7; }
    .ds-nav-item.active .ds-nav-icon { opacity: 1; }
    .ds-nav-badge {
      margin-left: auto; min-width: 18px; height: 18px;
      background: var(--ds-red); color: white;
      border-radius: 100px; font-size: 10px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
      padding: 0 5px;
    }
    .ds-sidebar-bottom {
      margin-top: auto; padding: 12px;
      border-top: 1px solid rgba(255,255,255,0.06);
    }
    .ds-user-pill {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 12px; border-radius: 12px;
      background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06);
    }
    .ds-user-avatar {
      width: 32px; height: 32px; border-radius: 50%;
      background: linear-gradient(135deg, #0D9488, #0891B2);
      display: flex; align-items: center; justify-content: center;
      font-family: 'Sora', sans-serif; font-size: 12px; font-weight: 700; color: white;
      flex-shrink: 0;
    }
    .ds-user-name { font-size: 12px; font-weight: 600; color: #CBD5E1; }
    .ds-user-role { font-size: 10px; color: #475569; }

    /* ── Top bar ── */
    .ds-topbar {
      position: fixed; top: 0; left: var(--ds-sidebar-w); right: 0;
      height: 60px; background: var(--ds-white);
      border-bottom: 1px solid var(--ds-border);
      display: flex; align-items: center;
      padding: 0 28px; gap: 16px; z-index: 40;
    }
    .ds-topbar-title {
      font-family: 'Sora', sans-serif; font-size: 16px; font-weight: 700;
      color: var(--ds-text); flex: 1;
    }
    .ds-topbar-title span { color: var(--ds-teal); }
    .ds-search {
      display: flex; align-items: center; gap: 8px;
      background: var(--ds-bg); border: 1px solid var(--ds-border);
      border-radius: 10px; padding: 7px 14px; min-width: 220px;
      font-size: 13px; color: var(--ds-slate);
    }
    .ds-search input {
      background: none; border: none; outline: none; font-family: 'DM Sans'; font-size: 13px;
      color: var(--ds-text); width: 100%;
    }
    .ds-search input::placeholder { color: var(--ds-slate); }
    .ds-icon-btn {
      width: 36px; height: 36px; border-radius: 10px;
      background: var(--ds-bg); border: 1px solid var(--ds-border);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; color: var(--ds-slate); transition: all 0.15s; position: relative;
    }
    .ds-icon-btn:hover { background: var(--ds-border); color: var(--ds-text); }
    .ds-icon-btn .ds-dot {
      position: absolute; top: 6px; right: 6px;
      width: 7px; height: 7px; background: var(--ds-red);
      border-radius: 50%; border: 1.5px solid white;
    }
    .ds-role-pill {
      display: flex; align-items: center; gap: 6px;
      padding: 5px 12px; border-radius: 100px; font-size: 11px;
      font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;
      border: 1.5px solid;
    }
    .ds-live-dot {
      width: 7px; height: 7px; border-radius: 50%;
      animation: dsPulse 2s infinite;
    }
    @keyframes dsPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.8)} }

    /* ── Main content ── */
    .ds-main {
      margin-left: var(--ds-sidebar-w);
      padding-top: 60px;
      min-height: 100vh;
      background: var(--ds-bg);
    }
    .ds-content { padding: 28px 32px; }

    /* ── Stat cards ── */
    .ds-stat-grid { display: grid; gap: 16px; }
    .ds-stat-card {
      background: var(--ds-white); border-radius: 16px;
      border: 1px solid var(--ds-border);
      padding: 20px 24px; position: relative; overflow: hidden;
      transition: all 0.2s;
    }
    .ds-stat-card:hover { box-shadow: 0 8px 24px rgba(0,0,0,0.07); transform: translateY(-1px); }
    .ds-stat-card::before {
      content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
      opacity: 0; transition: opacity 0.2s;
    }
    .ds-stat-card:hover::before { opacity: 1; }
    .ds-stat-card.teal::before { background: linear-gradient(90deg, #0D9488, #06B6D4); }
    .ds-stat-card.red::before   { background: linear-gradient(90deg, #EF4444, #F97316); }
    .ds-stat-card.amber::before { background: linear-gradient(90deg, #F59E0B, #EAB308); }
    .ds-stat-card.indigo::before{ background: linear-gradient(90deg, #6366F1, #8B5CF6); }
    .ds-stat-icon {
      width: 40px; height: 40px; border-radius: 12px;
      display: flex; align-items: center; justify-content: center; margin-bottom: 12px;
      font-size: 18px;
    }
    .ds-stat-icon.teal  { background: #CCFBF1; }
    .ds-stat-icon.red   { background: #FEE2E2; }
    .ds-stat-icon.amber { background: #FEF3C7; }
    .ds-stat-icon.indigo{ background: #EEF2FF; }
    .ds-stat-value {
      font-family: 'Sora', sans-serif; font-size: 30px; font-weight: 800;
      line-height: 1; margin-bottom: 4px;
    }
    .ds-stat-value.teal  { color: #0D9488; }
    .ds-stat-value.red   { color: #EF4444; }
    .ds-stat-value.amber { color: #F59E0B; }
    .ds-stat-value.indigo{ color: #6366F1; }
    .ds-stat-value.dark  { color: var(--ds-text); }
    .ds-stat-label { font-size: 12px; font-weight: 700; color: var(--ds-slate); text-transform: uppercase; letter-spacing: 0.06em; }
    .ds-stat-sub { font-size: 12px; color: #94A3B8; margin-top: 2px; }

    /* ── Cards ── */
    .ds-card {
      background: var(--ds-white); border-radius: 16px;
      border: 1px solid var(--ds-border); overflow: hidden;
    }
    .ds-card-header {
      padding: 16px 24px; border-bottom: 1px solid var(--ds-border);
      display: flex; align-items: center; justify-content: space-between;
    }
    .ds-card-title {
      font-family: 'Sora', sans-serif; font-size: 14px; font-weight: 700;
      color: var(--ds-text); display: flex; align-items: center; gap: 8px;
    }
    .ds-card-body { padding: 20px 24px; }

    /* ── Badges / Pills ── */
    .ds-badge {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 3px 10px; border-radius: 100px;
      font-size: 11px; font-weight: 700; letter-spacing: 0.04em;
      text-transform: uppercase; border: 1px solid;
    }
    .ds-badge.active  { background: #F0FDF4; color: #15803D; border-color: #BBF7D0; }
    .ds-badge.pending { background: #FFFBEB; color: #B45309; border-color: #FDE68A; }
    .ds-badge.critical{ background: #FEF2F2; color: #DC2626; border-color: #FECACA; }
    .ds-badge.monitor { background: #FFF7ED; color: #C2410C; border-color: #FED7AA; }
    .ds-badge.log     { background: #F8FAFC; color: #64748B; border-color: #E2E8F0; }
    .ds-badge.alert   { background: #FEF2F2; color: #DC2626; border-color: #FECACA; }
    .ds-badge.flag    { background: #FFF7ED; color: #C2410C; border-color: #FED7AA; }
    .ds-badge.indigo  { background: #EEF2FF; color: #4338CA; border-color: #C7D2FE; }

    /* ── Buttons ── */
    .ds-btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 8px 18px; border-radius: 10px;
      font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600;
      cursor: pointer; border: none; transition: all 0.15s; white-space: nowrap;
    }
    .ds-btn-primary { background: var(--ds-teal); color: white; }
    .ds-btn-primary:hover { background: #0F766E; box-shadow: 0 4px 12px rgba(13,148,136,.35); }
    .ds-btn-secondary {
      background: var(--ds-bg); color: var(--ds-text);
      border: 1px solid var(--ds-border);
    }
    .ds-btn-secondary:hover { background: var(--ds-border); }
    .ds-btn-dark { background: #1E293B; color: white; }
    .ds-btn-dark:hover { background: #0F172A; }
    .ds-btn-ghost { background: transparent; color: var(--ds-slate); border: 1px solid var(--ds-border); }
    .ds-btn-ghost:hover { background: var(--ds-bg); color: var(--ds-text); }
    .ds-btn-danger { background: #FEF2F2; color: #DC2626; border: 1px solid #FECACA; }
    .ds-btn-danger:hover { background: #DC2626; color: white; }
    .ds-btn-sm { padding: 6px 12px; font-size: 12px; border-radius: 8px; }

    /* ── Alert cards ── */
    .ds-alert-card {
      background: var(--ds-white); border-radius: 16px;
      border: 1px solid var(--ds-border); overflow: hidden;
      transition: all 0.2s; position: relative;
    }
    .ds-alert-card:hover { box-shadow: 0 8px 28px rgba(0,0,0,0.08); }
    .ds-alert-stripe {
      position: absolute; left: 0; top: 0; bottom: 0; width: 4px;
    }
    .ds-alert-stripe.critical { background: var(--ds-red); }
    .ds-alert-stripe.monitor  { background: #F97316; }

    /* ── Patient card ── */
    .ds-patient-card {
      background: var(--ds-white); border-radius: 16px; border: 1px solid var(--ds-border);
      overflow: hidden; transition: all 0.2s; cursor: pointer;
    }
    .ds-patient-card:hover { box-shadow: 0 8px 24px rgba(0,0,0,0.08); transform: translateY(-2px); }
    .ds-patient-card.critical { border-color: #FECACA; }
    .ds-patient-card.pending { opacity: .75; cursor: default; }
    .ds-patient-card.pending:hover { box-shadow: none; transform: none; }
    .ds-patient-card-bar { height: 4px; width: 100%; }

    /* ── Risk gauge ── */
    .ds-risk-gauge {
      width: 72px; height: 72px; border-radius: 50%; position: relative;
      display: flex; align-items: center; justify-content: center;
      font-family: 'Sora', sans-serif; font-size: 22px; font-weight: 800;
    }
    .ds-risk-gauge.critical { background: #FEF2F2; color: #DC2626; border: 3px solid #FECACA; }
    .ds-risk-gauge.monitor  { background: #FFF7ED; color: #EA580C; border: 3px solid #FED7AA; }

    /* ── Timeline ── */
    .ds-timeline { position: relative; padding-left: 24px; }
    .ds-timeline::before {
      content: ''; position: absolute; left: 7px; top: 8px; bottom: 8px;
      width: 2px; background: var(--ds-border); border-radius: 2px;
    }
    .ds-timeline-item { position: relative; padding-bottom: 24px; }
    .ds-timeline-dot {
      position: absolute; left: -21px; top: 4px;
      width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--ds-bg);
      transition: transform 0.2s;
    }
    .ds-timeline-item:hover .ds-timeline-dot { transform: scale(1.2); }
    .ds-timeline-dot.completed { background: var(--ds-teal); }
    .ds-timeline-dot.pending   { background: var(--ds-border); }
    .ds-timeline-dot.med       { background: #3B82F6; }
    .ds-timeline-dot.meal      { background: #F59E0B; }

    /* ── Chat bubble ── */
    .ds-bubble-nurse {
      background: var(--ds-white); border: 1px solid var(--ds-border);
      color: var(--ds-text); border-radius: 16px 16px 16px 4px;
      padding: 12px 16px; font-size: 14px; line-height: 1.6;
      box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    }
    .ds-bubble-patient {
      background: var(--ds-teal); color: white;
      border-radius: 16px 16px 4px 16px;
      padding: 12px 16px; font-size: 14px; line-height: 1.6;
    }

    /* ── Vitals ── */
    .ds-vital-bar {
      height: 6px; border-radius: 3px; background: #F1F5F9; overflow: hidden; margin-top: 8px;
    }
    .ds-vital-fill { height: 100%; border-radius: 3px; transition: width 1s ease; }

    /* ── Misc ── */
    .ds-divider { height: 1px; background: var(--ds-border); margin: 0 -24px; }
    .ds-empty-state {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 64px 24px; text-align: center;
    }
    .ds-empty-icon {
      width: 72px; height: 72px; border-radius: 24px;
      display: flex; align-items: center; justify-content: center;
      font-size: 32px; margin-bottom: 20px; background: #F8FAFC; border: 1px solid var(--ds-border);
    }
    .ds-spinner {
      width: 18px; height: 18px; border: 2.5px solid rgba(255,255,255,0.3);
      border-top-color: white; border-radius: 50%; animation: dsSpin 0.7s linear infinite;
    }
    @keyframes dsSpin { to { transform: rotate(360deg); } }
    .ds-pulse-ring {
      width: 8px; height: 8px; border-radius: 50%;
      animation: dsPulse 2s infinite;
    }
    .ds-pulse-ring.green { background: var(--ds-green); }
    .ds-pulse-ring.red   { background: var(--ds-red); }
    .ds-pulse-ring.amber { background: var(--ds-amber); }

    /* ── Page fade in ── */
    .ds-page-enter { animation: dsPageIn 0.35s ease both; }
    @keyframes dsPageIn { from { opacity:0; transform: translateY(10px); } to { opacity:1; transform: translateY(0); } }

    @media (max-width: 768px) {
      :root { --ds-sidebar-w: 0px; }
      .ds-sidebar { display: none; }
      .ds-topbar { left: 0; }
      .ds-content { padding: 16px; }
    }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
    }
  `;
  document.head.appendChild(style);
};

export const DsLogo = () => (
  <svg viewBox="0 0 36 36" width="32" height="32" fill="none" aria-hidden="true">
    <rect width="36" height="36" rx="10" fill="#0B1629"/>
    <path d="M18 6v5M18 25v5M6 18h5M25 18h5" stroke="#2DD4BF" strokeWidth="2" strokeLinecap="round"/>
    <path d="M18 10v16M10 18h16" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
    <circle cx="18" cy="18" r="3" fill="#2DD4BF"/>
  </svg>
);

export const NavItem = ({ icon, label, to, badge, onClick, active }) => {
  const location = useLocation();
  const isActive = active !== undefined ? active : location.pathname === to;
  const Tag = to ? Link : 'button';
  return (
    <Tag to={to} onClick={onClick} className={`ds-nav-item${isActive ? ' active' : ''}`}>
      <span className="ds-nav-icon" aria-hidden="true">{icon}</span>
      <span>{label}</span>
      {badge > 0 && <span className="ds-nav-badge">{badge}</span>}
    </Tag>
  );
};

const DashboardShell = ({
  children,
  roleName,
  roleColor = '#0D9488',
  roleBg = 'rgba(13,148,136,0.15)',
  userName = '',
  userInitial = '?',
  topbarTitle,
  topbarSub,
  sidebarTop,     
  sidebarBottom,  
  alertCount = 0,
}) => {
  useEffect(() => { injectDashboardStyles(); }, []);

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* ── Sidebar ── */}
      <aside className="ds-sidebar" role="navigation" aria-label="Dashboard navigation">
        <Link to="/" className="ds-sidebar-logo" aria-label="AgenticNurse home">
          <DsLogo />
          <div>
            <div className="ds-logo-text">Agentic<span>Nurse</span></div>
            <div className="ds-logo-sub">Clinical AI</div>
          </div>
        </Link>

        <div className="ds-sidebar-section" style={{ flex: 1, overflowY: 'auto' }}>
          {sidebarTop}
        </div>

        <div className="ds-sidebar-bottom">
          {sidebarBottom}
          <div className="ds-user-pill" style={{ marginTop: 8 }}>
            <div className="ds-user-avatar" aria-hidden="true">{userInitial}</div>
            <div>
              <div className="ds-user-name">{userName || roleName}</div>
              <div className="ds-user-role">{roleName}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Top bar ── */}
      <header className="ds-topbar" role="banner">
        <div className="ds-topbar-title">
          {topbarTitle}
          {topbarSub && <span style={{ fontSize: 12, fontWeight: 400, color: '#94A3B8', marginLeft: 10 }}>{topbarSub}</span>}
        </div>

        <div className="ds-search" role="search">
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input placeholder="Search patients, alerts..." aria-label="Search" />
        </div>

        {/* Notification bell */}
        <div className="ds-icon-btn" role="button" aria-label={`${alertCount} notifications`} tabIndex={0}>
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          {alertCount > 0 && <span className="ds-dot" aria-hidden="true"/>}
        </div>

        {/* Role pill */}
        <div className="ds-role-pill" style={{ color: roleColor, borderColor: roleColor, background: roleBg }}>
          <span className="ds-live-dot" style={{ background: roleColor }}/>
          {roleName}
        </div>

        {/* Back to landing */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#64748B', textDecoration: 'none', padding: '6px 10px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'white', transition: 'all .15s' }}
          aria-label="Back to home page">
          ← Home
        </Link>
      </header>

      {/* ── Content ── */}
      <main className="ds-main" role="main">
        <div className="ds-content ds-page-enter">
          {children}
        </div>
      </main>
    </div>
  );
};

export default DashboardShell;