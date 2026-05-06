import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import { AuthService } from '../../auth/services/auth.service';

export interface AdminDashboardStats {
  totalProyectos: number;
  conveniosVigentes: number;
  desempenoEquipo: number;
  actividadReciente: any[];
  estadisticasTareas: {
    pendientes: number;
    planificacion: number;
    ejecucion: number;
    completadas: number;
    otros: number;
  };
  estadisticasComunicaciones: {
    negociacion: number;
    firmados: number;
    descartados: number;
    otros: number;
  };
}

export interface UserDashboardStats {
  misProyectos: number;
  misConvenios: number;
  desempenoEquipoArea: number;
  desempenoPersonal: number;
  misTareasRecientes: any[];
  misAlertas: any[];
  actividadReciente?: any[];
  // Campos opcionales — el backend los puede incluir para el Director
  estadisticasTareas?: {
    pendientes: number;
    planificacion: number;
    ejecucion: number;
    completadas: number;
    otros: number;
  };
  estadisticasComunicaciones?: {
    negociacion: number;
    firmados: number;
    descartados: number;
    otros: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private apiUrl = 'http://localhost:3005/api/dashboard';
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  private get headers() {
    return { headers: this.authService.getAuthHeaders() };
  }

  getAdminStats(): Observable<AdminDashboardStats | null> {
    return this.http.get<AdminDashboardStats>(`${this.apiUrl}/admin`, this.headers).pipe(
      catchError((err: any) => {
        console.error('Error fetching admin stats:', err);
        return of(null);
      })
    );
  }

  getUserStats(): Observable<UserDashboardStats | null> {
    return this.http.get<UserDashboardStats>(`${this.apiUrl}/user`, this.headers).pipe(
      catchError((err: any) => {
        console.error('Error fetching user stats:', err);
        return of(null);
      })
    );
  }

  /**
   * Devuelve estadísticas del endpoint correcto según el rol:
   * - Admin / Administrador → /admin
   * - Director / Practicante / otros → /user
   */
  getStatsForCurrentUser(): Observable<AdminDashboardStats | UserDashboardStats | null> {
    if (this.authService.isAdmin()) {
      return this.getAdminStats();
    }
    return this.getUserStats();
  }
}
