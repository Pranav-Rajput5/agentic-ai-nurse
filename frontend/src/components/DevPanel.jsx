/**
 * DevPanel.jsx — Hackathon Demo Control Panel
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';

const API = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000';

const fetch_ = (path, opts = {}) =>
  fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  }).then((r) => r.json());


const Mono = ({ children, className = '' }) => (
  <span className={`font-mono text-xs ${className}`}>{children}</span>
);

const Tag = ({ children, color = 'teal' }) => {
  const map = {
    teal:   'bg-teal-900 text-teal-300 border-teal-700',
    yellow: 'bg-yellow-900 text-yellow-300 border-yellow-700',
    red:    'bg-red-900 text-red-300 border-red-700',
    blue:   'bg-blue-900 text-blue-300 border-blue-700',
    gray:   'bg-gray-800 text-gray-400 border-gray-600',
  };
  return (
    <span className={`px-1.5 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider ${map[color]}`}>
      {children}
    </span>
  );
};

const Btn = ({ onClick, children, color = 'teal', disabled = false, small = false }) => {
  const map = {
    teal:   'bg-teal-700 hover:bg-teal-600 border-teal-500 text-teal-100',
    red:    'bg-red-800 hover:bg-red-700 border-red-600 text-red-100',
    yellow: 'bg-yellow-700 hover:bg-yellow-600 border-yellow-500 text-yellow-100',
    gray:   'bg-gray-700 hover:bg-gray-600 border-gray-500 text-gray-200',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`border rounded font-mono font-bold uppercase tracking-wide transition-all
        ${small ? 'text-[9px] px-2 py-1' : 'text-[10px] px-3 py-1.5'}
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
        ${map[color]}`}
    >
      {children}
    </button>
  );
};

const Input = ({ value, onChange, placeholder, type = 'text' }) => (
  <input
    type={type}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs font-mono text-gray-200
               focus:outline-none focus:border-teal-500 w-full placeholder-gray-600"
  />
);

const NumInput = ({ value, onChange, min = 0, max = 999 }) => (
  <input
    type="number"
    value={value}
    min={min}
    max={max}
    onChange={(e) => onChange(Number(e.target.value))}
    className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs font-mono text-teal-300
               focus:outline-none focus:border-teal-500 w-20 text-right"
  />
);

const Row = ({ label, children }) => (
  <div className="flex items-center justify-between gap-3 py-1.5 border-b border-gray-800">
    <Mono className="text-gray-400">{label}</Mono>
    {children}
  </div>
);

const LogLine = ({ entry }) => {
  const col = entry.type === 'error' ? 'text-red-400' :
              entry.type === 'ok'    ? 'text-teal-400' :
              entry.type === 'warn'  ? 'text-yellow-400' : 'text-gray-400';
  return (
    <div className={`font-mono text-[10px] leading-5 ${col}`}>
      <span className="text-gray-600">[{entry.time}]</span> {entry.msg}
    </div>
  );
};

// ── Main Panel ─────────────────────────────────────────────────────────────────
const DevPanel = () => {
  const [open,      setOpen]      = useState(false);
  const [minimised, setMinimised] = useState(false);
  const [pos,       setPos]       = useState({ x: 24, y: 80 });
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const panelRef = useRef(null);

  // Active tab
  const [tab, setTab] = useState('timing');   

  const [timing,   setTiming]   = useState(null);
  const [patients, setPatients] = useState([]);
  const [localTiming, setLocalTiming] = useState({});

  const [phoneOverrides, setPhoneOverrides] = useState({});

  const [triggerPid,    setTriggerPid]    = useState('');
  const [triggerAction, setTriggerAction] = useState('checkin');
  const [triggerTaskId, setTriggerTaskId] = useState('');
  const [triggerBusy,   setTriggerBusy]   = useState(false);

  const [log, setLog] = useState([]);
  const logRef = useRef(null);

  const addLog = useCallback((msg, type = 'info') => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    setLog((l) => [...l.slice(-80), { time, msg, type }]);
  }, []);

  const onMouseDown = (e) => {
    dragging.current  = true;
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    e.preventDefault();
  };
  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current) return;
      setPos({ x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y });
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [pos]);

  const loadConfig = useCallback(async () => {
    try {
      const data = await fetch_('/dev/config');
      setTiming(data.timing);
      setLocalTiming(data.timing);
      setPatients(data.patients || []);
      if (data.patients?.length && !triggerPid) setTriggerPid(data.patients[0].patient_id);
      const overrides = {};
      (data.patients || []).forEach((p) => {
        overrides[p.patient_id] = {
          phone_override:  p.phone_override  || '',
          family_override: p.family_override || '',
        };
      });
      setPhoneOverrides(overrides);
      addLog('Config loaded from server', 'ok');
    } catch (e) {
      addLog(`Config load failed: ${e.message}`, 'error');
    }
  }, [addLog]); 

  useEffect(() => { if (open) loadConfig(); }, [open, loadConfig]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  const applyTiming = async () => {
    try {
      const res = await fetch_('/dev/config', {
        method: 'POST',
        body: JSON.stringify(localTiming),
      });
      addLog(`Timing updated: ${res.changed?.join(', ') || 'no changes'}`, 'ok');
      loadConfig();
    } catch (e) {
      addLog(`Timing update failed: ${e.message}`, 'error');
    }
  };

  const applyPhones = async (pid) => {
    const ov = phoneOverrides[pid] || {};
    try {
      const res = await fetch_('/dev/config', {
        method: 'POST',
        body: JSON.stringify({
          patient_id:      pid,
          phone_override:  ov.phone_override  || '',
          family_override: ov.family_override || '',
        }),
      });
      addLog(`Phone override saved for ${pid}: ${res.changed?.join(', ')}`, 'ok');
    } catch (e) {
      addLog(`Phone override failed: ${e.message}`, 'error');
    }
  };

  const fireTrigger = async () => {
    setTriggerBusy(true);
    try {
      const body = {
        patient_id: triggerPid,
        trigger:    triggerAction,
        task_id:    triggerAction === 'task_reminder' ? triggerTaskId : undefined,
      };
      const res = await fetch_('/dev/trigger', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      addLog(`✅ ${triggerAction} → ${res.message || res.status}`, 'ok');
    } catch (e) {
      addLog(`Trigger failed: ${e.message}`, 'error');
    } finally {
      setTriggerBusy(false);
    }
  };

  if (!open) {
    return (
      <div
        style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999 }}
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 bg-gray-900 border border-gray-600 hover:border-teal-500 rounded-lg px-3 py-2 cursor-pointer shadow-xl transition-all group"
        title="Open Hackathon Demo Controls"
      >
        <svg className="w-4 h-4 text-teal-400 group-hover:animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <Mono className="text-gray-400 group-hover:text-teal-300">DEMO CONTROLS</Mono>
        <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
      </div>
    );
  }

  const TABS = ['timing', 'phones', 'trigger', 'log'];

  return (
    <div
      ref={panelRef}
      style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 9999, width: 420 }}
      className="bg-gray-950 border border-gray-700 rounded-xl shadow-2xl flex flex-col overflow-hidden select-none"
    >
      
      <div
        onMouseDown={onMouseDown}
        className="flex items-center justify-between px-4 py-2.5 bg-gray-900 border-b border-gray-700 cursor-grab active:cursor-grabbing"
      >
        <div className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <Mono className="text-gray-300 font-bold">AgenticNurse / DEMO CONTROLS</Mono>
          <Tag color="yellow">DEV ONLY</Tag>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setMinimised(!minimised)}
            className="w-5 h-5 rounded bg-yellow-600 hover:bg-yellow-500 flex items-center justify-center text-[10px] text-yellow-100 font-bold">
            {minimised ? '▲' : '▼'}
          </button>
          <button onClick={() => setOpen(false)}
            className="w-5 h-5 rounded bg-red-700 hover:bg-red-600 flex items-center justify-center text-[10px] text-red-100 font-bold">
            ✕
          </button>
        </div>
      </div>

      {!minimised && (
        <>
          <div className="bg-yellow-950 border-b border-yellow-800 px-4 py-1.5 flex items-center gap-2">
            <span className="text-yellow-400 text-[10px]">⚠</span>
            <Mono className="text-yellow-500 text-[10px]">
              This panel modifies runtime scheduler parameters for demo purposes only. Not part of the product.
            </Mono>
          </div>

          <div className="flex border-b border-gray-800 bg-gray-900">
            {TABS.map((t) => (
              <button key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2 text-[10px] font-mono font-bold uppercase tracking-wider transition-all
                  ${tab === t ? 'text-teal-300 border-b-2 border-teal-400 bg-gray-950' : 'text-gray-500 hover:text-gray-300'}`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="p-4 space-y-1 max-h-96 overflow-y-auto">

            {/* TIMING TAB */}
            {tab === 'timing' && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Mono className="text-teal-400 font-bold">Scheduler Timing Parameters</Mono>
                  <Btn onClick={loadConfig} color="gray" small>↻ Refresh</Btn>
                </div>
                <div className="bg-gray-900 rounded-lg px-3 py-1 space-y-0.5 mb-3">
                  <Mono className="text-gray-500 text-[9px] block pb-1">Current values fetched from server</Mono>
                  {timing && Object.entries(timing).map(([k, v]) => (
                    <div key={k} className="flex justify-between text-[10px] py-0.5">
                      <Mono className="text-gray-500">{k}</Mono>
                      <Mono className="text-teal-400">{v}</Mono>
                    </div>
                  ))}
                </div>
                <Mono className="text-gray-500 text-[9px] block mb-2">Override values (applied on save):</Mono>
                {localTiming && [
                  { key: 'checkin_hour',              label: 'checkin_hour',              help: '0–23 (hour to send morning check-in)',     min: 0, max: 23 },
                  { key: 'checkin_minute',             label: 'checkin_minute',             help: '0–59 (minute within that hour)',             min: 0, max: 59 },
                  { key: 'checkin_minute_window',      label: 'checkin_minute_window',      help: 'minutes past hour to still send check-in', min: 1, max: 30 },
                  { key: 'escalation_window_minutes',  label: 'escalation_window_minutes',  help: 'minutes to wait before re-sending',         min: 1, max: 240 },
                  { key: 'max_attempts',               label: 'max_attempts',               help: 'check-ins before escalating to family',     min: 1, max: 10 },
                  { key: 'task_window_minutes',        label: 'task_window_minutes',        help: '±minutes around task time to fire reminder', min: 1, max: 30 },
                  { key: 'poll_interval_seconds',      label: 'poll_interval_seconds',      help: 'scheduler loop interval (seconds)',          min: 5, max: 300 },
                ].map(({ key, label, help, min, max }) => {
                  if (key === 'checkin_hour') {
                    const hh = String(localTiming['checkin_hour'] ?? 8).padStart(2, '0');
                    const mm = String(localTiming['checkin_minute'] ?? 0).padStart(2, '0');
                    return (
                      <div key={key} className="mb-2">
                        <Row label="checkin_time">
                          <input
                            type="time"
                            value={`${hh}:${mm}`}
                            onChange={(e) => {
                              const [h, m] = e.target.value.split(':').map(Number);
                              setLocalTiming((t) => ({ ...t, checkin_hour: h, checkin_minute: m }));
                            }}
                            className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs font-mono text-teal-300 focus:outline-none focus:border-teal-500"
                          />
                        </Row>
                        <Mono className="text-gray-600 text-[9px] pl-2"># time to send morning check-in (HH:MM, 24h)</Mono>
                      </div>
                    );
                  }
                  if (key === 'checkin_minute') return null;
                  return (
                    <div key={key} className="mb-2">
                      <Row label={label}>
                        <NumInput
                          value={localTiming[key] ?? 0}
                          onChange={(v) => setLocalTiming((t) => ({ ...t, [key]: v }))}
                          min={min} max={max}
                        />
                      </Row>
                      <Mono className="text-gray-600 text-[9px] pl-2"># {help}</Mono>
                    </div>
                  );
                })}
                <div className="pt-2">
                  <Btn onClick={applyTiming} color="teal">⚡ Apply Timing Changes</Btn>
                </div>
              </div>
            )}

            {/* PHONES TAB */}
            {tab === 'phones' && (
              <div>
                <Mono className="text-teal-400 font-bold block mb-2">Phone Number Configuration</Mono>
                <div className="bg-blue-950 border border-blue-800 rounded p-2 mb-3">
                  <Mono className="text-blue-300 text-[10px]">
                    📋 PDF-extracted numbers are shown read-only (proof of parsing).
                    Override numbers are used for SMS during this demo session.
                  </Mono>
                </div>
                {patients.length === 0 && (
                  <Mono className="text-gray-500">No patients loaded. Upload a discharge PDF first.</Mono>
                )}
                {patients.map((p) => (
                  <div key={p.patient_id} className="bg-gray-900 rounded-lg p-3 mb-3 border border-gray-800">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-full bg-teal-800 flex items-center justify-center text-teal-200 text-[10px] font-bold">
                        {(p.name || '?').charAt(0)}
                      </div>
                      <div>
                        <Mono className="text-gray-200 font-bold">{p.name}</Mono>
                        <Mono className="text-gray-600 block text-[9px]">{p.patient_id}</Mono>
                      </div>
                    </div>

                    <div className="bg-gray-950 rounded p-2 mb-2 space-y-1">
                      <Mono className="text-gray-600 text-[9px] block">── EXTRACTED FROM PDF (read-only) ──</Mono>
                      <div className="flex justify-between">
                        <Mono className="text-gray-500">patient.phone</Mono>
                        <Mono className="text-green-400">{p.pdf_phone || '(not found)'}</Mono>
                      </div>
                      <div className="flex justify-between">
                        <Mono className="text-gray-500">family.name</Mono>
                        <Mono className="text-green-400">{p.pdf_family_name || '(not found)'}</Mono>
                      </div>
                      <div className="flex justify-between">
                        <Mono className="text-gray-500">family.contact</Mono>
                        <Mono className="text-green-400">{p.pdf_family_contact || '(not found)'}</Mono>
                      </div>
                    </div>

                    {/* Override inputs */}
                    <div className="space-y-2">
                      <Mono className="text-yellow-600 text-[9px] block">── DEMO OVERRIDE (SMS sent here) ──</Mono>
                      <div>
                        <Mono className="text-gray-400 block mb-1">patient SMS override</Mono>
                        <Input
                          value={phoneOverrides[p.patient_id]?.phone_override || ''}
                          onChange={(v) => setPhoneOverrides((o) => ({
                            ...o, [p.patient_id]: { ...o[p.patient_id], phone_override: v }
                          }))}
                          placeholder={p.pdf_phone || '+91 XXXXX XXXXX'}
                        />
                      </div>
                      <div>
                        <Mono className="text-gray-400 block mb-1">family SMS override</Mono>
                        <Input
                          value={phoneOverrides[p.patient_id]?.family_override || ''}
                          onChange={(v) => setPhoneOverrides((o) => ({
                            ...o, [p.patient_id]: { ...o[p.patient_id], family_override: v }
                          }))}
                          placeholder={p.pdf_family_contact || '+91 XXXXX XXXXX'}
                        />
                      </div>
                      <Btn onClick={() => applyPhones(p.patient_id)} color="yellow" small>
                        💾 Save Overrides for {p.name?.split(' ')[0]}
                      </Btn>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === 'trigger' && (
              <div>
                <Mono className="text-teal-400 font-bold block mb-3">Manual Trigger — Fire Events Now</Mono>

                <div className="bg-gray-900 rounded p-2 mb-3">
                  <Mono className="text-gray-400 block mb-1">patient</Mono>
                  <select
                    value={triggerPid}
                    onChange={(e) => setTriggerPid(e.target.value)}
                    className="bg-gray-950 border border-gray-700 rounded px-2 py-1.5 text-xs font-mono text-gray-200 focus:outline-none focus:border-teal-500 w-full"
                  >
                    {patients.map((p) => (
                      <option key={p.patient_id} value={p.patient_id}>{p.name} ({p.patient_id})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2 mb-3">
                  {[
                    { id: 'checkin',       label: '🌅 Send Morning Check-in',      color: 'teal',   desc: 'Fires next check-in attempt immediately' },
                    { id: 'escalate',      label: '🚨 Escalate to Family',          color: 'red',    desc: 'Sends family alert SMS + marks Critical' },
                    { id: 'task_reminder', label: '🔔 Send Task Reminder',          color: 'yellow', desc: 'Send reminder for a specific task (enter task ID below)' },
                    { id: 'reset_checkin', label: '↺ Reset Check-in State',         color: 'gray',   desc: 'Clears today\'s check-in — lets you demo from scratch' },
                  ].map(({ id, label, color, desc }) => (
                    <div
                      key={id}
                      onClick={() => setTriggerAction(id)}
                      className={`border rounded p-2.5 cursor-pointer transition-all ${
                        triggerAction === id
                          ? 'border-teal-500 bg-gray-800'
                          : 'border-gray-800 bg-gray-900 hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full border-2 ${triggerAction === id ? 'bg-teal-400 border-teal-400' : 'border-gray-600'}`} />
                        <Mono className="text-gray-200">{label}</Mono>
                      </div>
                      <Mono className="text-gray-600 text-[9px] block mt-0.5 pl-5">{desc}</Mono>
                    </div>
                  ))}
                </div>

                {triggerAction === 'task_reminder' && (
                  <div className="mb-3">
                    <Mono className="text-gray-400 block mb-1">task_id (from daily_routine)</Mono>
                    <Input
                      value={triggerTaskId}
                      onChange={setTriggerTaskId}
                      placeholder="e.g. task_1, task_3 ..."
                    />
                  </div>
                )}

                <Btn onClick={fireTrigger} disabled={triggerBusy || !triggerPid} color="teal">
                  {triggerBusy ? '⏳ Firing...' : `⚡ FIRE: ${triggerAction}`}
                </Btn>
              </div>
            )}

            {tab === 'log' && (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <Mono className="text-teal-400 font-bold">Activity Log</Mono>
                  <Btn onClick={() => setLog([])} color="gray" small>Clear</Btn>
                </div>
                <div
                  ref={logRef}
                  className="bg-gray-900 rounded p-2 h-72 overflow-y-auto border border-gray-800"
                >
                  {log.length === 0
                    ? <Mono className="text-gray-700">No events yet. Use the other tabs to interact.</Mono>
                    : log.map((e, i) => <LogLine key={i} entry={e} />)
                  }
                </div>
              </div>
            )}
          </div>

          <div className="bg-gray-900 border-t border-gray-800 px-4 py-1.5 flex items-center justify-between">
            <Mono className="text-gray-600 text-[9px]">
              backend: {API}
            </Mono>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
              <Mono className="text-gray-500 text-[9px]">live</Mono>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DevPanel;