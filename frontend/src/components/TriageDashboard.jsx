import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AgenticLogo } from '../App';
import {
  sendChatMessage,
  sendVoiceMessage,
  sendWoundImage,
  triggerReminder,
  submitPatientReply,
  getPatientPersonalization,
  getChatHistory,
  markTaskComplete,
} from '../services/api';

export const IconCameraScan = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

export const IconMic = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
  </svg>
);

const toMsgObjects = (dbArray) =>
  dbArray.map((msg) => ({
    sender: msg.role === 'nurse' || msg.role === 'system' ? 'nurse' : 'patient',
    text: msg.content,
    automated: msg.automated || false,
  }));

const TriageDashboard = ({ patientId, messages, setMessages, viewMode, setViewMode, onPatientNameLoad }) => {

  const [input, setInput]                     = useState('');
  const [loading, setLoading]                 = useState(false);
  const messagesEndRef                        = useRef(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile]       = useState(null);
  const [imagePreview, setImagePreview]       = useState(null);
  const fileInputRef                          = useRef(null);

  const [isSendingSMS, setIsSendingSMS] = useState(false);
  const [isRecording, setIsRecording]   = useState(false);
  const mediaRecorderRef                = useRef(null);
  const audioChunksRef                  = useRef([]);

  const [dailyRoutine, setDailyRoutine] = useState([]);
  const [careTeam, setCareTeam]         = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [patientName, setPatientName]   = useState('');

  const [heartRate, setHeartRate] = useState(0);
  const [oxygen, setOxygen]       = useState(98);

  const lastMsgCountRef = useRef(0);


  const applyHistory = useCallback((dbArray) => {
    if (!Array.isArray(dbArray)) return;
    setMessages(toMsgObjects(dbArray));
    lastMsgCountRef.current = dbArray.length;
  }, [setMessages]);

  const fetchAndApply = useCallback(async (force = false) => {
    try {
      const data = await getChatHistory(patientId);
      if (!data || !Array.isArray(data)) return;
      if (force || data.length !== lastMsgCountRef.current) {
        applyHistory(data);
      }
    } catch (e) {
      console.error('History fetch failed:', e);
    }
  }, [patientId, applyHistory]);



  useEffect(() => {
    if (!patientId) return;
    const ws = new WebSocket(`ws://localhost:8000/ws/vitals/${patientId}`);
    ws.onopen    = () => console.log('🔗 WebSocket Connected');
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setHeartRate(data.bpm > 0 ? data.bpm : 0);
      } catch {}
    };
    ws.onerror = () => {};
    ws.onclose = () => setHeartRate(0);
    return () => ws.close();
  }, [patientId]);

  const fetchPersonalData = useCallback(async () => {
    try {
      const data = await getPatientPersonalization(patientId);
      if (data && !data.error) {
        setDailyRoutine(data.daily_routine || []);
        setCareTeam(data.care_team || []);
        setAppointments(data.appointments || []);
        const resolvedName = data.name || '';
        setPatientName(resolvedName);
        if (onPatientNameLoad) onPatientNameLoad(resolvedName);
      }
    } catch {}
  }, [patientId]);

  useEffect(() => {
    fetchPersonalData();
    const id = setInterval(fetchPersonalData, 5000);
    return () => clearInterval(id);
  }, [fetchPersonalData]);


  useEffect(() => {
    lastMsgCountRef.current = 0;

    const init = async () => {
      setLoading(true);
      try {
        const data = await getChatHistory(patientId);
        if (!data || data.length === 0) {
          setMessages([{ sender: 'nurse', text: 'Hello. I am your AI Recovery Nurse. How are you feeling today?' }]);
          lastMsgCountRef.current = 0;
        } else {
          applyHistory(data);
        }
      } catch {} finally {
        setLoading(false);
      }
    };

    init();

    const id = setInterval(() => fetchAndApply(false), 5000);
    return () => clearInterval(id);

  }, [patientId]); 

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, viewMode]);

  useEffect(() => {
    const id = setInterval(() => setOxygen(Math.floor(Math.random() * 3) + 96), 2000);
    return () => clearInterval(id);
  }, []);


  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = input;
    setInput('');
    setLoading(true);

    setMessages((prev) => [...prev, { sender: 'patient', text: userMsg }]);
    lastMsgCountRef.current += 1;

    const confirmKeywords = /^(yes|done|taken|ok|completed|complete|i did|i have|ya|yep|yeah|sure)\b/i;
    if (confirmKeywords.test(userMsg.trim())) {
      const firstPending = dailyRoutine.find((t) => !t.completed);
      if (firstPending) {
        setDailyRoutine((prev) =>
          prev.map((t) => t.id === firstPending.id ? { ...t, completed: true } : t)
        );
        try { await markTaskComplete(patientId, firstPending.id); } catch {}
      }
    }

    try {
      await sendChatMessage(patientId, userMsg);
      await fetchAndApply(true);
    } catch {
      setMessages((prev) => [...prev, { sender: 'nurse', text: '⚠️ Connection error. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = handleStopRecording;
      mr.start();
      setIsRecording(true);
    } catch {
      alert('Microphone access denied.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
    }
  };

  const handleStopRecording = async () => {
    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    setLoading(true);
    setMessages((prev) => [...prev, { sender: 'patient', text: '🎙️ Processing voice...' }]);
    lastMsgCountRef.current += 1;

    try {
      const data = await sendVoiceMessage(patientId, audioBlob);
      if (data.audio) {
        const audio = new Audio(`data:audio/mp3;base64,${data.audio}`);
        audio.play().catch(() => {});
      }
      await fetchAndApply(true);
    } catch {
      setMessages((prev) => [...prev, { sender: 'nurse', text: '⚠️ Error processing audio.' }]);
    } finally {
      setLoading(false);
    }
  };

  const submitUpload = async () => {
    if (!selectedFile) return;
    setShowUploadModal(false);
    setLoading(true);
    setMessages((prev) => [...prev, { sender: 'patient', text: 'Uploaded Image', image: imagePreview }]);
    lastMsgCountRef.current += 1;

    try {
      await sendWoundImage(patientId, selectedFile);
      await fetchAndApply(true);
    } catch {
      setMessages((prev) => [
        ...prev,
        { sender: 'nurse', text: '⚠️ Image analysis unavailable. Please describe what you see instead.' },
      ]);
    } finally {
      setLoading(false);
      setSelectedFile(null);
      setImagePreview(null);
    }
  };

  const handleFileSelect = (e) => {
    const f = e.target.files?.[0];
    if (f) { setSelectedFile(f); setImagePreview(URL.createObjectURL(f)); }
  };

  const handleTaskComplete = async (taskId) => {
    setDailyRoutine((prev) => prev.map((t) => t.id === taskId ? { ...t, completed: true } : t));
    try {
      await markTaskComplete(patientId, taskId);
    } catch {
      setDailyRoutine((prev) => prev.map((t) => t.id === taskId ? { ...t, completed: false } : t));
    }
  };

  const handleDemoTrigger = async () => {
    setIsSendingSMS(true);
    try {
      await triggerReminder(patientId, 'task_3');
      const firstName = patientName ? patientName.split(' ')[0] : 'there';
      setMessages((prev) => [...prev, {
        sender: 'nurse',
        text: `🔴 ALERT: Hi ${firstName}, I just sent a reminder for your Amoxicillin (500mg) due at 09:00 AM. Have you taken it yet?`,
      }]);
      alert('📲 SMS Sent to Patient!');
    } catch {
      alert('Error sending SMS');
    } finally {
      setIsSendingSMS(false);
    }
  };

  const handleDemoReply = async () => {
    try { await submitPatientReply(patientId, 'task_3', 'YES'); } catch { alert('Error simulating reply'); }
  };



  const CalendarWidget = () => {
    const now = new Date();
    const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    const normalizeMonth = (m) => {
      if (!m) return 'Jan';
      const s = String(m).trim();
      const idx = MONTH_NAMES.findIndex(mn => mn.toLowerCase() === s.slice(0, 3).toLowerCase());
      return idx >= 0 ? MONTH_NAMES[idx] : s.slice(0, 3);
    };

    const allNormalized = [...appointments].map(a => {
      const month = normalizeMonth(a.month);
      return { ...a, month, _date: new Date(a.year, MONTH_NAMES.indexOf(month), a.day) };
    });

    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const upcoming = allNormalized.filter(a => a._date >= today).sort((a, b) => a._date - b._date);
    const past     = allNormalized.filter(a => a._date < today).sort((a, b) => b._date - a._date);
    const nextAppt = upcoming[0] || past[0] || null;

    const displayMonth   = nextAppt ? nextAppt.month : MONTH_NAMES[now.getMonth()];
    const displayYear    = nextAppt ? nextAppt.year  : now.getFullYear();
    const monthIndex     = MONTH_NAMES.indexOf(displayMonth);
    const daysInMonth    = new Date(displayYear, monthIndex + 1, 0).getDate();
    const firstDayOffset = new Date(displayYear, monthIndex, 1).getDay();
    const highlightedDays = new Set(nextAppt ? [nextAppt.day] : []);
    const blanks = Array(firstDayOffset).fill(null);
    const dates  = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    return (
      <div className="bg-white rounded-xl shadow-sm border p-6 border-slate-200">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-red-500 font-bold tracking-widest text-sm uppercase">{displayMonth}</h3>
          <span className="text-xs text-slate-400 font-mono">{displayYear}</span>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center mb-2">
          {['S','M','T','W','T','F','S'].map((d, i) => (
            <div key={i} className="text-xs font-bold text-slate-400">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1 place-items-center">
          {[...blanks, ...dates].map((date, i) => {
            const isHighlighted = date && highlightedDays.has(date);
            const appt = isHighlighted
              ? appointments.find(a => a.month === displayMonth && a.year === displayYear && a.day === date)
              : null;
            return (
              <div key={i} title={appt?.note || ''}
                className={`h-8 w-8 flex items-center justify-center text-sm rounded-full transition-colors
                  ${isHighlighted ? 'bg-red-500 text-white font-bold shadow-md cursor-pointer'
                  : date ? 'text-slate-700 hover:bg-slate-100' : ''}`}>
                {date}
              </div>
            );
          })}
        </div>
        <div className="mt-4 pt-4 border-t border-slate-100">
          <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Upcoming Appointments</p>
        </div>
      </div>
    );
  };

  const VitalsWidget = () => (
    <div className="bg-white rounded-xl shadow-sm border p-5 border-slate-200">
      <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full animate-pulse ${heartRate > 0 ? 'bg-green-500' : 'bg-red-500'}`} />
        {heartRate > 0 ? 'Live Telemetry' : 'Watch Disconnected'}
      </h3>
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <span className="text-slate-400 text-[10px] uppercase font-bold">Heart Rate</span>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-light text-slate-800">{heartRate > 0 ? heartRate : '--'}</span>
            <span className="text-xs text-slate-400">bpm</span>
          </div>
          <div className="w-full h-1 bg-slate-100 mt-2 rounded-full overflow-hidden">
            <div className="h-full bg-red-400 transition-all duration-300" style={{ width: `${(heartRate / 150) * 100}%` }} />
          </div>
        </div>
        <div className="w-px h-12 bg-slate-100" />
        <div className="flex-1">
          <span className="text-slate-400 text-[10px] uppercase font-bold">SpO₂</span>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-light text-slate-800">{oxygen}</span>
            <span className="text-xs text-slate-400">%</span>
          </div>
          <div className="w-full h-1 bg-slate-100 mt-2 rounded-full overflow-hidden">
            <div className="h-full bg-blue-400 transition-all duration-1000" style={{ width: `${oxygen}%` }} />
          </div>
        </div>
      </div>
    </div>
  );

  const CareTeamWidget = () => (
    <div className="bg-white rounded-xl shadow-sm border p-5 border-slate-200">
      <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-4">Assigned Care Team</h3>
      <div className="space-y-4">
        {careTeam.length > 0 ? (
          careTeam.map((doc, idx) => (
            <div key={idx} className="flex items-center gap-3">
              <img
                src={doc.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(doc.name)}&background=e0f2fe&color=0369a1`}
                alt={doc.name} className="w-10 h-10 rounded-full object-cover border border-slate-200"
              />
              <div>
                <p className="text-sm font-semibold text-slate-800">{doc.name}</p>
                <p className="text-xs text-slate-400">{doc.role}</p>
              </div>
            </div>
          ))
        ) : (
          <p className="text-xs text-slate-400">Loading team...</p>
        )}
      </div>
    </div>
  );

  const handleLogout = () => {
    sessionStorage.removeItem('authToken');
    sessionStorage.removeItem('authRole');
    sessionStorage.removeItem('authPatientId');
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen font-sans bg-slate-50 text-slate-900 pb-20">

      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-screen-2xl mx-auto px-5 h-16 flex items-center justify-between gap-4">

          <div className="flex items-center gap-4 shrink-0">
            <AgenticLogo className="h-9" />
            <span className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-teal-50 text-teal-700 border-teal-200">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
              Patient
            </span>
          </div>

          <div className="flex items-center bg-slate-100 rounded-lg p-1 gap-0.5">
            <button
              onClick={() => setViewMode('home')}
              className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${
                viewMode === 'home'
                  ? 'bg-white text-teal-700 shadow-sm'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              MY DASHBOARD
            </button>
            <button
              onClick={() => setViewMode('chat')}
              className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
                viewMode === 'chat'
                  ? 'bg-white text-teal-700 shadow-sm'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              NURSE CHAT
            </button>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {patientName ? (
              <div className="flex items-center gap-2.5">
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-bold text-slate-700 leading-tight">{patientName}</p>
                  <p className="text-[10px] text-slate-400 font-mono leading-tight">ID: {patientId}</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-teal-100 border-2 border-teal-200 flex items-center justify-center text-teal-700 font-bold text-xs">
                  {patientName.charAt(0).toUpperCase()}
                </div>
              </div>
            ) : (
              <div className="hidden sm:block space-y-1">
                <div className="h-3 w-20 bg-slate-200 rounded animate-pulse" />
                <div className="h-2 w-14 bg-slate-100 rounded animate-pulse" />
              </div>
            )}
            <button
              onClick={handleLogout}
              title="Sign out"
              className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-lg border border-slate-200 hover:border-red-200 transition-all"
            >
              Logout
            </button>
          </div>

        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 md:p-8">

        {viewMode === 'home' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 flex flex-col gap-6">

              <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
                <h2 className="text-2xl font-light text-slate-800 mb-2">
                  {patientName ? (
                    <>Good Morning, <span className="font-bold text-teal-600">{patientName.split(' ')[0]}</span>.</>
                  ) : (
                    <div className="h-8 w-56 bg-slate-100 rounded animate-pulse" />
                  )}
                </h2>
                <p className="text-slate-500 text-sm">
                  You have completed{' '}
                  <strong className="text-slate-800">{dailyRoutine.filter((t) => t.completed).length}</strong>{' '}
                  of {dailyRoutine.length} tasks today.
                </p>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex-1">
                <h3 className="text-sm font-bold text-slate-800 mb-6 uppercase tracking-wider">Today's Roadmap</h3>
                <div className="relative ml-3 space-y-0 pb-4">
                  {dailyRoutine.length > 0 ? (
                    dailyRoutine.map((item, idx) => {
                      const isLast = idx === dailyRoutine.length - 1;
                      return (
                        <div key={idx} className="relative pl-8 pb-8">
                          {!isLast && (
                            <div className={`absolute left-[7px] top-5 w-0.5 h-full transition-colors duration-500
                              ${item.completed ? 'bg-teal-400' : 'bg-slate-200'}`} />
                          )}
                          <div className={`absolute -left-[1px] top-1 w-4 h-4 rounded-full border-2 z-10 flex items-center justify-center
                            transition-all duration-500
                            ${item.completed ? 'bg-teal-500 border-teal-500 scale-110 shadow-lg shadow-teal-200' : 'bg-white border-slate-300'}`}>
                            {item.completed && (
                              <svg className="w-3 h-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                          <div
                            onClick={() => !item.completed && handleTaskComplete(item.id)}
                            className={`flex justify-between items-center p-3 -m-3 rounded-lg transition-all duration-200
                              ${item.completed ? 'opacity-60' : 'hover:bg-teal-50 cursor-pointer active:scale-95'}`}
                          >
                            <div>
                              <p className={`text-sm font-medium transition-all duration-300
                                ${item.completed ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                                {item.title}
                              </p>
                              <p className="text-xs text-slate-400">{item.time}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider
                                ${item.type === 'med'      ? 'bg-blue-50 text-blue-600'
                                : item.type === 'meal'     ? 'bg-orange-50 text-orange-500'
                                : item.type === 'exercise' ? 'bg-green-50 text-green-600'
                                : 'bg-slate-100 text-slate-500'}`}>
                                {item.type}
                              </span>
                              {!item.completed && (
                                <span className="text-[9px] text-slate-300 font-mono hidden sm:inline">TAP ✓</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-slate-400 text-sm pl-8">Loading schedule...</p>
                  )}
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 flex flex-col gap-6">
              <VitalsWidget />
              <CalendarWidget />
              <CareTeamWidget />
            </div>
          </div>
        )}

        {viewMode === 'chat' && (
          <div className="h-[calc(100vh-140px)] flex flex-col lg:flex-row gap-6">
            <div className="flex-1 flex flex-col bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden">
              <div className="p-4 bg-slate-50 border-b flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Live Connection: Nurse Agent</p>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {messages.map((msg, index) => (
                  <div key={index} className={`flex ${msg.sender === 'patient' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed shadow-sm ${
                      msg.sender === 'patient'
                        ? 'bg-teal-600 text-white rounded-br-none'
                        : msg.automated
                          ? 'bg-amber-50 border border-amber-200 text-amber-900 rounded-bl-none'
                          : 'bg-white border text-slate-700 rounded-bl-none'
                    }`}>
                      {msg.automated && (
                        <div className="flex items-center gap-1 mb-1.5">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-amber-600">⏰ Automated</span>
                        </div>
                      )}
                      {msg.image && <img src={msg.image} className="w-full h-auto rounded-lg mb-3 object-cover" alt="upload" />}
                      {msg.text}
                    </div>
                  </div>
                ))}
                {loading && <div className="text-xs text-slate-400 italic ml-4">Nurse is typing...</div>}
                <div ref={messagesEndRef} />
              </div>

              <div className="p-4 bg-white border-t flex gap-3 items-center">
                <button onClick={() => setShowUploadModal(true)} className="p-3 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-xl transition-all">
                  <IconCameraScan className="w-6 h-6" />
                </button>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder={isRecording ? 'Listening...' : 'Type a message...'}
                  disabled={isRecording}
                  className={`flex-1 ${isRecording ? 'bg-red-50 border-red-200 text-red-600' : 'bg-slate-100 border-none'} focus:ring-2 focus:ring-teal-500 rounded-xl px-4 py-3 text-sm transition-all outline-none`}
                />
                {input.trim() === '' ? (
                  <button
                    onMouseDown={startRecording}
                    onMouseUp={stopRecording}
                    className={`p-3 rounded-xl text-white shadow-md transition-all ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-teal-600 hover:bg-teal-700'}`}
                  >
                    <IconMic className="w-6 h-6" />
                  </button>
                ) : (
                  <button onClick={handleSend} className="bg-teal-600 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-teal-700 shadow-md">
                    SEND
                  </button>
                )}
              </div>
            </div>

            <div className="hidden lg:flex w-80 flex-col gap-4">
              <VitalsWidget />
              <div className="bg-teal-50 border border-teal-100 rounded-xl p-5">
                <p className="text-xs text-teal-800 font-bold uppercase mb-2">💡 Quick Tip</p>
                <p className="text-xs text-teal-700 leading-relaxed">
                  If you are feeling dizzy, sit down immediately and type "I feel dizzy".
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {showUploadModal && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-lg mb-4 text-slate-800">Upload Wound Photo</h3>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 h-40 flex items-center justify-center rounded-xl cursor-pointer hover:bg-slate-50 transition-colors"
            >
              {imagePreview ? (
                <img src={imagePreview} className="h-full object-contain" alt="preview" />
              ) : (
                <div className="text-center">
                  <IconCameraScan className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <span className="text-slate-400 text-sm">Tap to select photo</span>
                </div>
              )}
            </div>
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" className="hidden" />
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowUploadModal(false); setSelectedFile(null); setImagePreview(null); }}
                className="flex-1 py-3 text-slate-500 font-bold text-sm rounded-xl hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={submitUpload}
                disabled={!selectedFile}
                className="flex-1 py-3 bg-teal-600 text-white rounded-xl font-bold text-sm shadow-lg hover:bg-teal-700 disabled:opacity-50"
              >
                Upload
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TriageDashboard;