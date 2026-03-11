import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
  headers: { "Content-Type": "application/json" },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Redirect to login on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export default api;

// ── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    api.post("/auth/login", { email, password }),
    register: (data: {
    admin_email: string;
    admin_password: string;
    admin_name: string;
    company_name: string;
  }) => api.post("/auth/register", data),
};

// ── Documents ─────────────────────────────────────────────────────────────────
export const documentsApi = {
  list: () => api.get("/documents"),
  upload: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.post("/documents/upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  delete: (id: string) => api.delete(`/documents/${id}`),
};

// ── Chat ─────────────────────────────────────────────────────────────────────
export const chatApi = {
  ask: (question: string) => api.post("/chat/ask", { question }),
  history: () => api.get("/chat/history"),
};

// ── Tasks ─────────────────────────────────────────────────────────────────────
export const tasksApi = {
  list: () => api.get("/tasks"),
  complete: (id: string) => api.patch(`/tasks/${id}/complete`),
};

// ── Analytics ─────────────────────────────────────────────────────────────────
export const analyticsApi = {
  overview: () => api.get("/analytics/overview"),
  gaps: () => api.get("/analytics/gaps"),
};

// ── Hires ─────────────────────────────────────────────────────────────────────
export const hiresApi = {
  list: () => api.get("/hires"),
  invite: (data: {
    email: string;
    name: string;
    department: string;
    start_date: string;
  }) => api.post("/hires", data),
};