import axios from "axios";
import { getAuthToken, clearAuthToken } from "../lib/auth";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api",
  // Default timeout for every request. Individual calls can still override
  // this by passing their own `timeout` in the request config if a specific
  // endpoint is known to be slow (e.g. large report generation).
  timeout: 15_000,
});

// Attach token on every request
api.interceptors.request.use((config) => {
  const token = getAuthToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// Auto logout on 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearAuthToken();

      if (window.location.pathname !== "/") {
        window.location.href = "/";
      }
    }
    return Promise.reject(error);
  }
);

export default api;