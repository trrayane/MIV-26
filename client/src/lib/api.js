const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

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

  adminSemesters: () => request('/admin/semesters', { auth: true }),
  setSemesterVisibility: (number, visible) =>
    request(`/admin/semesters/${number}/visibility`, { method: 'PUT', body: { visible }, auth: true }),
};
