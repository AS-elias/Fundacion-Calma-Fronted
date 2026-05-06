import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { AuthService } from '../../auth/services/auth.service';

type ApiListResponse<T> =
  | T[]
  | {
      data?: T[];
      items?: T[];
      resultados?: T[];
      rows?: T[];
    };

type ApiMutationResponse<T> =
  | T
  | {
      data?: T;
      item?: T;
      colegio?: T;
      empresa?: T;
      venue?: T;
      difusion?: T;
      tarea?: T;
      message?: string;
      mensaje?: string;
    };

@Injectable({ providedIn: 'root' })
export class AnalisisDatosService {
  private readonly apiUrl = 'http://localhost:3005/api';

  constructor(
    private http: HttpClient,
    private authService: AuthService,
  ) {}

  getColegios(): Observable<any[]> {
    return this.getList(`${this.apiUrl}/analisis-colegios`);
  }

  createColegio(payload: any): Observable<any> {
    return this.create(`${this.apiUrl}/analisis-colegios`, payload, 'colegio');
  }

  updateColegio(id: string | number, payload: any): Observable<any> {
    return this.update(`${this.apiUrl}/analisis-colegios/${id}`, payload, 'colegio');
  }

  deleteColegio(id: string | number): Observable<void> {
    return this.delete(`${this.apiUrl}/analisis-colegios/${id}`);
  }

  getEmpresas(): Observable<any[]> {
    return this.getList(`${this.apiUrl}/analisis-empresas`);
  }

  createEmpresa(payload: any): Observable<any> {
    return this.create(`${this.apiUrl}/analisis-empresas`, payload, 'empresa');
  }

  updateEmpresa(id: string | number, payload: any): Observable<any> {
    return this.update(`${this.apiUrl}/analisis-empresas/${id}`, payload, 'empresa');
  }

  deleteEmpresa(id: string | number): Observable<void> {
    return this.delete(`${this.apiUrl}/analisis-empresas/${id}`);
  }

  getVenues(): Observable<any[]> {
    return this.getList(`${this.apiUrl}/analisis-venues`);
  }

  createVenue(payload: any): Observable<any> {
    return this.create(`${this.apiUrl}/analisis-venues`, payload, 'venue');
  }

  updateVenue(id: string | number, payload: any): Observable<any> {
    return this.update(`${this.apiUrl}/analisis-venues/${id}`, payload, 'venue');
  }

  deleteVenue(id: string | number): Observable<void> {
    return this.delete(`${this.apiUrl}/analisis-venues/${id}`);
  }

  getDifusiones(): Observable<any[]> {
    return this.getList(`${this.apiUrl}/analisis-difusiones`);
  }

  createDifusion(payload: any): Observable<any> {
    return this.create(`${this.apiUrl}/analisis-difusiones`, payload, 'difusion');
  }

  updateDifusion(id: string | number, payload: any): Observable<any> {
    return this.update(`${this.apiUrl}/analisis-difusiones/${id}`, payload, 'difusion');
  }

  deleteDifusion(id: string | number): Observable<void> {
    return this.delete(`${this.apiUrl}/analisis-difusiones/${id}`);
  }

  getTareas(): Observable<any[]> {
    return this.getList(`${this.apiUrl}/analisis-tareas`);
  }

  createTarea(payload: any): Observable<any> {
    return this.create(`${this.apiUrl}/analisis-tareas`, payload, 'tarea');
  }

  updateTarea(id: string | number, payload: any): Observable<any> {
    return this.update(`${this.apiUrl}/analisis-tareas/${id}`, payload, 'tarea');
  }

  deleteTarea(id: string | number): Observable<void> {
    return this.delete(`${this.apiUrl}/analisis-tareas/${id}`);
  }

  getTareaEnlaces(tareaId?: string | number): Observable<any[]> {
    let params = new HttpParams();
    if (tareaId) params = params.set('tareaId', String(tareaId));
    return this.http
      .get<ApiListResponse<any>>(`${this.apiUrl}/analisis-tarea-enlaces`, {
        params,
        headers: this.authService.getAuthHeaders(),
      })
      .pipe(
        map((response) => this.normalizarListado(response)),
        catchError(() => of([])),
      );
  }

  createTareaEnlace(payload: any): Observable<any> {
    return this.create(`${this.apiUrl}/analisis-tarea-enlaces`, payload, 'enlace');
  }

  private getList(url: string): Observable<any[]> {
    return this.http
      .get<ApiListResponse<any>>(url, { headers: this.authService.getAuthHeaders() })
      .pipe(
        map((response) => this.normalizarListado(response)),
        catchError(() => of([])),
      );
  }

  private create(url: string, payload: any, key: string): Observable<any> {
    return this.http
      .post<ApiMutationResponse<any>>(url, payload, { headers: this.authService.getAuthHeaders() })
      .pipe(
        map((response) => this.normalizarMutacion(response, key)),
        catchError((error) => throwError(() => error)),
      );
  }

  private update(url: string, payload: any, key: string): Observable<any> {
    return this.http
      .put<ApiMutationResponse<any>>(url, payload, { headers: this.authService.getAuthHeaders() })
      .pipe(
        map((response) => this.normalizarMutacion(response, key)),
        catchError((error) => throwError(() => error)),
      );
  }

  private delete(url: string): Observable<void> {
    return this.http
      .delete<void>(url, { headers: this.authService.getAuthHeaders() })
      .pipe(catchError((error) => throwError(() => error)));
  }

  private normalizarListado(response: ApiListResponse<any>): any[] {
    if (Array.isArray(response)) return response;
    return response.data ?? response.items ?? response.resultados ?? response.rows ?? [];
  }

  private normalizarMutacion(response: ApiMutationResponse<any>, key: string): any {
    if (!response || Array.isArray(response)) return response;
    return (
      (response as Record<string, any>)[key] ??
      (response as Record<string, any>)['data'] ??
      (response as Record<string, any>)['item'] ??
      response
    );
  }
}
