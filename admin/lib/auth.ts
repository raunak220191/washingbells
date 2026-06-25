// Auth helpers for admin panel

export const getToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("admin_token");
};

export const setToken = (token: string) => {
  localStorage.setItem("admin_token", token);
};

export const clearToken = () => {
  localStorage.removeItem("admin_token");
};

export const isLoggedIn = (): boolean => !!getToken();
