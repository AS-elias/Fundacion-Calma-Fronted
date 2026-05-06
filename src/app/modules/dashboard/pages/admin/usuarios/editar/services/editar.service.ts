import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, map, catchError, of } from 'rxjs';
import { AuthService } from '../../../../../../auth/services/auth.service';

export interface AreaPermiso {
  area_id: number;
  puede_publicar?: boolean;
  puede_editar?: boolean;
  permitir_subareas?: boolean;
}

@Injectable({ providedIn: 'root' })
export class EditarService {
  private usersUrl = 'http://localhost:3005/api/auth/users';
  private areasUrl = 'http://localhost:3005/api/comunidad';

  private http = inject(HttpClient);
  private authService = inject(AuthService);

  private headers(): HttpHeaders {
    return this.authService.getAuthHeaders();
  }

  getUsuario(id: number): Observable<any> {
    return this.http
      .get<any[]>(this.usersUrl, { headers: this.headers() })
      .pipe(
        map(usuarios => {
          const encontrado = usuarios.find(u => u.id === id);
          if (!encontrado) throw new Error(`Usuario con ID ${id} no encontrado.`);
          return encontrado;
        })
      );
  }

  getAreas(): Observable<any[]> {
    return this.http
      .get<any[]>(`${this.areasUrl}/areas?todas=true`, { headers: this.headers() })
      .pipe(catchError(() => of([])));
  }

  getAreasDeUsuario(userId: number): Observable<any[]> {
    return this.http
      .get<any[]>(`${this.areasUrl}/areas?usuario_id=${userId}`, { headers: this.headers() })
      .pipe(catchError(() => of([])));
  }

  getPermisosAreaUsuario(userId: number): Observable<AreaPermiso[]> {
    return this.http
      .get<AreaPermiso[]>(`${this.areasUrl}/usuarios/${userId}/areas`, { headers: this.headers() })
      .pipe(catchError(() => of([])));
  }

  actualizarUsuario(id: number, datos: any): Observable<any> {
    const payload = {
      nombre_completo: datos.nombre_completo,
      apellido_completo: datos.apellido_completo ?? '',
      puesto: datos.puesto ?? '',
      rol_id: Number(datos.rol_id),
      estado: datos.estado,
      // Si no hay fecha, mandamos null explícitamente
      fecha_fin_contrato: datos.fecha_fin_contrato ? datos.fecha_fin_contrato : null
    };

    return this.http.patch<any>(`${this.usersUrl}/${id}`, payload, { headers: this.headers() });
  }

  cambiarEstado(id: number, estado: string): Observable<any> {
    return this.http.patch<any>(`${this.usersUrl}/${id}`, { estado }, { headers: this.headers() });
  }

  actualizarPermisosAreaUsuario(userId: number, permisos: AreaPermiso[]): Observable<any> {
    return this.http.post<any>(`${this.areasUrl}/usuarios/${userId}/areas`, permisos, { headers: this.headers() });
  }
}