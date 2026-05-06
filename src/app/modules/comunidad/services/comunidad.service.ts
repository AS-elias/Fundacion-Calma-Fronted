import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from '../../auth/services/auth.service';

export interface PermisoArea {
  puede_publicar: boolean;
  puede_editar: boolean;
  permitir_subareas: boolean;
}

export interface Area {
  id: number;
  nombre: string;
  padre_id: number | null;
  es_externa: boolean;
  permisos: PermisoArea;
  subareas: Area[];
}

export interface AccesoArea {
  tieneAcceso: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ComunidadService {
  private apiUrl = 'http://localhost:3005/api/comunidad';
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${this.authService.getToken()}`,
      'Content-Type': 'application/json'
    });
  }

  getAreas(todasParaAdmin = false): Observable<Area[]> {
    const url = todasParaAdmin
      ? `${this.apiUrl}/areas?todas=true`
      : `${this.apiUrl}/areas`;
    return this.http.get<Area[]>(url, { headers: this.getHeaders() });
  }

  getContactos(): Observable<ContactoBackend[]> {
    return this.http.get<ContactoBackend[]>(`${this.apiUrl}/contactos`, {
      headers: this.getHeaders()
    });
  }

  deleteContacto(id: number): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.apiUrl}/contactos/${id}`, {
      headers: this.getHeaders()
    });
  }

  searchUsuariosByEmail(email: string): Observable<any[]> {
    return this.http.get<any[]>(`http://localhost:3005/api/usuarios/search?email=${email}`, {
      headers: this.getHeaders()
    });
  }

  agregarContactoByEmail(email: string): Observable<Contacto> {
    return this.http.post<Contacto>(`${this.apiUrl}/contactos/add-by-email`, { email }, {
      headers: this.getHeaders()
    });
  }

  verificarAcceso(id: number): Observable<AccesoArea> {
    return this.http.get<AccesoArea>(`${this.apiUrl}/areas/${id}/acceso`, {
      headers: this.getHeaders()
    });
  }

  // ====== NUEVOS MÉTODOS PARA SOLICITUDES DE CONTACTO ======

  // Obtener todos los contactos (el backend filtra según permisos)
  getContactosAccesibles(): Observable<ContactoBackend[]> {
    return this.http.get<ContactoBackend[]>(`${this.apiUrl}/contactos`, {
      headers: this.getHeaders()
    });
  }

  // Buscar usuarios de otras áreas para enviar solicitud
  buscarUsuariosOtraArea(searchTerm: string): Observable<UsuarioOtraArea[]> {
    // Usar endpoint genérico de búsqueda de usuarios
    return this.http.get<UsuarioOtraArea[]>(
      `http://localhost:3005/api/usuarios/search?q=${encodeURIComponent(searchTerm)}`,
      { headers: this.getHeaders() }
    );
  }

}

export interface Contacto {
  id?: number;
  nombre: string;
  rol: string;
  area: string;
  email?: string;
  telefono?: string;
  iniciales?: string;
  esFavorito?: boolean;
  online?: boolean;
  usuarioId?: number;
}

// Interfaz para los datos que trae el backend
export interface ContactoBackend {
  id: number;
  nombreCompleto: string;
  apellidoCompleto: string;
  email: string;
  telefono: string | null;
  areaPrincipal: string;
  puesto: string;
  rolNombre: string;
  iniciales: string;
  estado: string;
  fotoUrl: string | null;
  online: boolean;
  usuarioId: number;
}

// Nueva interfaz para solicitudes de contacto
export interface SolicitudContacto {
  id: number;
  remitente_id: number;
  destinatario_id: number;
  remitente?: {
    nombre: string;
    email: string;
    rol: string;
    area: string;
  };
  destinatario?: {
    nombre: string;
    email: string;
    rol: string;
    area: string;
  };
  estado: 'pendiente' | 'aceptada' | 'rechazada';
  createdAt: string;
  updatedAt: string;
}

// Usuario de otra área para solicitud
export interface UsuarioOtraArea {
  id: number;
  nombre: string;
  email: string;
  rol: string;
  area: string;
  iniciales: string;
  fotoUrl?: string | null;
  online?: boolean;
}
