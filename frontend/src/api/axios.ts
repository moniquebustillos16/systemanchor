import axios from "axios";
import { getAuthToken, clearAuthToken } from "../lib/auth";
import { queryClient } from "../lib/queryClient";
import { queryPersister } from "../lib/queryPersistence";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api",
  // Dashboard and list endpoints can legitimately take longer while the
  // server computes aggregates. Query hooks keep cached data visible while
  // these requests complete, and callers can still set a shorter timeout.
  timeout: 45_000,
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
      queryClient.clear();
      void queryPersister.removeClient();
      clearAuthToken();

      if (window.location.pathname !== "/") {
        window.location.href = "/";
      }
    }
    return Promise.reject(error);
  }
);

export default api;