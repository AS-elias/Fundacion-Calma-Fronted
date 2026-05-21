import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import { AuthService } from '../../../../../../auth/services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class RegistroService {
  private apiUrl = 'http://localhost:3005/api/auth/register';
  private areasUrl = 'http://localhost:3005/api/comunidad';
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  private getAuthHeaders(): HttpHeaders {
    return this.authService.getAuthHeaders();
  }

  register(userData: any): Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.post<any>(this.apiUrl, userData, { headers });
  }

  getAreas(): Observable<any[]> {
    return this.http
      .get<any[]>(`${this.areasUrl}/areas?todas=true`, { headers: this.getAuthHeaders() })
      .pipe(catchError(() => of([])));
  }

  asignarAreaUsuario(userId: number, areaId: number, subareaId?: number): Observable<any> {
    const permisos = [];
    
    // Si se seleccionó una subárea específica, SOLO le damos permiso a esa.
    // Si no, le damos permiso al área principal completa.
    const areaAsignar = subareaId ? Number(subareaId) : Number(areaId);

    permisos.push({
      area_id: areaAsignar,
      puede_publicar: true,
      puede_editar: true,
      permitir_subareas: true
    });

    return this.http.post<any>(`${this.areasUrl}/usuarios/${userId}/areas`, permisos, { headers: this.getAuthHeaders() });
  }
}
