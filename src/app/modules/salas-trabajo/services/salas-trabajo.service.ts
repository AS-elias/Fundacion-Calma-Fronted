import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from '../../auth/services/auth.service';

export interface Sala {
  id?: number;
  nombre: string;
  descripcion: string;
  es_privada: boolean;
  es_general?: boolean;
  area: string;
  link: string;
}

export interface GrupoSalas {
  area: string;
  salas: Sala[];
}

@Injectable({
  providedIn: 'root'
})
export class SalasTrabajoService {
  private apiUrl = 'https://fundacion-calma-backend.onrender.com/api/salas-trabajo';
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  // Este método es la CLAVE: adjunta el token a las peticiones
  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${this.authService.getToken()}`,
      'Content-Type': 'application/json'
    });
  }

  getSalaGeneral(): Observable<Sala> {
    const timestamp = new Date().getTime();
    return this.http.get<Sala>(`${this.apiUrl}/general?t=${timestamp}`, { 
      headers: this.getHeaders() 
    });
  }

  getSalas(): Observable<GrupoSalas[]> {
    const timestamp = new Date().getTime();
    return this.http.get<GrupoSalas[]>(`${this.apiUrl}?t=${timestamp}`, { 
      headers: this.getHeaders() 
    });
  }

  crearSala(sala: any): Observable<Sala> {
    return this.http.post<Sala>(this.apiUrl, sala, { 
      headers: this.getHeaders() 
    });
  }

  eliminarSala(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${id}`, { 
      headers: this.getHeaders() 
    });
  }

  editarSala(id: number, sala: any): Observable<Sala> {
    return this.http.put<Sala>(`${this.apiUrl}/${id}`, sala, {
      headers: this.getHeaders()
    });
  }
}
