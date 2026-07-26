const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

/** Absolute URL for a server-hosted file/route (so /files/… and /api/… work behind VITE_API_URL). */
export const fileUrl = (url) => (url && url.startsWith('/') ? `${BASE}${url}` : url);

const TOKEN_KEY = 'miv.token';
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

async function request(path, { method = 'GET', body, auth = false } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = res.status === 204 ? null : await res.json().catch(() => null);

  if (!res.ok) {
    if (res.status === 401 && auth) setToken(null);
    throw new Error(payload?.message || `Request failed (${res.status})`);
  }
  return payload;
}

async function uploadResource(formData) {
  const token = getToken();
  const res = await fetch(`${BASE}/api/resources/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  const payload = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401) setToken(null);
    throw new Error(payload?.message || `Request failed (${res.status})`);
  }
  return payload;
}

export const api = {
  program: () => request('/program'),
  curriculum: () => request('/curriculum'),
  stats: () => request('/stats'),
  course: (code) => request(`/courses/${encodeURIComponent(code)}`),

  login: (password) => request('/auth/login', { method: 'POST', body: { password } }),
  me: () => request('/auth/me', { auth: true }),

  adminCourses: () => request('/admin/courses', { auth: true }),
  uploadResource: uploadResource,
  createResource: (data) => request('/resources', { method: 'POST', body: data, auth: true }),
  updateResource: (id, data) => request(`/resources/${id}`, { method: 'PUT', body: data, auth: true }),
  deleteResource: (id) => request(`/resources/${id}`, { method: 'DELETE', auth: true }),
  setDrive: (courseId, drive_url) =>
    request(`/courses/${courseId}/drive`, { method: 'PUT', body: { drive_url }, auth: true }),

  semesterLinks: (semester) => request(`/semester-links?semester=${semester}`),
  createSemesterLink: (data) => request('/semester-links', { method: 'POST', body: data, auth: true }),
  deleteSemesterLink: (id) => request(`/semester-links/${id}`, { method: 'DELETE', auth: true }),

  askAssistant: (code, question, lang) => request('/assistant/ask', { method: 'POST', body: { code, question, lang } }),
  assistantStatus: () => request('/assistant/status'),
  setAssistantEnabled: (enabled) => request('/admin/assistant', { method: 'PUT', body: { enabled }, auth: true }),

  adminSemesters: () => request('/admin/semesters', { auth: true }),
  setSemesterVisibility: (number, visible) =>
    request(`/admin/semesters/${number}/visibility`, { method: 'PUT', body: { visible }, auth: true }),

  recentResources: (days = 14, limit = 12) => request(`/resources/recent?days=${days}&limit=${limit}`),

  moduleDownloadUrl: (code) => fileUrl(`/api/courses/${encodeURIComponent(code)}/download`),

  createChapter: (courseId, data) => request(`/courses/${courseId}/chapters`, { method: 'POST', body: data, auth: true }),
  updateChapter: (id, data) => request(`/chapters/${id}`, { method: 'PUT', body: data, auth: true }),
  deleteChapter: (id) => request(`/chapters/${id}`, { method: 'DELETE', auth: true }),

  examDates: (semester) => request(`/exam-dates${semester ? `?semester=${semester}` : ''}`),
  adminExamDates: () => request('/admin/exam-dates', { auth: true }),
  createExamDate: (data) => request('/exam-dates', { method: 'POST', body: data, auth: true }),
  deleteExamDate: (id) => request(`/exam-dates/${id}`, { method: 'DELETE', auth: true }),

  aiQuestions: (limit = 100) => request(`/admin/ai-questions?limit=${limit}`, { auth: true }),
  deleteAiQuestion: (id) => request(`/admin/ai-questions/${id}`, { method: 'DELETE', auth: true }),

  studentRegister: (email, password, name) =>
    request('/student/register', { method: 'POST', body: { email, password, name } }),
  studentLogin: (email, password) => request('/student/login', { method: 'POST', body: { email, password } }),
  studentMe: (token) => studentRequest('/student/me', token),
  saveStudentData: (token, data) => studentRequest('/student/data', token, { method: 'PUT', body: { data } }),
};

const STUDENT_TOKEN_KEY = 'miv.student.token';
export const getStudentToken = () => localStorage.getItem(STUDENT_TOKEN_KEY);
export const setStudentToken = (t) =>
  t ? localStorage.setItem(STUDENT_TOKEN_KEY, t) : localStorage.removeItem(STUDENT_TOKEN_KEY);

async function studentRequest(path, token, { method = 'GET', body } = {}) {
  const headers = { Authorization: `Bearer ${token}` };
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(payload?.message || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return payload;
}
