import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const apiClient = axios.create({
    baseURL: `${API_URL}/api/v1`,
    withCredentials: true,
    headers: { "Content-Type": "application/json" },
});

// Attach access_token from localStorage as Authorization header
apiClient.interceptors.request.use((config) => {
    if (typeof window !== "undefined") {
        const token = localStorage.getItem("access_token");
        if (token) config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Auto-refresh on 401
let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: string) => void; reject: (e: unknown) => void }> = [];

const processQueue = (error: unknown, token: string | null) => {
    failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)));
    failedQueue = [];
};

apiClient.interceptors.response.use(
    (res) => res,
    async (error) => {
        const original = error.config;

        if (error.response?.status === 401 && !original._retry) {
            // ── Guard 1: no refresh token in storage → don't even try ──────
            const refreshToken =
                typeof window !== "undefined"
                    ? localStorage.getItem("refresh_token")
                    : null;

            if (!refreshToken) {
                // Just reject — AuthProvider will set user to null gracefully.
                // Only redirect if the user is on a protected page.
                if (
                    typeof window !== "undefined" &&
                    !window.location.pathname.startsWith("/login") &&
                    !window.location.pathname.startsWith("/signup")
                ) {
                    window.location.href = "/login";
                }
                return Promise.reject(error);
            }

            // ── Guard 2: queue concurrent 401s while refresh is in flight ──
            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                }).then((token) => {
                    original.headers.Authorization = `Bearer ${token}`;
                    return apiClient(original);
                });
            }

            original._retry = true;
            isRefreshing = true;

            try {
                const { data } = await axios.post(
                    `${API_URL}/api/v1/auth/refresh`,
                    { refresh_token: refreshToken },
                    { withCredentials: true }
                );
                localStorage.setItem("access_token", data.access_token);
                localStorage.setItem("refresh_token", data.refresh_token);
                processQueue(null, data.access_token);
                original.headers.Authorization = `Bearer ${data.access_token}`;
                return apiClient(original);
            } catch (err) {
                processQueue(err, null);
                localStorage.removeItem("access_token");
                localStorage.removeItem("refresh_token");
                if (
                    typeof window !== "undefined" &&
                    !window.location.pathname.startsWith("/login") &&
                    !window.location.pathname.startsWith("/signup")
                ) {
                    window.location.href = "/login";
                }
                return Promise.reject(err);
            } finally {
                isRefreshing = false;
            }
        }
        return Promise.reject(error);
    }
);

// ── Auth API ──────────────────────────────────────────────────────────────────
export const authApi = {
    signup: (data: { email: string; full_name: string; password: string }) =>
        apiClient.post("/auth/signup", data),

    login: (data: { email: string; password: string }) =>
        apiClient.post("/auth/login", data).then((r) => {
            localStorage.setItem("access_token", r.data.access_token);
            localStorage.setItem("refresh_token", r.data.refresh_token);
            return r;
        }),

    logout: () =>
        apiClient.post("/auth/logout").then(() => {
            localStorage.removeItem("access_token");
            localStorage.removeItem("refresh_token");
        }),

    me: () => apiClient.get("/auth/me"),
};

// ── Projects API ──────────────────────────────────────────────────────────────
export const projectsApi = {
    list: () => apiClient.get("/projects"),
    get: (id: string) => apiClient.get(`/projects/${id}`),
    create: (data: { name: string; description?: string }) => apiClient.post("/projects", data),
    update: (id: string, data: { name?: string; description?: string }) =>
        apiClient.patch(`/projects/${id}`, data),
    delete: (id: string) => apiClient.delete(`/projects/${id}`),

    addMember: (id: string, data: { email: string; role: string }) =>
        apiClient.post(`/projects/${id}/members`, data),
    updateMember: (projectId: string, userId: string, data: { role: string }) =>
        apiClient.patch(`/projects/${projectId}/members/${userId}`, data),
    removeMember: (projectId: string, userId: string) =>
        apiClient.delete(`/projects/${projectId}/members/${userId}`),
};

// ── Tasks API ─────────────────────────────────────────────────────────────────
export const tasksApi = {
    list: (projectId: string, params?: { status?: string; overdue_only?: boolean }) =>
        apiClient.get(`/projects/${projectId}/tasks`, { params }),
    get: (projectId: string, taskId: string) =>
        apiClient.get(`/projects/${projectId}/tasks/${taskId}`),
    create: (projectId: string, data: object) =>
        apiClient.post(`/projects/${projectId}/tasks`, data),
    update: (projectId: string, taskId: string, data: object) =>
        apiClient.patch(`/projects/${projectId}/tasks/${taskId}`, data),
    delete: (projectId: string, taskId: string) =>
        apiClient.delete(`/projects/${projectId}/tasks/${taskId}`),
};

// ── Dashboard API ─────────────────────────────────────────────────────────────
export const dashboardApi = {
    stats: () => apiClient.get("/dashboard/"),
};
