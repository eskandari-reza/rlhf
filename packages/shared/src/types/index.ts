export interface User {
  id: string;
  email: string;
  name?: string | null;
  createdAt: string;
}

export interface Session {
  id: string;
  userId: string;
  sessionToken: string;
  expiresAt: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}