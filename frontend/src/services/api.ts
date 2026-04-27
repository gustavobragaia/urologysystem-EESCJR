import axios from 'axios';
import { toast } from 'sonner';
import { supabase } from './supabase';

const API_URL = import.meta.env.VITE_API_URL as string ?? '';

export const api = axios.create({
  baseURL: `${API_URL}/api`,
});

// Anexa token JWT em todas as requisições autenticadas
api.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Tratamento global de erros
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await supabase.auth.signOut();
      window.location.href = '/login';
      return Promise.reject(error);
    }

    if (!error.response) {
      toast.error('Sem conexão com o servidor');
    } else {
      const message = error.response?.data?.message ?? 'Erro inesperado';
      toast.error(message);
    }

    return Promise.reject(error);
  }
);
