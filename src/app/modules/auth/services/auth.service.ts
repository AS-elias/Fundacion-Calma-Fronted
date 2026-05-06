// src/app/services/auth.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, tap, of } from 'rxjs';
import { User, LoginResponse } from '../../../shared/models/user.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://localhost:3005/api/auth';
  private tokenKey = 'calma_token';
  private userKey = 'calma_user';

  private http = inject(HttpClient);

  login(email: string, password: string): Observable<LoginResponse> {
    const body = { email, password };

    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, body).pipe(
      tap(respuesta => {
        if (respuesta.access_token && respuesta.usuario) {
          localStorage.setItem(this.tokenKey, respuesta.access_token);
          localStorage.setItem(this.userKey, JSON.stringify(respuesta.usuario));
          console.log(`✅ Sesión iniciada para: ${respuesta.usuario.nombre} (${respuesta.usuario.rol})`);
        }
      })
    );
  }

  logout(): void {
    console.log('👋 Cerrando sesión...');
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
    console.log('✅ Sesión cerrada');
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  getCurrentUser(): User | null {
    const userJson = localStorage.getItem(this.userKey);
    return userJson ? JSON.parse(userJson) : null;
  }

  getUserRole(): string | null {
    const user = this.getCurrentUser();
    return user?.rol || null;
  }

  // ROLES
  isAdmin(): boolean {
    const rol = this.getUserRole()?.toLowerCase();
    return rol === 'admin' || rol === 'administrador';
  }

  isDirector(): boolean {
    const rol = this.getUserRole()?.toLowerCase();
    return rol === 'director';
  }

  isPracticante(): boolean {
    const rol = this.getUserRole()?.toLowerCase();
    return rol === 'practicante' || rol === 'coordinador';
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  getAuthHeaders(): HttpHeaders {
    return this.buildAuthHeaders(true);
  }

  getAuthHeadersWithoutContentType(): HttpHeaders {
    return this.buildAuthHeaders(false);
  }

  private buildAuthHeaders(includeContentType: boolean): HttpHeaders {
    const token = this.getToken();
    const headers: Record<string, string> = {
      Authorization: token ? `Bearer ${token}` : '',
    };

    if (includeContentType) {
      headers['Content-Type'] = 'application/json';
    }

    return new HttpHeaders(headers);
  }

}
