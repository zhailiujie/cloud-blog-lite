import { defineStore } from "pinia";
import { http } from "@/api/http";

export interface CurrentUser {
  id: string;
  username: string;
  nickname?: string;
  avatar?: string;
  role: "admin" | "editor" | "viewer";
  status: number;
}

interface ApiResponse<T> {
  code: number;
  message: string;
  data: T | null;
}

export const useAuthStore = defineStore("auth", {
  state: () => ({
    user: null as CurrentUser | null,
    loading: false,
  }),
  getters: {
    isLogin: (state) => Boolean(state.user),
  },
  actions: {
    setUser(user: CurrentUser | null) {
      this.user = user;
    },
    async login(username: string, password: string, turnstileToken: string) {
      this.loading = true;
      try {
        const response = await http.post<ApiResponse<CurrentUser>>(
          "/auth/login",
          { username, password, turnstileToken },
        );
        this.user = response.data.data;
        return response.data.data;
      } finally {
        this.loading = false;
      }
    },
    async fetchMe() {
      const response = await http.get<ApiResponse<CurrentUser>>("/auth/me");
      this.user = response.data.data;
      return response.data.data;
    },
    async logout() {
      await http.post("/auth/logout");
      this.user = null;
    },
  },
});
