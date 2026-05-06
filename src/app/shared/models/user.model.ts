export interface User {
  id: number;
  email: string;
  nombre: string;
  rol: string; // Director, Usuario, etc.
  area?: string; // Área a la que pertenece el usuario
}

export interface LoginResponse {
  access_token: string;
  usuario: User;
}
