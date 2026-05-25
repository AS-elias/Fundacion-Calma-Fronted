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
    progreso?: number;
    planificacion?: number;
    ejecucion: number;
    completadas: number;
    paralizado?: number;
    otros?: number;
  };
  estadisticasComunicaciones: {
    pendiente?: number;
    proceso?: number;
    negociacion?: number;
    firmados: number;
    cancelados?: number;
    descartados?: number;
    otros?: number;
  };
}

export interface DirectorEvaluationTarget {
  id?: number;
  usuarioId?: number;
  nombre?: string;
  nombreCompleto?: string;
  puesto?: string;
  rol?: string;
  rating?: number;
  comentario?: string;
  fecha?: string;
  pendiente?: boolean;
  activo?: boolean;
}

export interface UserDashboardStats {
  misProyectos: number;
  misConvenios: number;
  desempenoEquipo?: number;
  desempenoEquipoArea: number;
  desempenoPersonal?: number;
  misTareasRecientes: any[];
  misAlertas: any[];
  actividadReciente?: any[];
  // Campos opcionales — el backend los puede incluir para el Director
  estadisticasTareas?: {
    pendientes: number;
    progreso?: number;
    planificacion?: number;
    ejecucion: number;
    completadas: number;
    paralizado?: number;
    otros?: number;
  };
  estadisticasComunicaciones?: {
    pendiente?: number;
    proceso?: number;
    negociacion?: number;
    firmados: number;
    cancelados?: number;
    descartados?: number;
    otros?: number;
  };
  directorPendingEvaluations?: DirectorEvaluationTarget[];
  pendientesEvaluacion?: DirectorEvaluationTarget[];
  promedioEvaluacionDirector?: number;
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

  getDirectorPendingUsers(): Observable<any | null> {
    const url = `${this.apiUrl}/director/pending-users`;
    return this.http.get<any>(url, this.headers).pipe(
      catchError((err: any) => {
        console.error('Error fetching director pending users:', err);
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

  /** Registrar una evaluación del director (solo director puede enviar) */
  createDirectorEvaluation(rating: number, comentario?: string, usuarioId?: number) {
    const body: { rating: number; comentario?: string; [key: string]: unknown } = { rating, comentario };
    if (usuarioId !== undefined) {
      body['usuarioId'] = usuarioId;
    }

    return this.http.post(`${this.apiUrl}/director-evaluation`, body, this.headers).pipe(
      catchError((err: any) => {
        console.error('Error creating director evaluation:', err);
        return of(null);
      })
    );
  }

  /** Obtener historial de evaluaciones del director (solo para director) */
  getDirectorEvaluations() {
    return this.http.get<any[]>(`${this.apiUrl}/director-evaluations`, this.headers).pipe(
      catchError((err: any) => {
        console.error('Error fetching director evaluations:', err);
        return of([] as any[]);
      })
    );
  }
}
