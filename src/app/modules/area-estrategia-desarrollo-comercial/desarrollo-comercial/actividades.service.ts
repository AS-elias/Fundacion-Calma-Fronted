import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { AuthService } from '../../auth/services/auth.service';

export enum EstadoActividad {
  PENDIENTE = 'PENDIENTE',
  EN_PROCESO = 'EN PROCESO',
  PARALIZADO = 'PARALIZADO',
  COMPLETADO = 'COMPLETADO',
}

export interface ActividadEnlaceDto {
  id?: number;
  nombreDocumento?: string;
  nombre?: string;
  url?: string;
}

export interface ActividadDto {
  id?: string | number;
  areaId?: number;
  creadorId?: number | null;
  titulo?: string;
  descripcion?: string | null;
  estado?: EstadoActividad | string;
  fechaLimite?: string | Date | null;
  fechaCreacion?: string;
  createdAt?: string;
  enlaces?: ActividadEnlaceDto[];
}

export interface ActividadMutationResult {
  actividad: ActividadDto;
  message?: string;
  mensaje?: string;
}

type ActividadApiResponse = ActividadDto & {
  actividad?: ActividadDto;
  data?: ActividadDto;
  message?: string;
  mensaje?: string;
};

type ActividadesListApiResponse =
  | ActividadDto[]
  | {
      data?: ActividadDto[];
      actividades?: ActividadDto[];
      items?: ActividadDto[];
    };

@Injectable({ providedIn: 'root' })
export class ActividadesService {
  private readonly apiUrl = 'http://localhost:3005/api/actividades';

  constructor(
    private http: HttpClient,
    private authService: AuthService,
  ) {}

  getActividades(search?: string, estado?: EstadoActividad | string): Observable<ActividadDto[]> {
    let params = new HttpParams();
    if (search?.trim()) params = params.set('search', search.trim());
    if (estado?.trim()) params = params.set('estado', estado.trim());

    return this.http
      .get<ActividadesListApiResponse>(this.apiUrl, {
        params,
        headers: this.authService.getAuthHeaders(),
      })
      .pipe(
        map((response) => this.normalizarRespuestaListado(response)),
        catchError(() => of([])),
      );
  }

  createActividad(payload: ActividadDto): Observable<ActividadMutationResult> {
    const normalizedPayload = this.normalizarPayload(payload);
    return this.http
      .post<ActividadApiResponse>(this.apiUrl, normalizedPayload, {
        headers: this.authService.getAuthHeaders(),
      })
      .pipe(
        map((response) => this.normalizarRespuestaMutacion(response)),
        catchError((error) => {
          console.error('Error al crear actividad', error);
          return throwError(() => error);
        }),
      );
  }

  updateActividad(id: string, payload: ActividadDto): Observable<ActividadMutationResult> {
    if (!id) return throwError(() => new Error('Actividad sin id'));
    const normalizedPayload = this.normalizarPayload(payload);

    return this.http
      .put<ActividadApiResponse>(`${this.apiUrl}/${id}`, normalizedPayload, {
        headers: this.authService.getAuthHeaders(),
      })
      .pipe(
        map((response) => this.normalizarRespuestaMutacion(response)),
        catchError((error) => {
          console.error('Error al actualizar actividad', error);
          return throwError(() => error);
        }),
      );
  }

  private normalizarRespuestaListado(response: ActividadesListApiResponse): ActividadDto[] {
    if (Array.isArray(response)) return response;
    return response.data ?? response.actividades ?? response.items ?? [];
  }

  private normalizarRespuestaMutacion(response: ActividadApiResponse): ActividadMutationResult {
    const actividad = response.actividad ?? response.data ?? this.extraerActividadPlana(response);
    return {
      actividad,
      message: response.message,
      mensaje: response.mensaje,
    };
  }

  private extraerActividadPlana(response: ActividadApiResponse): ActividadDto {
    const { actividad, data, message, mensaje, ...dto } = response;
    return dto;
  }

  private normalizarPayload(payload: ActividadDto): ActividadDto {
    const areaId = this.normalizarEnteroPositivo(payload.areaId);
    const creadorId = this.normalizarEnteroPositivo(payload.creadorId);

    return {
      ...payload,
      ...(areaId ? { areaId } : {}),
      ...(creadorId ? { creadorId } : {}),
    };
  }

  private normalizarEnteroPositivo(valor: unknown): number | undefined {
    const numero = Number(valor);
    return Number.isInteger(numero) && numero > 0 ? numero : undefined;
  }
}
