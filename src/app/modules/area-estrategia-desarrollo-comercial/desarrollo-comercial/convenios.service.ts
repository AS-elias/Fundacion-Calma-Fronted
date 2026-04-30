import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { AuthService } from '../../auth/services/auth.service';

export interface ConvenioDto {
  id?: string | number;
  areaId?: number;
  creadorId?: number;
  entidadNombre?: string;
  nombre?: string;
  fechaExpiracion?: string;
  fecha?: string;
  siglas?: string;
  color?: string;
  logoUrl?: string;
  logo?: string;
  estado?: string;
  ruc?: string;
  rubro?: string;
  contactoNombre?: string;
  contacto?: string;
  telefonoContacto?: string;
  telefono?: string;
  tipo?: string;
  conexion?: string;
  comentarios?: string[];
  historial?: string[];
}

export interface ConvenioMutationResult {
  convenio: ConvenioDto;
  message?: string;
  mensaje?: string;
}

export interface HistorialCleanupResult {
  deletedCount?: number;
  message?: string;
  mensaje?: string;
}

export interface ConvenioHistorialDto {
  id?: number;
  convenioId?: number;
  usuarioId?: number | null;
  accion?: string;
  descripcion?: string;
  fechaCreacion?: string;
  createdAt?: string;
  fecha?: string;
}

type ConvenioHistorialApiResponse =
  | ConvenioHistorialDto[]
  | {
      data?: ConvenioHistorialDto[];
      historial?: ConvenioHistorialDto[];
      message?: string;
      mensaje?: string;
    };

type ConvenioApiResponse = ConvenioDto & {
  message?: string;
  mensaje?: string;
  convenio?: ConvenioDto;
  data?: ConvenioDto;
};

interface CreateComentarioDto {
  convenioId: number;
  usuarioId: number;
  comentario: string;
}

type ComentarioResponse = {
  id: number;
  convenioId: number;
  usuarioId: number;
  comentario: string;
};

type ArchivoResponse = {
  id: number;
  convenioId: number;
  subidoPorId: number;
  nombreArchivo: string;
  urlArchivo: string;
};

@Injectable({ providedIn: 'root' })
export class ConveniosService {
  private readonly apiUrl = 'http://localhost:3005/api/convenios';
  private readonly comentariosApiUrl = 'http://localhost:3005/api/comentarios';
  private readonly archivosApiUrl = 'http://localhost:3005/api/convenio-archivos';
  private readonly historialApiUrl = 'http://localhost:3005/api/convenio-historial';

  constructor(
    private http: HttpClient,
    private authService: AuthService,
  ) {}

  createConvenio(convenio: ConvenioDto): Observable<ConvenioMutationResult> {
    return this.http
      .post<ConvenioApiResponse>(this.apiUrl, convenio, {
        headers: this.authService.getAuthHeaders(),
      })
      .pipe(
        map((response) => this.normalizarRespuestaConvenio(response)),
        catchError((error) => {
          console.error('Error al crear convenio', error);
          return throwError(() => error);
        }),
      );
  }

  getConvenios(busqueda?: string, estado?: string): Observable<ConvenioDto[]> {
    let params = new HttpParams();
    if (busqueda) params = params.set('search', busqueda);
    if (estado) params = params.set('estado', estado);

    return this.http
      .get<ConvenioDto[]>(this.apiUrl, {
        params,
        headers: this.authService.getAuthHeaders(),
      })
      .pipe(catchError(() => of([])));
  }

  updateConvenio(convenio: ConvenioDto): Observable<ConvenioMutationResult> {
    if (!convenio.id) return throwError(() => new Error('Convenio sin id'));
    return this.http
      .put<ConvenioApiResponse>(`${this.apiUrl}/${convenio.id}`, convenio, {
        headers: this.authService.getAuthHeaders(),
      })
      .pipe(
        map((response) => this.normalizarRespuestaConvenio(response)),
        catchError((error) => {
          console.error('Error al actualizar convenio', error);
          return throwError(() => error);
        }),
      );
  }

  deleteConvenio(convenioId: string): Observable<void> {
    if (!convenioId) return throwError(() => new Error('Convenio sin id'));
    return this.http
      .delete<void>(`${this.apiUrl}/${convenioId}`, {
        headers: this.authService.getAuthHeaders(),
      })
      .pipe(
        catchError((error) => {
          console.error('Error al eliminar convenio', error);
          return throwError(() => error);
        }),
      );
  }

  addComentario(convenioId: string, comentario: string): Observable<ComentarioResponse | null> {
    if (!convenioId) return of(null);
    const convenioIdNum = Number(convenioId);
    const usuarioId = Number(this.authService.getCurrentUser()?.id ?? 0);
    if (!Number.isFinite(convenioIdNum) || !usuarioId) {
      console.error('No se pudo crear comentario: convenioId o usuarioId invalido', {
        convenioId,
        usuarioId,
      });
      return of(null);
    }

    const payload: CreateComentarioDto = {
      convenioId: convenioIdNum,
      usuarioId,
      comentario,
    };

    return this.http
      .post<ComentarioResponse>(
        this.comentariosApiUrl,
        payload,
        { headers: this.authService.getAuthHeaders() },
      )
      .pipe(
        catchError((error) => {
          console.error('Error al crear comentario', error);
          return throwError(() => error);
        }),
      );
  }

  getComentariosByConvenio(convenioId: string): Observable<ComentarioResponse[]> {
    if (!convenioId) return of([]);
    return this.http
      .get<ComentarioResponse[]>(`${this.comentariosApiUrl}/${convenioId}`, {
        headers: this.authService.getAuthHeaders(),
      })
      .pipe(catchError(() => of([])));
  }

  getHistorialByConvenio(convenioId: string): Observable<ConvenioHistorialDto[]> {
    if (!convenioId) return of([]);
    return this.http
      .get<ConvenioHistorialApiResponse>(`${this.historialApiUrl}/convenio/${convenioId}`, {
        headers: this.authService.getAuthHeaders(),
      })
      .pipe(
        map((response) => this.normalizarRespuestaHistorial(response)),
        catchError(() => of([])),
      );
  }

  deleteComentario(comentarioId: number): Observable<void> {
    if (!comentarioId) return throwError(() => new Error('Comentario sin id'));
    return this.http
      .delete<void>(`${this.comentariosApiUrl}/${comentarioId}`, {
        headers: this.authService.getAuthHeaders(),
      })
      .pipe(
        catchError((error) => {
          console.error('Error al eliminar comentario', error);
          return throwError(() => error);
        }),
      );
  }

  clearHistorialByConvenio(convenioId: string): Observable<HistorialCleanupResult> {
    if (!convenioId) return throwError(() => new Error('Convenio sin id'));
    return this.http
      .delete<HistorialCleanupResult>(`${this.historialApiUrl}/convenio/${convenioId}`, {
        headers: this.authService.getAuthHeaders(),
      })
      .pipe(
        catchError((error) => {
          console.error('Error al limpiar historial', error);
          return throwError(() => error);
        }),
      );
  }

  addArchivo(convenioId: string, file: File): Observable<ArchivoResponse | null> {
    if (!convenioId || !file) return of(null);
    const convenioIdNum = Number(convenioId);
    const subidoPorId = Number(this.authService.getCurrentUser()?.id ?? 0);
    if (!Number.isFinite(convenioIdNum) || !subidoPorId) {
      console.error('No se pudo crear archivo: convenioId o subidoPorId invalido', {
        convenioId,
        subidoPorId,
      });
      return of(null);
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('nombreArchivo', file.name);
    formData.append('convenioId', String(convenioIdNum));
    formData.append('subidoPorId', String(subidoPorId));

    return this.http
      .post<ArchivoResponse>(
        this.archivosApiUrl,
        formData,
        { headers: this.authService.getAuthHeadersWithoutContentType() },
      )
      .pipe(
        catchError((error) => {
          console.error('Error al crear archivo', error);
          return throwError(() => error);
        }),
      );
  }

  getArchivosByConvenio(convenioId: string): Observable<ArchivoResponse[]> {
    if (!convenioId) return of([]);
    return this.http
      .get<ArchivoResponse[]>(`${this.archivosApiUrl}/convenio/${convenioId}`, {
        headers: this.authService.getAuthHeaders(),
      })
      .pipe(catchError(() => of([])));
  }

  deleteArchivo(archivoId: number): Observable<void> {
    if (!archivoId) return throwError(() => new Error('Archivo sin id'));
    return this.http
      .delete<void>(`${this.archivosApiUrl}/${archivoId}`, {
        headers: this.authService.getAuthHeaders(),
      })
      .pipe(
        catchError((error) => {
          console.error('Error al eliminar archivo', error);
          return throwError(() => error);
        }),
      );
  }

  private normalizarRespuestaConvenio(response: ConvenioApiResponse): ConvenioMutationResult {
    const convenio = response.convenio ?? response.data ?? this.extraerConvenioPlano(response);
    return {
      convenio,
      message: response.message,
      mensaje: response.mensaje,
    };
  }

  private extraerConvenioPlano(response: ConvenioApiResponse): ConvenioDto {
    const { message, mensaje, convenio, data, ...dto } = response;
    return dto;
  }

  private normalizarRespuestaHistorial(
    response: ConvenioHistorialApiResponse,
  ): ConvenioHistorialDto[] {
    if (Array.isArray(response)) return response;
    return response.data ?? response.historial ?? [];
  }
}
