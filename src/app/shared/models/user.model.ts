export interface User {
  id: number;
  email: string;
  nombre: string;
  apellido?: string;
  foto_url?: string | null;
  fotoUrl?: string | null;
  rol: string; // Director, Usuario, etc.
  area?: string; // Área a la que pertenece el usuario
}

export interface LoginResponse {
  access_token?: string;
  usuario?: User;
  requirePasswordChange?: boolean;
  mensaje?: string;
}
