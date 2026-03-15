import React, { useState, useEffect } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useLocation,
} from 'react-router-dom';
import TriageDashboard from './components/TriageDashboard';
import DoctorDashboard from './components/DoctorDashboard';
import NurseDashboard from './components/NurseDashboard';
import { getAllPatients } from './services/api';
import DevPanel from './components/DevPanel';
import LandingPage from './components/Landingpage';

export const AgenticLogo = ({ className = 'h-9' }) => (
  <div className={`flex items-center gap-2.5 ${className}`}>
    <svg viewBox="0 0 50 50" className="h-full w-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="tealGrad" x1="0" y1="0" x2="50" y2="50" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2BB0A6" /><stop offset="1" stopColor="#187a72" />
        </linearGradient>
      </defs>
      <path d="M18 5H32V18H45V32H32V45H18V32H5V18H18V5Z" fill="#2BB0A6" fillOpacity="0.1" />
      <path d="M25 6V12M25 38V44M21 8V15M29 8V15M21 35V42M29 35V42" stroke="url(#tealGrad)" strokeWidth="2" strokeLinecap="round"/>
      <path d="M6 25H12M38 25H44M8 21H15M8 29H15M35 21H42M35 29H42" stroke="url(#tealGrad)" strokeWidth="2" strokeLinecap="round"/>
      <path d="M25 12L25 38M12 25H38" stroke="#1F2933" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx="25" cy="25" r="4" fill="#1F2933" />
      <circle cx="25" cy="6" r="1.5" fill="#2BB0A6"/>
      <circle cx="25" cy="44" r="1.5" fill="#2BB0A6"/>
      <circle cx="6" cy="25" r="1.5" fill="#2BB0A6"/>
      <circle cx="44" cy="25" r="1.5" fill="#2BB0A6"/>
    </svg>
    <div className="flex flex-col justify-center leading-none">
      <span className="text-lg font-bold tracking-tight text-slate-800">
        Agentic<span className="text-teal-600">Nurse</span>
      </span>
      <span className="text-[8px] uppercase tracking-[0.2em] text-slate-400 font-semibold mt-0.5">
        Clinical AI System
      </span>
    </div>
  </div>
);

const Layout = ({ children, setPatientId }) => {
  const location = useLocation();

  useEffect(() => {
    if (location.state?.patientId) setPatientId(location.state.patientId);
  }, [location.state, setPatientId]);

  if (location.pathname === '/') return <>{children}</>;

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {children}
      <DevPanel />
    </div>
  );
};

function App() {
  const [currentPatientId, setCurrentPatientId] = useState(null);
  const [patientName,      setPatientName]       = useState('');
  const [messages,         setMessages]          = useState([]);
  const [viewMode,         setViewMode]          = useState('home');

  useEffect(() => {
    getAllPatients()
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setCurrentPatientId(data[0].patient_id);
        }
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!currentPatientId) return;
    setMessages([{ sender: 'nurse', text: 'Hello. I am your AI Recovery Nurse. How are you feeling today?' }]);
  }, [currentPatientId]);

  return (
    <Router>
      <Layout setPatientId={setCurrentPatientId}>
        <Routes>

          <Route path="/" element={<LandingPage />} />

          <Route
            path="/patient"
            element={
              currentPatientId ? (
                <TriageDashboard
                  key={currentPatientId}
                  patientId={currentPatientId}
                  setPatientId={setCurrentPatientId}
                  messages={messages}
                  setMessages={setMessages}
                  viewMode={viewMode}
                  setViewMode={setViewMode}
                  onPatientNameLoad={setPatientName}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-screen text-center">
                  <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <p className="text-slate-700 font-semibold">No patients admitted yet</p>
                  <p className="text-slate-400 text-sm mt-1">
                    Upload a discharge PDF in the{' '}
                    <Link to="/nurse" className="text-teal-600 underline">Nurse Station</Link>
                  </p>
                </div>
              )
            }
          />

          <Route path="/nurse"  element={<NurseDashboard />} />
          <Route path="/doctor" element={<DoctorDashboard />} />

        </Routes>
      </Layout>
    </Router>
  );
}

export default App;