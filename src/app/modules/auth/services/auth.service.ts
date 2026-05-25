// src/app/services/auth.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, tap, of } from 'rxjs';
import { User, LoginResponse } from '../../../shared/models/user.model';
import { SecureStorageService } from '../../../core/services/secure-storage.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'https://fundacion-calma-backend.onrender.com/api/auth';
  private tokenKey = 'calma_token';
  private userKey = 'calma_user';

  private http = inject(HttpClient);
  private secureStorage = inject(SecureStorageService);

  login(email: string, password: string): Observable<LoginResponse> {
    const body = { email, password };

    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, body).pipe(
      tap(respuesta => {
        if (respuesta.access_token && respuesta.usuario) {
          this.secureStorage.setItem(this.tokenKey, respuesta.access_token);
          this.secureStorage.setItem(this.userKey, JSON.stringify(respuesta.usuario));
          console.log(`✅ Sesión iniciada para: ${respuesta.usuario.nombre} (${respuesta.usuario.rol})`);
        }
      })
    );
  }

  changePassword(email: string, tempPassword: string, newPassword: string): Observable<LoginResponse> {
    const body = { email, tempPassword, newPassword };
    return this.http.post<LoginResponse>(`${this.apiUrl}/change-password`, body).pipe(
      tap(respuesta => {
        if (respuesta.access_token && respuesta.usuario) {
          this.secureStorage.setItem(this.tokenKey, respuesta.access_token);
          this.secureStorage.setItem(this.userKey, JSON.stringify(respuesta.usuario));
          console.log(`✅ Contraseña cambiada y sesión iniciada para: ${respuesta.usuario.nombre}`);
        }
      })
    );
  }

  forgotPassword(email: string): Observable<{ mensaje: string }> {
    const body = { email };
    return this.http.post<{ mensaje: string }>(`${this.apiUrl}/forgot-password`, body);
  }

  resetPassword(token: string, newPassword: string): Observable<{ mensaje: string }> {
    const body = { token, newPassword };
    return this.http.post<{ mensaje: string }>(`${this.apiUrl}/reset-password`, body);
  }

  logout(): void {
    console.log('👋 Cerrando sesión...');
    this.secureStorage.removeItem(this.tokenKey);
    this.secureStorage.removeItem(this.userKey);
    console.log('✅ Sesión cerrada');
  }

  getToken(): string | null {
    return this.secureStorage.getItem(this.tokenKey);
  }

  getCurrentUser(): User | null {
    const userJson = this.secureStorage.getItem(this.userKey);
    return userJson ? JSON.parse(userJson) : null;
  }

  updateCurrentUser(user: Partial<User>): void {
    const current = this.getCurrentUser();
    this.secureStorage.setItem(this.userKey, JSON.stringify({ ...current, ...user }));
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
