export const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  (window.location.port === "8080"
    ? `${window.location.protocol}//${window.location.hostname}:3000`
    : window.location.origin);

export const API_URL = `${BACKEND_URL}/api`;
