import { useState, useEffect } from "react";

const API_BASE = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";

const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');
    @import url('https://fonts.googleapis.com/icon?family=Material+Icons+Round');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --teal:       #0D7F7F;
      --teal-dark:  #0A6A6A;
      --teal-light: #0FB8B8;
      --teal-pale:  #E6F7F7;
      --navy:       #0F2940;
      --navy-mid:   #1A3D5C;
      --slate:      #4A6272;
      --muted:      #8BA0AD;
      --bg:         #FFFFFF;
      --bg-soft:    #F7FBFC;
      --bg-card:    #F0F9F9;
      --accent:     #FF6B35;
      --indigo:     #4F46E5;
      --indigo-pale:#EEF2FF;
      --indigo-mid: #C7D2FE;
      --red:        #E53935;
      --border:     #D9ECEC;
      --shadow:     0 4px 24px rgba(13,127,127,0.10);
      --shadow-lg:  0 12px 48px rgba(13,127,127,0.15);
    }

    html { scroll-behavior: smooth; }
    body { font-family: 'DM Sans', sans-serif; background: var(--bg); color: var(--navy); overflow-x: hidden; }
    .font-display { font-family: 'Playfair Display', serif; }
    .font-mono    { font-family: 'DM Mono', monospace; }

    .reveal { opacity:0; transform:translateY(32px); transition:opacity .7s ease,transform .7s ease; }
    .reveal.visible { opacity:1; transform:translateY(0); }
    .reveal-left  { opacity:0; transform:translateX(-32px); transition:opacity .7s ease,transform .7s ease; }
    .reveal-left.visible  { opacity:1; transform:translateX(0); }
    .reveal-right { opacity:0; transform:translateX(32px);  transition:opacity .7s ease,transform .7s ease; }
    .reveal-right.visible { opacity:1; transform:translateX(0); }
    .stagger > * { opacity:0; transform:translateY(24px); transition:opacity .6s ease,transform .6s ease; }
    .stagger.visible > *:nth-child(1) { opacity:1; transform:translateY(0); transition-delay:0s; }
    .stagger.visible > *:nth-child(2) { opacity:1; transform:translateY(0); transition-delay:.1s; }
    .stagger.visible > *:nth-child(3) { opacity:1; transform:translateY(0); transition-delay:.2s; }
    .stagger.visible > *:nth-child(4) { opacity:1; transform:translateY(0); transition-delay:.3s; }
    .stagger.visible > *:nth-child(5) { opacity:1; transform:translateY(0); transition-delay:.4s; }

    @keyframes float  { 0%,100%{ transform:translateY(0); } 50%{ transform:translateY(-8px); } }
    @keyframes dash   { to { stroke-dashoffset:0; } }
    @keyframes slideUp { from{transform:translateY(30px);opacity:0;} to{transform:translateY(0);opacity:1;} }
    @keyframes spin   { to { transform:rotate(360deg); } }
    @keyframes pulse  { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(1.3)} }

    .float-anim { animation: float 4s ease-in-out infinite; }
    .flow-path   { stroke-dasharray:300; stroke-dashoffset:300; animation:dash 2s ease forwards; }
    .flow-path-2 { stroke-dasharray:300; stroke-dashoffset:300; animation:dash 2s ease .5s forwards; }
    .flow-path-3 { stroke-dasharray:300; stroke-dashoffset:300; animation:dash 2s ease .8s forwards; }

    .btn-primary {
      display:inline-flex; align-items:center; gap:8px; padding:13px 28px; border-radius:50px;
      background:var(--teal); color:#fff; font-family:'DM Sans',sans-serif; font-weight:600;
      font-size:15px; border:none; cursor:pointer; transition:background .2s,transform .15s,box-shadow .2s;
      text-decoration:none;
    }
    .btn-primary:hover { background:var(--teal-dark); transform:translateY(-2px); box-shadow:0 8px 24px rgba(13,127,127,.30); }
    .btn-primary:disabled { opacity:.6; cursor:not-allowed; transform:none; }
    .btn-outline {
      display:inline-flex; align-items:center; gap:8px; padding:12px 26px; border-radius:50px;
      background:transparent; color:var(--teal); font-family:'DM Sans',sans-serif; font-weight:600;
      font-size:15px; border:2px solid var(--teal); cursor:pointer;
      transition:background .2s,transform .15s; text-decoration:none;
    }
    .btn-outline:hover { background:var(--teal-pale); transform:translateY(-2px); }

    .section-label {
      display:inline-block; font-family:'DM Mono',monospace; font-size:11px; font-weight:500;
      letter-spacing:2px; text-transform:uppercase; color:var(--teal);
      padding:4px 14px; background:var(--teal-pale); border-radius:50px; margin-bottom:14px;
    }
    .nav-link {
      font-size:14px; font-weight:500; color:var(--navy); text-decoration:none; padding:6px 2px;
      border-bottom:2px solid transparent; transition:color .2s,border-color .2s;
      background:none; border-top:none; border-left:none; border-right:none; cursor:pointer;
      font-family:'DM Sans',sans-serif;
    }
    .nav-link:hover { color:var(--teal); border-bottom-color:var(--teal); }

    .step-num {
      width:44px; height:44px; border-radius:50%; background:var(--teal); color:#fff;
      display:flex; align-items:center; justify-content:center;
      font-family:'DM Mono',monospace; font-weight:500; font-size:15px; flex-shrink:0;
    }
    .agent-card { border-radius:20px; padding:28px 24px; transition:transform .2s,box-shadow .2s; border:1px solid var(--border); }
    .agent-card:hover { transform:translateY(-6px); box-shadow:var(--shadow-lg); }
    .tab-btn {
      padding:9px 20px; border-radius:50px; font-size:13px; font-weight:600;
      border:1.5px solid var(--border); background:#fff; color:var(--slate);
      cursor:pointer; transition:all .2s; font-family:'DM Sans',sans-serif;
    }
    .tab-btn.active { background:var(--teal); color:#fff; border-color:var(--teal); }
    .tab-btn:hover:not(.active) { background:var(--teal-pale); color:var(--teal); }
    .tech-badge {
      display:inline-flex; align-items:center; gap:6px; padding:6px 14px; border-radius:50px;
      background:var(--teal-pale); color:var(--teal); font-size:12px; font-weight:600;
      border:1px solid var(--border);
    }

    .modal-overlay {
      position:fixed; inset:0; background:rgba(0,0,0,.55); display:flex;
      align-items:center; justify-content:center; z-index:1000; backdrop-filter:blur(5px);
    }
    .modal-box {
      background:#fff; border-radius:24px; padding:40px; max-width:480px; width:90%;
      box-shadow:0 24px 64px rgba(0,0,0,.22); animation:slideUp .3s ease; max-height:90vh; overflow-y:auto;
    }
    .auth-tab {
      flex:1; padding:11px; font-size:14px; font-weight:600; cursor:pointer;
      border:none; background:none; font-family:'DM Sans',sans-serif;
      color:var(--slate); border-bottom:2px solid var(--border); transition:all .2s;
    }
    .auth-tab.active { color:var(--teal); border-bottom-color:var(--teal); }
    .role-card {
      display:flex; align-items:center; gap:14px; padding:14px 16px;
      border-radius:12px; border:1.5px solid var(--border); text-decoration:none;
      background:#fff; cursor:pointer; transition:all .2s; width:100%;
      font-family:'DM Sans',sans-serif; text-align:left;
    }
    .role-card:hover { border-color:var(--teal); background:var(--bg-soft); }
    .form-input {
      font-family:'DM Sans',sans-serif; padding:12px 16px; border:1.5px solid var(--border);
      border-radius:10px; font-size:14px; color:var(--navy); outline:none;
      width:100%; background:#fff; transition:border-color .2s;
    }
    .form-input:focus { border-color:var(--teal); }
    .form-select { appearance:none; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%234A6272' viewBox='0 0 16 16'%3E%3Cpath d='M7.247 11.14L2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 14px center; }
    .alert-error   { background:#FFF5F5; border:1px solid #FFD5D5; border-radius:10px; padding:10px 14px; font-size:13px; color:#C62828; }
    .alert-success { background:var(--indigo-pale); border:1px solid var(--indigo-mid); border-radius:10px; padding:10px 14px; font-size:13px; color:#3730A3; }
    .cred-box { background:var(--navy); border-radius:14px; padding:20px 24px; margin-top:16px; font-family:'DM Mono',monospace; }
    .cred-row { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; }
    .cred-label { font-size:11px; color:rgba(255,255,255,.5); text-transform:uppercase; letter-spacing:1px; }
    .cred-value { font-size:16px; color:var(--teal-light); font-weight:500; letter-spacing:2px; }
    .spinner { width:18px; height:18px; border:2px solid rgba(255,255,255,.3); border-top-color:#fff; border-radius:50%; animation:spin .7s linear infinite; }
    .checkbox-row { display:flex; gap:10px; align-items:flex-start; cursor:pointer; }
    .checkbox-row input { width:16px; height:16px; accent-color:var(--teal); margin-top:2px; flex-shrink:0; cursor:pointer; }
    .purchase-card { background:var(--teal-pale); border:1.5px solid var(--border); border-radius:28px; padding:48px 44px; }

    @media (max-width: 768px) {
      .desktop-nav { display:none !important; }
      .hero-grid   { grid-template-columns:1fr !important; }
      .two-col     { grid-template-columns:1fr !important; }
      .purchase-grid { grid-template-columns:1fr !important; }
      .modal-box   { padding:28px 20px; }
    }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { animation-duration:.01ms !important; transition-duration:.01ms !important; }
      .reveal,.reveal-left,.reveal-right,.stagger > * { opacity:1 !important; transform:none !important; }
    }
    ::-webkit-scrollbar { width:6px; }
    ::-webkit-scrollbar-thumb { background:var(--teal); border-radius:3px; }
  `}</style>
);

function useScrollReveal() {
  useEffect(() => {
    const targets = document.querySelectorAll(".reveal,.reveal-left,.reveal-right,.stagger");
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("visible"); }),
      { threshold: 0.12 }
    );
    targets.forEach((t) => obs.observe(t));
    return () => obs.disconnect();
  }, []);
}

function RoleChooser({ onSelectRole, onClose }) {
  const roles = [
    { id:"nurse",   icon:"local_hospital",  label:"Nurse / Care Team",  desc:"Monitor patients, upload discharge summaries",       color:"#0D7F7F" },
    { id:"patient", icon:"person",          label:"Patient / Family",   desc:"Access your daily care plan and AI nurse chat",      color:"#4F46E5" },
    { id:"doctor",  icon:"medical_services",label:"Doctor / Clinician", desc:"Review critical escalations and patient alerts",      color:"#FF6B35" },
  ];
  return (
    <div className="modal-box">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
        <div>
          <h3 className="font-display" style={{ fontSize:22, color:"var(--navy)" }}>Get Access</h3>
          <p style={{ fontSize:13, color:"var(--slate)", marginTop:4 }}>Select your role to continue</p>
        </div>
        <button onClick={onClose} style={{ background:"none",border:"none",cursor:"pointer",color:"var(--slate)" }}>
          <span className="material-icons-round" style={{fontSize:22}}>close</span>
        </button>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {roles.map((r) => (
          <button key={r.id} className="role-card" onClick={() => onSelectRole(r.id)}>
            <div style={{ width:42, height:42, borderRadius:10, background:`${r.color}18`,
              display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <span className="material-icons-round" style={{ color:r.color, fontSize:20 }}>{r.icon}</span>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:600, fontSize:14, color:"var(--navy)" }}>{r.label}</div>
              <div style={{ fontSize:12, color:"var(--slate)", marginTop:2 }}>{r.desc}</div>
            </div>
            <span className="material-icons-round" style={{ fontSize:18, color:"var(--muted)" }}>chevron_right</span>
          </button>
        ))}
      </div>
      <p style={{ fontSize:11, color:"var(--muted)", marginTop:16, textAlign:"center" }}>
        🔒 HIPAA compliant · Role-based access control
      </p>
    </div>
  );
}

function NurseAuthModal({ onBack, onClose }) {
  const [hospitalId, setHospitalId] = useState("");
  const [password,   setPassword]   = useState("");
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");

  const handleLogin = async () => {
    if (!hospitalId.trim() || !password.trim()) { setError("Please fill in all fields."); return; }
    setLoading(true); setError("");
    try {
      const res  = await fetch(`${API_BASE}/auth/nurse/login`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ hospital_id: hospitalId.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.detail || "Invalid credentials."); return; }
      sessionStorage.setItem("authToken",  data.token);
      sessionStorage.setItem("authRole",   "nurse");
      sessionStorage.setItem("hospitalId", hospitalId.trim());
      window.location.href = "/nurse";
    } catch { setError("Network error. Please try again."); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-box">
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:24 }}>
        <button onClick={onBack} style={{ background:"none",border:"none",cursor:"pointer",color:"var(--slate)",padding:4 }}>
          <span className="material-icons-round" style={{fontSize:20}}>arrow_back</span>
        </button>
        <div>
          <h3 className="font-display" style={{ fontSize:20, color:"var(--navy)" }}>Nurse Login</h3>
          <p style={{ fontSize:12, color:"var(--slate)" }}>Enter your hospital credentials</p>
        </div>
        <button onClick={onClose} style={{ background:"none",border:"none",cursor:"pointer",color:"var(--slate)",marginLeft:"auto" }}>
          <span className="material-icons-round" style={{fontSize:20}}>close</span>
        </button>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        <div>
          <label style={{ fontSize:12, fontWeight:600, color:"var(--slate)", display:"block", marginBottom:6 }}>HOSPITAL ID</label>
          <input className="form-input" placeholder="e.g. HOSP-8271"
            value={hospitalId} onChange={(e) => setHospitalId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()} />
        </div>
        <div>
          <label style={{ fontSize:12, fontWeight:600, color:"var(--slate)", display:"block", marginBottom:6 }}>PASSWORD</label>
          <input className="form-input" type="password" placeholder="Your nurse password"
            value={password} onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()} />
        </div>
        {error && <div className="alert-error">{error}</div>}
        <button className="btn-primary" style={{ justifyContent:"center", marginTop:4 }}
          onClick={handleLogin} disabled={loading}>
          {loading ? <div className="spinner"/> : <><span className="material-icons-round" style={{fontSize:17}}>login</span>Sign In</>}
        </button>
      </div>
      <p style={{ fontSize:12, color:"var(--slate)", marginTop:16, textAlign:"center" }}>
        Don't have credentials? <a href="#purchase" style={{ color:"var(--teal)", fontWeight:600 }} onClick={onClose}>Purchase access →</a>
      </p>
    </div>
  );
}

function PatientAuthModal({ onBack, onClose }) {
  const [patientId, setPatientId] = useState("");
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");

  const handleAccess = async () => {
    if (!patientId.trim()) { setError("Please enter your Patient ID."); return; }
    setLoading(true); setError("");
    try {
      const res  = await fetch(`${API_BASE}/auth/patient/access`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ patient_id: patientId.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.detail || "Patient ID not found."); return; }
      sessionStorage.setItem("authToken", data.token);
      sessionStorage.setItem("authRole",  "patient");
      sessionStorage.setItem("patientId", patientId.trim());
      window.location.href = "/patient";
    } catch { setError("Network error. Please try again."); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-box">
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:24 }}>
        <button onClick={onBack} style={{ background:"none",border:"none",cursor:"pointer",color:"var(--slate)",padding:4 }}>
          <span className="material-icons-round" style={{fontSize:20}}>arrow_back</span>
        </button>
        <div>
          <h3 className="font-display" style={{ fontSize:20, color:"var(--navy)" }}>Patient Access</h3>
          <p style={{ fontSize:12, color:"var(--slate)" }}>No password required</p>
        </div>
        <button onClick={onClose} style={{ background:"none",border:"none",cursor:"pointer",color:"var(--slate)",marginLeft:"auto" }}>
          <span className="material-icons-round" style={{fontSize:20}}>close</span>
        </button>
      </div>
      <div style={{ background:"var(--teal-pale)", borderRadius:12, padding:"12px 16px", marginBottom:16,
        display:"flex", gap:10, alignItems:"flex-start" }}>
        <span className="material-icons-round" style={{ color:"var(--teal)", fontSize:18, marginTop:1 }}>info</span>
        <p style={{ fontSize:13, color:"var(--navy)", lineHeight:1.5 }}>
          Your Patient ID was provided by your nurse at discharge. It looks like <strong>p_abc123</strong>.
        </p>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        <div>
          <label style={{ fontSize:12, fontWeight:600, color:"var(--slate)", display:"block", marginBottom:6 }}>PATIENT ID</label>
          <input className="form-input" placeholder="e.g. p_77e3af"
            value={patientId} onChange={(e) => setPatientId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAccess()} />
        </div>
        {error && <div className="alert-error">{error}</div>}
        <button className="btn-primary" style={{ justifyContent:"center", marginTop:4 }}
          onClick={handleAccess} disabled={loading}>
          {loading ? <div className="spinner"/> : <><span className="material-icons-round" style={{fontSize:17}}>arrow_forward</span>Access My Dashboard</>}
        </button>
      </div>
    </div>
  );
}

function DoctorAuthModal({ onBack, onClose }) {
  const [tab,      setTab]      = useState("signin");
  const [name,     setName]     = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  const resetFields = (newTab) => { setTab(newTab); setError(""); setName(""); setEmail(""); setPassword(""); };

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) { setError("Email and password are required."); return; }
    if (tab === "register" && !name.trim()) { setError("Name is required to register."); return; }
    setLoading(true); setError("");
    try {
      const endpoint = tab === "signin" ? "/auth/doctor/login" : "/auth/doctor/register";
      const body = tab === "signin"
        ? { email: email.trim(), password }
        : { name: name.trim(), email: email.trim(), password };
      const res  = await fetch(`${API_BASE}${endpoint}`, {
        method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.detail || "Authentication failed."); return; }
      sessionStorage.setItem("authToken", data.token);
      sessionStorage.setItem("authRole",  "doctor");
      window.location.href = "/doctor";
    } catch { setError("Network error. Please try again."); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-box">
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20 }}>
        <button onClick={onBack} style={{ background:"none",border:"none",cursor:"pointer",color:"var(--slate)",padding:4 }}>
          <span className="material-icons-round" style={{fontSize:20}}>arrow_back</span>
        </button>
        <div>
          <h3 className="font-display" style={{ fontSize:20, color:"var(--navy)" }}>Doctor Access</h3>
          <p style={{ fontSize:12, color:"var(--slate)" }}>Clinician dashboard — critical escalations only</p>
        </div>
        <button onClick={onClose} style={{ background:"none",border:"none",cursor:"pointer",color:"var(--slate)",marginLeft:"auto" }}>
          <span className="material-icons-round" style={{fontSize:20}}>close</span>
        </button>
      </div>
      <div style={{ display:"flex", borderBottom:"2px solid var(--border)", marginBottom:20 }}>
        {[["signin","Sign In"],["register","Register"]].map(([id,label]) => (
          <button key={id} className={`auth-tab ${tab === id ? "active" : ""}`} onClick={() => resetFields(id)}>{label}</button>
        ))}
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        {tab === "register" && (
          <div>
            <label style={{ fontSize:12, fontWeight:600, color:"var(--slate)", display:"block", marginBottom:6 }}>FULL NAME</label>
            <input className="form-input" placeholder="Dr. Jane Smith" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        )}
        <div>
          <label style={{ fontSize:12, fontWeight:600, color:"var(--slate)", display:"block", marginBottom:6 }}>EMAIL</label>
          <input className="form-input" type="email" placeholder="doctor@hospital.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize:12, fontWeight:600, color:"var(--slate)", display:"block", marginBottom:6 }}>PASSWORD</label>
          <input className="form-input" type="password" placeholder={tab === "register" ? "Create a password" : "Your password"}
            value={password} onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()} />
        </div>
        {error && <div className="alert-error">{error}</div>}
        <button className="btn-primary" style={{ justifyContent:"center", marginTop:4 }} onClick={handleSubmit} disabled={loading}>
          {loading ? <div className="spinner"/> : (
            <><span className="material-icons-round" style={{fontSize:17}}>{tab === "signin" ? "login" : "person_add"}</span>
            {tab === "signin" ? "Sign In" : "Create Account"}</>
          )}
        </button>
      </div>
    </div>
  );
}

function AuthModalController({ onClose }) {
  const [role, setRole] = useState(null);
  const inner = () => {
    if (!role)          return <RoleChooser   onSelectRole={setRole} onClose={onClose} />;
    if (role === "nurse")   return <NurseAuthModal   onBack={() => setRole(null)} onClose={onClose} />;
    if (role === "patient") return <PatientAuthModal onBack={() => setRole(null)} onClose={onClose} />;
    if (role === "doctor")  return <DoctorAuthModal  onBack={() => setRole(null)} onClose={onClose} />;
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}>{inner()}</div>
    </div>
  );
}

function HeroFlowDiagram() {
  return (
    <svg width="490" height="440" viewBox="0 0 440 390" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ maxWidth:"100%", height:"auto" }}>
      <rect width="440" height="390" rx="24" fill="#F0F9F9"/>

      <rect x="16" y="128" width="100" height="76" rx="14" fill="#fff" stroke="#B2DFDF" strokeWidth="1.5"/>
      <circle cx="66" cy="147" r="10" fill="#E6F7F7" stroke="#B2DFDF" strokeWidth="1"/>
      <circle cx="66" cy="144" r="5" fill="#8BA0AD"/>
      <path d="M56 158 Q66 152 76 158" fill="#8BA0AD"/>
      <text x="66" y="172" textAnchor="middle" fontSize="10" fontWeight="700" fill="#0F2940" fontFamily="DM Sans,sans-serif">Patient</text>
      <text x="66" y="185" textAnchor="middle" fontSize="8.5" fill="#4A6272" fontFamily="DM Sans,sans-serif">SMS · Voice · Photo</text>
      <path d="M118 166 L162 166" stroke="#0D7F7F" strokeWidth="2" strokeDasharray="4,3" className="flow-path"/>
      <polygon points="162,162 170,166 162,170" fill="#0D7F7F"/>

      <rect x="172" y="116" width="104" height="100" rx="16" fill="#0D7F7F"/>
      <rect x="208" y="125" width="32" height="26" rx="6" fill="rgba(255,255,255,.25)"/>
      <circle cx="218" cy="136" r="4" fill="white"/>
      <circle cx="230" cy="136" r="4" fill="white"/>
      <rect x="218" y="144" width="12" height="2.5" rx="1" fill="rgba(255,255,255,.6)"/>
      <rect x="222" y="120" width="4" height="5" rx="1" fill="rgba(255,255,255,.4)"/>
      <text x="224" y="166" textAnchor="middle" fontSize="12" fontWeight="700" fill="white" fontFamily="DM Sans,sans-serif">NurseAI</text>
      <text x="224" y="180" textAnchor="middle" fontSize="8.5" fill="rgba(255,255,255,.8)" fontFamily="DM Sans,sans-serif">Gemini 1.5 Pro</text>
      <text x="224" y="193" textAnchor="middle" fontSize="8.5" fill="rgba(255,255,255,.8)" fontFamily="DM Sans,sans-serif">LangGraph Agents</text>
      <path d="M278 166 L314 166" stroke="#0D7F7F" strokeWidth="2" strokeDasharray="4,3" className="flow-path-2"/>
      <polygon points="314,162 322,166 314,170" fill="#0D7F7F"/>

      <rect x="324" y="128" width="104" height="76" rx="14" fill="#fff" stroke="#FFCCAA" strokeWidth="1.5"/>
      <circle cx="376" cy="147" r="10" fill="#FFF0E8" stroke="#FFCCAA" strokeWidth="1"/>
      <circle cx="376" cy="144" r="5" fill="#FF6B35"/>
      <path d="M366 158 Q376 152 386 158" fill="#FF6B35"/>
      <path d="M371 158 Q368 163 372 165 Q376 167 380 165 Q384 163 381 158" stroke="#FF6B35" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      <circle cx="376" cy="165" r="2" fill="#FF6B35"/>
      <text x="376" y="176" textAnchor="middle" fontSize="10" fontWeight="700" fill="#0F2940" fontFamily="DM Sans,sans-serif">Clinician</text>
      <text x="376" y="188" textAnchor="middle" fontSize="8.5" fill="#E53935" fontFamily="DM Sans,sans-serif">Critical only</text>

      <rect x="172" y="28" width="104" height="50" rx="12" fill="#E6F7F7" stroke="#B2DFDF" strokeWidth="1.5"/>
      <text x="224" y="49" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#0D7F7F" fontFamily="DM Sans,sans-serif">ChromaDB RAG</text>
      <text x="224" y="64" textAnchor="middle" fontSize="8.5" fill="#4A6272" fontFamily="DM Sans,sans-serif">Discharge PDF → Context</text>
      <path d="M224 78 L224 114" stroke="#0D7F7F" strokeWidth="1.5" strokeDasharray="3,2"/>

      <rect x="12" y="264" width="106" height="38" rx="10" fill="#EEF2FF" stroke="#C7D2FE" strokeWidth="1.5"/>
      <rect x="22" y="272" width="18" height="14" rx="4" fill="#4F46E5" opacity="0.15"/>
      <path d="M22 282 L20 288 L28 284" fill="#4F46E5" opacity="0.3"/>
      <text x="76" y="280" textAnchor="middle" fontSize="9" fontWeight="700" fill="#4F46E5" fontFamily="DM Sans,sans-serif">Twilio SMS</text>
      <text x="76" y="293" textAnchor="middle" fontSize="8" fill="#4A6272" fontFamily="DM Sans,sans-serif">Proactive Reminders</text>
      <path d="M118 287 L172 210" stroke="#4F46E5" strokeWidth="1.5" strokeDasharray="3,2"/>

      <rect x="150" y="276" width="108" height="46" rx="10" fill="#FFF0E8" stroke="#FFCCAA" strokeWidth="1.5"/>
      <text x="204" y="297" textAnchor="middle" fontSize="9" fontWeight="700" fill="#FF6B35" fontFamily="DM Sans,sans-serif">Wound Analysis</text>
      <text x="204" y="311" textAnchor="middle" fontSize="8" fill="#4A6272" fontFamily="DM Sans,sans-serif">OpenCV + Gemini</text>
      <path d="M204 276 L218 218" stroke="#FF6B35" strokeWidth="1.5" strokeDasharray="3,2"/>

      <rect x="296" y="260" width="132" height="55" rx="14" fill="#E8EAF6" stroke="#9FA8DA" strokeWidth="1.5"/>

      <rect x="308" y="270" width="18" height="24" rx="5" fill="none" stroke="#3949AB" strokeWidth="2"/>
      <rect x="311" y="265" width="12" height="6" rx="2" fill="#9FA8DA"/>
      <rect x="311" y="294" width="12" height="6" rx="2" fill="#9FA8DA"/>
      <rect x="311" y="273" width="12" height="18" rx="3" fill="#3949AB"/>
      <polyline points="312,281 314,281 315,277 316,285 318,278 319,281 322,281"
        stroke="white" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>

      <text x="376" y="278" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#3949AB" fontFamily="DM Sans,sans-serif">ESP32 Watch</text>
      <text x="376" y="292" textAnchor="middle" fontSize="8" fill="#4A6272" fontFamily="DM Sans,sans-serif">MAX30102 · HR · SpO₂</text>
      <text x="376" y="305" textAnchor="middle" fontSize="8" fill="#4A6272" fontFamily="DM Sans,sans-serif">Real-time vitals stream</text>

      <circle cx="420" cy="270" r="5.5" fill="#E53935">
        <animate attributeName="r"       values="4;6.5;4"   dur="1.4s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="1;0.35;1"  dur="1.4s" repeatCount="indefinite"/>
      </circle>
      <circle cx="420" cy="270" r="3" fill="#E53935"/>

      <path d="M318 260 L256 218" stroke="#3949AB" strokeWidth="1.5" strokeDasharray="3,2" className="flow-path-3"/>
    </svg>
  );
}

function PurchaseForm() {
  const [form, setForm] = useState({
    hospital_name:"", hospital_email:"", city:"", country:"",
    bed_count:"", billing_contact:"", contact_sales:false, terms_accepted:false,
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [creds,   setCreds]   = useState(null);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handlePurchase = async () => {
    const { hospital_name, hospital_email, city, country, bed_count, terms_accepted } = form;
    if (!hospital_name || !hospital_email || !city || !country || !bed_count) {
      setError("Please fill in all required fields."); return;
    }
    if (!terms_accepted) { setError("You must accept the terms to continue."); return; }
    setLoading(true); setError("");
    try {
      const res  = await fetch(`${API_BASE}/hospital/purchase`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.detail || "Purchase failed. Please try again."); return; }
      setCreds({ hospital_id: data.hospital_id, nurse_password: data.nurse_password });
    } catch { setError("Network error. Please try again."); }
    finally { setLoading(false); }
  };

  if (creds) {
    return (
      <div className="purchase-card" style={{ textAlign:"center" }}>
        <div style={{ width:56, height:56, borderRadius:"50%", background:"var(--indigo-pale)",
          display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" }}>
          <span className="material-icons-round" style={{ color:"var(--indigo)", fontSize:28 }}>check_circle</span>
        </div>
        <h3 className="font-display" style={{ fontSize:24, color:"var(--navy)", marginBottom:8 }}>Hospital registered!</h3>
        <p style={{ color:"var(--slate)", fontSize:14, marginBottom:8 }}>
          Save these credentials securely — your nurse will need them to log in.
        </p>
        <div className="cred-box">
          <div className="cred-row">
            <span className="cred-label">Hospital ID</span>
            <span className="cred-value">{creds.hospital_id}</span>
          </div>
          <div className="cred-row" style={{ marginBottom:0 }}>
            <span className="cred-label">Nurse Password</span>
            <span className="cred-value">{creds.nurse_password}</span>
          </div>
        </div>
        <p style={{ fontSize:12, color:"var(--muted)", marginTop:16 }}>
          ⚠️ Production: credentials will be emailed to {form.hospital_email}. Save them now.
        </p>
        <button className="btn-primary" style={{ marginTop:20, justifyContent:"center" }}
          onClick={() => { setCreds(null); setForm({ hospital_name:"", hospital_email:"", city:"", country:"", bed_count:"", billing_contact:"", contact_sales:false, terms_accepted:false }); }}>
          Register another hospital
        </button>
      </div>
    );
  }

  return (
    <div className="purchase-card" id="purchase">
      <div style={{ textAlign:"center", marginBottom:32 }}>
        <span className="section-label">Purchase Access</span>
        <h2 className="font-display" style={{ fontSize:"clamp(24px,3vw,34px)", color:"var(--navy)", margin:"12px 0 10px" }}>
          Deploy NurseAI at your hospital
        </h2>
        <p style={{ color:"var(--slate)", fontSize:15, lineHeight:1.6, maxWidth:500, margin:"0 auto" }}>
          Register your hospital to get a unique ID and nurse credentials. Onboarding, EHR integration, and staff training included.
        </p>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }} className="purchase-grid">
        <div>
          <label style={{ fontSize:12, fontWeight:600, color:"var(--slate)", display:"block", marginBottom:6 }}>HOSPITAL NAME *</label>
          <input className="form-input" placeholder="City General Hospital"
            value={form.hospital_name} onChange={(e) => set("hospital_name", e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize:12, fontWeight:600, color:"var(--slate)", display:"block", marginBottom:6 }}>ADMIN EMAIL *</label>
          <input className="form-input" type="email" placeholder="admin@hospital.org"
            value={form.hospital_email} onChange={(e) => set("hospital_email", e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize:12, fontWeight:600, color:"var(--slate)", display:"block", marginBottom:6 }}>CITY *</label>
          <input className="form-input" placeholder="Mumbai"
            value={form.city} onChange={(e) => set("city", e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize:12, fontWeight:600, color:"var(--slate)", display:"block", marginBottom:6 }}>COUNTRY *</label>
          <input className="form-input" placeholder="India"
            value={form.country} onChange={(e) => set("country", e.target.value)} />
        </div>
      </div>

      <div style={{ marginBottom:14 }}>
        <label style={{ fontSize:12, fontWeight:600, color:"var(--slate)", display:"block", marginBottom:6 }}>EXPECTED USERS / BEDS *</label>
        <select className="form-input form-select" value={form.bed_count} onChange={(e) => set("bed_count", e.target.value)}>
          <option value="">Select scale</option>
          <option value="10">Small clinic — up to 10 beds</option>
          <option value="50">Mid-size hospital — up to 50 beds</option>
          <option value="100">Large hospital — up to 100 beds</option>
          <option value="10000">Enterprise / Multi-site — 100+ beds</option>
        </select>
      </div>

      <div style={{ marginBottom:14 }}>
        <label style={{ fontSize:12, fontWeight:600, color:"var(--slate)", display:"block", marginBottom:8 }}>BILLING</label>
        <div style={{ display:"flex", gap:10 }}>
          {[["card","Enter billing info"],[null,"Contact sales"]].map(([val,label]) => (
            <button key={label}
              style={{ flex:1, padding:"10px 14px", borderRadius:10, fontSize:13, fontWeight:600, cursor:"pointer",
                border:`1.5px solid ${form.contact_sales === (val === null) ? "var(--teal)" : "var(--border)"}`,
                background:form.contact_sales === (val === null) ? "var(--teal-pale)" : "#fff",
                color:form.contact_sales === (val === null) ? "var(--teal)" : "var(--slate)",
                transition:"all .2s", fontFamily:"DM Sans,sans-serif" }}
              onClick={() => set("contact_sales", val === null)}>
              {label}
            </button>
          ))}
        </div>
        {!form.contact_sales && (
          <input className="form-input" style={{ marginTop:10 }} placeholder="Card / PO number (placeholder — no real billing in MVP)"
            value={form.billing_contact} onChange={(e) => set("billing_contact", e.target.value)} />
        )}
        {form.contact_sales && (
          <div style={{ marginTop:10, padding:"10px 14px", background:"var(--teal-pale)", borderRadius:10,
            fontSize:13, color:"var(--teal)", fontWeight:500 }}>
            Our sales team will contact you at {form.hospital_email || "your email"} within 24 hours.
          </div>
        )}
      </div>

      <label className="checkbox-row" style={{ marginBottom:20 }}>
        <input type="checkbox" checked={form.terms_accepted} onChange={(e) => set("terms_accepted", e.target.checked)} />
        <span style={{ fontSize:13, color:"var(--slate)", lineHeight:1.5 }}>
          I accept the{" "}
          <button type="button" style={{ background:"none",border:"none",padding:0,color:"var(--teal)",fontWeight:600,
            cursor:"pointer",fontSize:"inherit",fontFamily:"inherit",textDecoration:"underline" }}>
            Terms of Service
          </button>{" "}and{" "}
          <button type="button" style={{ background:"none",border:"none",padding:0,color:"var(--teal)",fontWeight:600,
            cursor:"pointer",fontSize:"inherit",fontFamily:"inherit",textDecoration:"underline" }}>
            Privacy Policy
          </button>, including HIPAA data processing requirements.
        </span>
      </label>

      {error && <div className="alert-error" style={{ marginBottom:14 }}>{error}</div>}

      <button className="btn-primary" style={{ width:"100%", justifyContent:"center", padding:"14px 28px" }}
        onClick={handlePurchase} disabled={loading}>
        {loading ? <div className="spinner"/> : (
          <><span className="material-icons-round" style={{fontSize:18}}>rocket_launch</span>Register Hospital & Get Credentials</>
        )}
      </button>
      <p style={{ fontSize:11, color:"var(--muted)", marginTop:14, textAlign:"center" }}>
        🔒 HIPAA compliant infrastructure · Credentials generated instantly · No spam
      </p>
    </div>
  );
}

export default function LandingPage() {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [agentTab, setAgentTab] = useState("Clinical");
  useScrollReveal();

  const agents = {
    Clinical: [
      { name:"NurseAI",           icon:"healing",         color:"#E6F7F7", ic:"#0D7F7F", tag:"24/7 Patient Companion",
        bullets:["Multimodal check-ins via SMS, voice & photo","Personalized recovery roadmaps from discharge PDFs"] },
      { name:"Triage Agent",      icon:"monitor_heart",   color:"#FFF0E8", ic:"#FF6B35", tag:"Smart Risk Scorer",
        bullets:["Scores patient risk 1–10 using vitals + symptoms","Escalates only critical cases — zero alert fatigue"] },
      { name:"Caregiver Co-Pilot",icon:"family_restroom", color:"#EEF2FF", ic:"#4F46E5", tag:"Family Support",
        bullets:["Keeps families informed of recovery milestones","Surfaces red flags to caregivers automatically"] },
    ],
    Ops: [
      { name:"Watchdog Agent",    icon:"policy",               color:"#F0EEFF", ic:"#7B5EA7", tag:"Proactive Safety",
        bullets:["Monitors medication schedules, flags missed doses","Smart pantry — checks food-drug interactions"] },
      { name:"Reminder Agent",    icon:"notifications_active", color:"#FFF9E6", ic:"#F5A623", tag:"Twilio Outreach",
        bullets:["Scheduled SMS/WhatsApp medication reminders","Adapts frequency based on adherence patterns"] },
      { name:"Vitals Watch Agent",icon:"watch",                color:"#E8EAF6", ic:"#3949AB", tag:"ESP32 · MAX30102 IoT",
        bullets:["Streams heart-rate & SpO₂ from wearable in real time","Auto-alerts doctor when vitals breach safe thresholds"] },
    ],
    Analytics: [
      { name:"Insights Agent",    icon:"insights", color:"#E6F0FF", ic:"#1A3D5C", tag:"Population Health",
        bullets:["Tracks recovery trends across patient cohorts","Identifies systemic gaps for quality improvement"] },
      { name:"RAG Indexer",       icon:"storage",  color:"#E6F7F7", ic:"#0D7F7F", tag:"ChromaDB Knowledge Base",
        bullets:["Ingests discharge PDFs into vector store","Zero hallucinations — all responses grounded in records"] },
    ],
  };

  return (
    <>
      <GlobalStyles />
      {showAuthModal && <AuthModalController onClose={() => setShowAuthModal(false)} />}

      <div style={{ background:"var(--navy)", color:"rgba(255,255,255,.85)", textAlign:"center",
        padding:"10px 20px", fontSize:13, fontWeight:500 }}>
        🏥 Hackathon HD016 — Agentic AI that closes the gap after hospital discharge
        <a href="#how-it-works" style={{ color:"#7DD3FC", marginLeft:12, fontWeight:600 }}>See how →</a>
      </div>

=      <nav style={{ position:"sticky", top:0, zIndex:100, background:"rgba(255,255,255,.96)",
        backdropFilter:"blur(12px)", borderBottom:"1px solid var(--border)",
        padding:"0 5%", display:"flex", alignItems:"center", gap:24, height:64 }}>
        <a href="/" style={{ display:"flex", alignItems:"center", gap:10, textDecoration:"none", flexShrink:0 }}>
          <div style={{ width:36, height:36, borderRadius:10, background:"var(--teal)",
            display:"flex", alignItems:"center", justifyContent:"center" }}>
            <span className="material-icons-round" style={{ color:"#fff", fontSize:20 }}>monitor_heart</span>
          </div>
          <div>
            <span className="font-display" style={{ fontSize:16, fontWeight:700, color:"var(--navy)" }}>NurseAI</span>
            <span style={{ fontSize:9, color:"var(--teal)", fontWeight:600, display:"block", marginTop:-2, letterSpacing:1.2 }}>AGENTIC CARE</span>
          </div>
        </a>
        <div style={{ display:"flex", gap:28, flex:1, justifyContent:"center" }} className="desktop-nav">
          <button className="nav-link" onClick={() => document.getElementById("platform")?.scrollIntoView({behavior:"smooth"})}>Platform</button>
          <button className="nav-link" onClick={() => document.getElementById("agents")?.scrollIntoView({behavior:"smooth"})}>Agents</button>
        </div>
        <button className="btn-primary" style={{ padding:"10px 22px", fontSize:13, flexShrink:0 }}
          onClick={() => setShowAuthModal(true)}>
          <span className="material-icons-round" style={{fontSize:16}}>lock_open</span>
          Get Access
        </button>
      </nav>

      <section style={{ background:"linear-gradient(160deg, #F7FBFC 0%, #fff 50%, #F0F9F9 100%)",
        padding:"80px 5% 72px", position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", top:-80, right:-80, width:460, height:460, borderRadius:"50%",
          background:"radial-gradient(circle, rgba(13,127,127,.07) 0%, transparent 70%)", pointerEvents:"none" }}/>
        <div style={{ maxWidth:1100, margin:"0 auto", display:"grid",
          gridTemplateColumns:"1fr 1fr", gap:56, alignItems:"center" }} className="hero-grid">
          <div className="reveal-left">
            <div style={{ display:"flex", gap:8, marginBottom:20, flexWrap:"wrap" }}>
              <span className="tech-badge"><span className="material-icons-round" style={{fontSize:13}}>verified</span>HIPAA Compliant</span>
              <span className="tech-badge"><span className="material-icons-round" style={{fontSize:13}}>psychology</span>Gemini 1.5 Pro</span>
              <span className="tech-badge"><span className="material-icons-round" style={{fontSize:13}}>watch</span>ESP32 Vitals</span>
            </div>
            <h1 className="font-display" style={{ fontSize:"clamp(32px,4vw,52px)", fontWeight:800,
              color:"var(--navy)", lineHeight:1.15, marginBottom:20 }}>
              Agentic AI Nurse —<br/>
              <span style={{ color:"var(--teal)" }}>continuous care</span>,<br/>
              fewer readmissions.
            </h1>
            <p style={{ fontSize:17, color:"var(--slate)", lineHeight:1.7, marginBottom:32, maxWidth:470 }}>
              We turn discharge instructions into personalized recovery plans, monitor patients via SMS/voice/photo and <em>real-time wearable vitals</em>, and escalate only when clinicians must act.
            </p>
            <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
              <button className="btn-primary" onClick={() => setShowAuthModal(true)}>
                <span className="material-icons-round" style={{fontSize:18}}>lock_open</span>
                Get Access
              </button>
              <button className="btn-outline"
                onClick={() => document.getElementById("how-it-works")?.scrollIntoView({behavior:"smooth"})}>
                <span className="material-icons-round" style={{fontSize:18}}>play_circle_outline</span>
                How It Works
              </button>
            </div>
            <div style={{ marginTop:36, display:"flex", gap:28 }}>
              {[["24/7","Monitoring"],["↓30%","Readmissions"],["RAG","Grounded"]].map(([a,b]) => (
                <div key={b} style={{ textAlign:"center" }}>
                  <div className="font-display" style={{ fontSize:22, fontWeight:700, color:"var(--teal)" }}>{a}</div>
                  <div style={{ fontSize:11, color:"var(--slate)", fontWeight:500, marginTop:2 }}>{b}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="reveal-right float-anim" style={{ display:"flex", justifyContent:"center" }}>
            <HeroFlowDiagram />
          </div>
        </div>
      </section>

      <section id="platform" style={{ padding:"72px 5%", background:"var(--bg-soft)" }}>
        <div style={{ maxWidth:1100, margin:"0 auto" }}>
          <div className="reveal" style={{ textAlign:"center", marginBottom:48 }}>
            <span className="section-label">Why We Exist</span>
            <h2 className="font-display" style={{ fontSize:"clamp(26px,3vw,38px)", color:"var(--navy)" }}>
              The gap after the hospital door closes
            </h2>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:32 }} className="two-col">
            <div className="reveal-left" style={{ background:"#FFF5F5", border:"1.5px solid #FFD5D5", borderRadius:20, padding:30 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:22 }}>
                <span className="material-icons-round" style={{ color:"#E53935" }}>error_outline</span>
                <h3 style={{ fontWeight:700, color:"#C62828", fontSize:16 }}>The Problem Today</h3>
              </div>
              {[["medication","Missed medications go undetected for days"],
                ["visibility_off","Zero continuous monitoring post-discharge"],
                ["local_hospital","Preventable readmissions — costly and avoidable"],
                ["support_agent","Nurses manually calling hundreds of patients"]]
              .map(([icon,text]) => (
                <div key={text} style={{ display:"flex", gap:10, marginBottom:14, alignItems:"flex-start" }}>
                  <span className="material-icons-round" style={{ color:"#E57373", fontSize:17, marginTop:2 }}>{icon}</span>
                  <span style={{ fontSize:13.5, color:"#5D4037", lineHeight:1.6 }}>{text}</span>
                </div>
              ))}
            </div>
            <div className="reveal-right" style={{ background:"var(--teal-pale)", border:"1.5px solid var(--border)", borderRadius:20, padding:30 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:22 }}>
                <span className="material-icons-round" style={{ color:"var(--teal)" }}>check_circle_outline</span>
                <h3 style={{ fontWeight:700, color:"var(--teal)", fontSize:16 }}>The NurseAI Solution</h3>
              </div>
              {[["smart_toy","Adaptive care plans from each patient's discharge PDF"],
                ["notifications","Proactive SMS reminders with adherence tracking"],
                ["photo_camera","Multimodal check-ins — photos + voice analyzed by AI"],
                ["watch","ESP32 wearable streams HR & SpO₂ — agent alerts doctor if vitals deviate"]]
              .map(([icon,text]) => (
                <div key={text} style={{ display:"flex", gap:10, marginBottom:14, alignItems:"flex-start" }}>
                  <span className="material-icons-round" style={{ color:"var(--teal)", fontSize:17, marginTop:2 }}>{icon}</span>
                  <span style={{ fontSize:13.5, color:"var(--navy)", lineHeight:1.6 }}>{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" style={{ padding:"80px 5%", background:"var(--bg)" }}>
        <div style={{ maxWidth:1100, margin:"0 auto" }}>
          <div className="reveal" style={{ textAlign:"center", marginBottom:56 }}>
            <span className="section-label">Process</span>
            <h2 className="font-display" style={{ fontSize:"clamp(26px,3vw,38px)", color:"var(--navy)" }}>
              From discharge to 24/7 monitoring
            </h2>
            <p style={{ color:"var(--slate)", marginTop:10, fontSize:15, maxWidth:480, margin:"10px auto 0" }}>
              Four automated steps, zero manual coordination
            </p>
          </div>
          <div className="stagger" style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:20 }}>
            {[
              { n:"01", icon:"upload_file",  title:"Ingest Discharge Summary",
                desc:"Nurse uploads PDF. ChromaDB indexes it into a vector knowledge base for grounded, personalised AI responses." },
              { n:"02", icon:"tune",         title:"Personalise + Build Plan",
                desc:"LangGraph agents generate a custom recovery roadmap: medications, meals, exercises and follow-up schedule." },
              { n:"03", icon:"forum",        title:"Multimodal Check-ins + Vitals",
                desc:"Patient gets daily SMS/voice prompts and wears an ESP32 watch (MAX30102 sensor) for continuous HR & SpO₂ streaming." },
              { n:"04", icon:"crisis_alert", title:"Triage & Escalate",
                desc:"Risk engine scores each interaction and vitals reading. Only critical scores (≥7) appear in the Doctor Dashboard." },
            ].map((s, i) => (
              <div key={i} style={{ background:"var(--bg-card)", borderRadius:20, padding:26,
                border:"1px solid var(--border)", position:"relative" }}>
                {i < 3 && (
                  <div style={{ position:"absolute", right:-10, top:"50%", transform:"translateY(-50%)",
                    zIndex:1, width:20, height:20, background:"#fff", borderRadius:"50%",
                    border:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <span className="material-icons-round" style={{ fontSize:12, color:"var(--teal)" }}>arrow_forward</span>
                  </div>
                )}
                <div style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
                  <div className="step-num">{s.n}</div>
                  <div>
                    <span className="material-icons-round" style={{ fontSize:22, color:"var(--teal)", marginBottom:8, display:"block" }}>{s.icon}</span>
                    <h4 style={{ fontWeight:700, fontSize:14, color:"var(--navy)", marginBottom:7 }}>{s.title}</h4>
                    <p style={{ fontSize:13, color:"var(--slate)", lineHeight:1.6 }}>{s.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="agents" style={{ padding:"80px 5%", background:"var(--bg-soft)" }}>
        <div style={{ maxWidth:1100, margin:"0 auto" }}>
          <div className="reveal" style={{ textAlign:"center", marginBottom:40 }}>
            <span className="section-label">AI Agents</span>
            <h2 className="font-display" style={{ fontSize:"clamp(26px,3vw,38px)", color:"var(--navy)" }}>
              Meet your agentic care team
            </h2>
            <p style={{ color:"var(--slate)", marginTop:10, fontSize:15 }}>
              Specialized agents for every aspect of post-discharge recovery
            </p>
          </div>
          <div style={{ display:"flex", gap:8, justifyContent:"center", flexWrap:"wrap", marginBottom:36 }}>
            {["Clinical","Ops","Analytics"].map((t) => (
              <button key={t} className={`tab-btn ${agentTab === t ? "active" : ""}`} onClick={() => setAgentTab(t)}>{t}</button>
            ))}
          </div>
          <div className="stagger visible" style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:20 }}>
            {agents[agentTab].map((a) => (
              <div key={a.name} className="agent-card" style={{ background:a.color }}>
                <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
                  <div style={{ width:46, height:46, borderRadius:12, background:`${a.ic}22`,
                    display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <span className="material-icons-round" style={{ color:a.ic, fontSize:22 }}>{a.icon}</span>
                  </div>
                  <div>
                    <h4 className="font-display" style={{ fontSize:17, color:"var(--navy)", fontWeight:700 }}>{a.name}</h4>
                    <span style={{ fontSize:12, color:"var(--slate)", fontWeight:500 }}>{a.tag}</span>
                  </div>
                </div>
                {a.bullets.map((b) => (
                  <div key={b} style={{ display:"flex", gap:8, marginBottom:10 }}>
                    <span className="material-icons-round" style={{ color:a.ic, fontSize:15, flexShrink:0, marginTop:2 }}>check_circle</span>
                    <span style={{ fontSize:13, color:"var(--navy)", lineHeight:1.5 }}>{b}</span>
                  </div>
                ))}
                <button className="btn-outline" style={{ marginTop:16, padding:"7px 16px", fontSize:12, borderColor:a.ic, color:a.ic }}
                  onClick={() => setShowAuthModal(true)}>Demo Agent →</button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding:"80px 5%", background:"var(--bg)" }}>
        <div style={{ maxWidth:640, margin:"0 auto" }} className="reveal">
          <PurchaseForm />
        </div>
      </section>

      <footer style={{
        background:"var(--navy)",
        borderTop:"1px solid rgba(255,255,255,.08)",
        padding:"20px 5%",
        display:"flex", justifyContent:"center", alignItems:"center",
        flexWrap:"wrap", gap:8,
      }}>
        <span style={{ fontSize:12, color:"rgba(255,255,255,.5)", textAlign:"center" }}>
          © 2025 NurseAI — Sinhgad Hackathon &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
          Built with Gemini 1.5 Pro · LangGraph · FastAPI · React
        </span>
      </footer>
    </>
  );
}