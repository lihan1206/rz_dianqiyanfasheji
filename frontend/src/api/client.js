import axios from "axios";
import { message } from "antd";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
  timeout: 15000
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const msg = error?.response?.data?.message || "请求失败，请稍后重试";
    message.error(msg);

    if (error?.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      if (window.location.pathname !== "/") {
        window.location.href = "/";
      }
    }

    return Promise.reject(error);
  }
);

export const http = {
  get: async (url, config) => {
    const res = await api.get(url, config);
    return res.data;
  },
  post: async (url, body, config) => {
    const res = await api.post(url, body, config);
    return res.data;
  },
  patch: async (url, body, config) => {
    const res = await api.patch(url, body, config);
    return res.data;
  },
  delete: async (url, config) => {
    const res = await api.delete(url, config);
    return res.data;
  }
};
