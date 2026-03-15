/**
 * src/services/api.js
 *
 * Centralized API service for the Agentic AI Nurse frontend.
 *
 * ALL fetch calls go through here.
 * To change the backend URL, edit the single line below (or set REACT_APP_API_URL in .env).
 */

export const API_BASE =
  process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000';

// ─── Generic Helpers ──────────────────────────────────────────────────────────

const handleResponse = async (res) => {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.message || `HTTP ${res.status}`);
  }
  return res.json();
};

const get = (path) =>
  fetch(`${API_BASE}${path}`).then(handleResponse);

const post = (path, body) =>
  fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(handleResponse);

const postForm = (path, formData) =>
  fetch(`${API_BASE}${path}`, { method: 'POST', body: formData }).then(handleResponse);

// ─── Nurse Endpoints ──────────────────────────────────────────────────────────

export const admitPatient = (file) => {
  const fd = new FormData();
  fd.append('file', file);
  return postForm('/nurse/admit-patient', fd);
};

export const getAllPatients = () => get('/nurse/patients');

export const getPatientPipelineStatus = (patientId) =>
  get(`/nurse/patient/${patientId}/status`);

// ─── Patient Endpoints ────────────────────────────────────────────────────────

export const getPatientPersonalization = (patientId) =>
  get(`/patient/${patientId}/personalization`);

export const getChatHistory = (patientId) =>
  get(`/chat_history/${patientId}`);

// ─── Chat Endpoints ───────────────────────────────────────────────────────────

export const sendChatMessage = (patientId, message) =>
  post('/chat', { patient_id: patientId, message });

export const sendVoiceMessage = (patientId, audioBlob) => {
  const fd = new FormData();
  fd.append('file', audioBlob, 'recording.webm');
  fd.append('patient_id', patientId);
  return postForm('/chat/voice', fd);
};

export const sendWoundImage = (patientId, file) => {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('patient_id', patientId);
  return postForm('/chat/upload-image', fd);
};

// ─── Doctor Endpoints ─────────────────────────────────────────────────────────

export const getDoctorAlerts = () => get('/doctor/alerts');

// ─── SMS / Reminder Endpoints ─────────────────────────────────────────────────

export const triggerReminder = (patientId, taskId) =>
  post('/trigger-reminder', { patient_id: patientId, task_id: taskId });

export const submitPatientReply = (patientId, taskId, response) =>
  post('/patient-reply', { patient_id: patientId, task_id: taskId, response });

export const markTaskComplete = (patientId, taskId) =>
  post('/patient/task/complete', { patient_id: patientId, task_id: taskId });