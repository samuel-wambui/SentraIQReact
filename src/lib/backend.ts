import { apiFetch } from "@/lib/api";

const withQuery = (path: string, params?: Record<string, string | number | undefined>) => {
  if (!params) return path;
  const search = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v) !== "") search.set(k, String(v));
  });
  const s = search.toString();
  return s ? `${path}?${s}` : path;
};

export const NotificationsApi = {
  updateNotification: (notificationId: string | number, body?: unknown) =>
    apiFetch(`/api/users/notifications/${encodeURIComponent(String(notificationId))}`, { method: "PUT", body }),

  markRead: (notificationId: string | number, username?: string) =>
    apiFetch(withQuery(`/api/users/notifications/${encodeURIComponent(String(notificationId))}/read`, { username }), { method: "PUT" }),

  reply: (notificationId: string | number, body?: unknown) =>
    apiFetch(`/api/users/notifications/${encodeURIComponent(String(notificationId))}/reply`, { method: "POST", body }),

  createNotification: (body: unknown) =>
    apiFetch(`/api/users/notifications/createNotification`, { method: "POST", body }),

  getUserNotifications: (username: string) =>
    apiFetch(`/api/users/notifications/user/${encodeURIComponent(username)}`),

  getUnreadCount: (username: string) =>
    apiFetch(`/api/users/notifications/user/${encodeURIComponent(username)}/unread-count`),

  getSent: (username: string) =>
    apiFetch(`/api/users/notifications/sent/${encodeURIComponent(username)}`),

  deleteNotification: (notificationId: string | number, username?: string) =>
    apiFetch(withQuery(`/api/users/notifications/deleteNotification/${encodeURIComponent(String(notificationId))}`, { username }), { method: "DELETE" }),
};

export const RolesApi = {
  updateRole: (roleId: string | number, body?: unknown) =>
    apiFetch(`/api/roles/update/${encodeURIComponent(String(roleId))}`, { method: "PUT", body }),

  removeRole: (body?: unknown) => apiFetch(`/api/roles/removeRole`, { method: "POST", body }),

  createRole: (body?: unknown) => apiFetch(`/api/roles/create`, { method: "POST", body }),

  assignRole: (body?: unknown) => apiFetch(`/api/roles/assignRole`, { method: "POST", body }),

  getAllRoles: () => apiFetch(`/api/roles/getAllRoles`),

  deleteRole: (roleId: string | number) => apiFetch(`/api/roles/delete/${encodeURIComponent(String(roleId))}`, { method: "DELETE" }),
};

export const ShiftsApi = {
  create: (body?: unknown) => apiFetch(`/api/shifts/create`, { method: "POST", body }),
  activeNow: () => apiFetch(`/api/shifts/active-now`),
  activeList: () => apiFetch(`/api/shifts/active-list`),
  activeByTime: (params?: Record<string, string | number>) => apiFetch(withQuery(`/api/shifts/active-by-time`, params)),
  delete: (id: string | number) => apiFetch(`/api/shifts/delete/${encodeURIComponent(String(id))}`, { method: "DELETE" }),
};

export const OAuthClientsApi = {
  register: (body?: unknown) => apiFetch(`/api/oauth2/clients/register`, { method: "POST", body }),
  registeredClients: () => apiFetch(`/api/oauth2/clients/registeredClients`),
  deleteClient: (clientId: string) => apiFetch(`/api/oauth2/clients/${encodeURIComponent(clientId)}`, { method: "DELETE" }),
};

export const AuthApi = {
  refresh: () => apiFetch(`/api/auth/refresh`, { method: "POST" }),
  logout: (username: string) => apiFetch(`/api/auth/logout/${encodeURIComponent(username)}`, { method: "POST" }),
  login: (body?: unknown) => apiFetch(`/api/auth/login`, { method: "POST", body }),
};

const backend = { NotificationsApi, RolesApi, ShiftsApi, OAuthClientsApi, AuthApi };
export default backend;
