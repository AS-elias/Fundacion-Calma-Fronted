import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { AuthService } from '../../auth/services/auth.service';

type ApiListResponse<T> =
  | T[]
  | {
      data?: T[];
      items?: T[];
      rows?: T[];
      resultados?: T[];
    };

type ApiMutationResponse<T> =
  | T
  | {
      data?: T;
      item?: T;
      actividad?: T;
      empresa?: T;
      proyecto?: T;
      enlace?: T;
      message?: string;
      mensaje?: string;
    };

@Injectable({ providedIn: 'root' })
export class EstrategiaComercialService {
  private readonly apiUrl = 'http://localhost:3005/api';

  constructor(
    private http: HttpClient,
    private authService: AuthService,
  ) {}

  getActividades(): Observable<any[]> {
    return this.getList(`${this.apiUrl}/estrategia-actividades`);
  }

  createActividad(payload: any): Observable<any> {
    return this.create(`${this.apiUrl}/estrategia-actividades`, payload, 'actividad');
  }

  updateActividad(id: string | number, payload: any): Observable<any> {
    return this.update(`${this.apiUrl}/estrategia-actividades/${id}`, payload, 'actividad');
  }

  deleteActividad(id: string | number): Observable<void> {
    return this.delete(`${this.apiUrl}/estrategia-actividades/${id}`);
  }

  getActividadEnlaces(): Observable<any[]> {
    return this.getList(`${this.apiUrl}/estrategia-actividad-enlaces`);
  }

  createActividadEnlace(payload: any): Observable<any> {
    return this.create(`${this.apiUrl}/estrategia-actividad-enlaces`, payload, 'enlace');
  }

  updateActividadEnlace(id: string | number, payload: any): Observable<any> {
    return this.update(`${this.apiUrl}/estrategia-actividad-enlaces/${id}`, payload, 'enlace');
  }

  deleteActividadEnlace(id: string | number): Observable<void> {
    return this.delete(`${this.apiUrl}/estrategia-actividad-enlaces/${id}`);
  }

  getEmpresas(): Observable<any[]> {
    return this.getList(`${this.apiUrl}/estrategia-empresas`);
  }

  createEmpresa(payload: any): Observable<any> {
    return this.create(`${this.apiUrl}/estrategia-empresas`, payload, 'empresa');
  }

  updateEmpresa(id: string | number, payload: any): Observable<any> {
    return this.update(`${this.apiUrl}/estrategia-empresas/${id}`, payload, 'empresa');
  }

  deleteEmpresa(id: string | number): Observable<void> {
    return this.delete(`${this.apiUrl}/estrategia-empresas/${id}`);
  }

  getProyectos(): Observable<any[]> {
    return this.getList(`${this.apiUrl}/estrategia-proyectos`);
  }

  createProyecto(payload: any): Observable<any> {
    return this.create(`${this.apiUrl}/estrategia-proyectos`, payload, 'proyecto');
  }

  updateProyecto(id: string | number, payload: any): Observable<any> {
    return this.update(`${this.apiUrl}/estrategia-proyectos/${id}`, payload, 'proyecto');
  }

  deleteProyecto(id: string | number): Observable<void> {
    return this.delete(`${this.apiUrl}/estrategia-proyectos/${id}`);
  }

  getProyectoEnlaces(): Observable<any[]> {
    return this.getList(`${this.apiUrl}/estrategia-proyecto-enlaces`);
  }

  createProyectoEnlace(payload: any): Observable<any> {
    return this.create(`${this.apiUrl}/estrategia-proyecto-enlaces`, payload, 'enlace');
  }

  updateProyectoEnlace(id: string | number, payload: any): Observable<any> {
    return this.update(`${this.apiUrl}/estrategia-proyecto-enlaces/${id}`, payload, 'enlace');
  }

  deleteProyectoEnlace(id: string | number): Observable<void> {
    return this.delete(`${this.apiUrl}/estrategia-proyecto-enlaces/${id}`);
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
    return response.data ?? response.items ?? response.rows ?? response.resultados ?? [];
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
