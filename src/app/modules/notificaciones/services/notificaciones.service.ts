import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable, Subject } from 'rxjs';
import { AuthService } from '../../auth/services/auth.service';

export type TipoNotificacion = 'sistema' | 'comunicados';

export interface Notificacion {
  id: number;
  titulo: string;
  mensaje: string;
  tipo: TipoNotificacion;
  leido: boolean;
  favorito?: boolean;
  archivado?: boolean;
  creado_at?: Date | string;
  imagen?: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class NotificacionesService {

  private apiUrl = 'http://localhost:3005/api/notificaciones';
  private apiOrigin = this.apiUrl.replace(/\/api\/notificaciones$/, '');
  private cambiosSubject = new Subject<void>();
  cambios$ = this.cambiosSubject.asObservable();

  constructor(
    private http: HttpClient,
    private authService: AuthService,
  ) {}

  listar(): Observable<Notificacion[]> {
    return this.http.get<Notificacion[]>(this.apiUrl, {
      params: this.usuarioParams(),
    }).pipe(
      map((notificaciones) =>
        notificaciones.map((notificacion) => ({
          ...notificacion,
          imagen: this.normalizarArchivoUrl(notificacion.imagen),
          tipo:
            notificacion.tipo === 'comunicados' || notificacion.tipo === 'sistema'
              ? notificacion.tipo
              : 'sistema',
        })),
      ),
    );
  }

  crear(data: FormData) {
    return this.http.post<Notificacion>(this.apiUrl, data, {
      headers: this.authService.getAuthHeadersWithoutContentType(),
    });
  }

  marcarLeido(id: number, leido: boolean) {
    return this.http.patch(
      `${this.apiUrl}/${id}/leido`,
      { leido, usuarioId: this.usuarioId() },
      { params: this.usuarioParams() },
    );
  }

  marcarFavorito(id: number, favorito: boolean) {
    return this.http.patch<Notificacion>(
      `${this.apiUrl}/${id}/favorito`,
      { favorito, usuarioId: this.usuarioId() },
      { params: this.usuarioParams() },
    );
  }

  archivar(id: number, archivado: boolean) {
    return this.http.patch<Notificacion>(
      `${this.apiUrl}/${id}/archivado`,
      { archivado, usuarioId: this.usuarioId() },
      { params: this.usuarioParams() },
    );
  }

  eliminar(id: number) {
    return this.http.delete(`${this.apiUrl}/${id}`, {
      params: this.usuarioParams(),
    });
  }

  notificarCambio(): void {
    this.cambiosSubject.next();
  }

  private usuarioId(): number | undefined {
    return this.authService.getCurrentUser()?.id;
  }

  private usuarioParams(): Record<string, string> {
    const usuarioId = this.usuarioId();
    return usuarioId ? { usuarioId: String(usuarioId) } : {};
  }

  private normalizarArchivoUrl(url: string | null | undefined): string | null | undefined {
    if (!url || /^https?:\/\//i.test(url) || url.startsWith('blob:') || url.startsWith('data:')) {
      return url;
    }

    return `${this.apiOrigin}${url.startsWith('/') ? url : `/${url}`}`;
  }
}
