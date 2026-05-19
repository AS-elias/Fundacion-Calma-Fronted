import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthService } from '../../auth/services/auth.service';

export interface Documento {
  id?: number;
  nombre: string;
  url: string;
  icono?: string;
  fecha?: Date;
}

export interface Bloque {
  id: number;
  titulo: string;
  subtitulo?: string;
  icono?: string;
  documentos: Documento[];
}

@Injectable({
  providedIn: 'root'
})
export class RepositorioService {

  private http = inject(HttpClient);
  private authService = inject(AuthService);

  private apiUrl = 'http://localhost:3005/api/repositorio';
  private apiOrigin = this.apiUrl.replace(/\/api\/repositorio$/, '');

  listar(): Observable<Bloque[]> {
    return this.http.get<Bloque[]>(this.apiUrl).pipe(
      map((bloques) =>
        bloques.map((bloque) => ({
          ...bloque,
          documentos: bloque.documentos.map((documento) => ({
            ...documento,
            url: this.normalizarArchivoUrl(documento.url),
          })),
        })),
      ),
    );
  }

  listarBloques(): Observable<Bloque[]> {
    return this.listar();
  }

  subirArchivo(formData: FormData): Observable<any> {
    return this.http.post(this.apiUrl, formData, {
      headers: this.authService.getAuthHeadersWithoutContentType(),
    });
  }

  agregarEnlace(
    bloqueId: number,
    nombre: string,
    url: string,
  ): Observable<Documento> {
    return this.http.post<Documento>(
      `${this.apiUrl}/enlace`,
      {
        bloqueId,
        nombre,
        url,
      },
      { headers: this.authService.getAuthHeaders() },
    );
  }

  subirDocumento(
    bloqueId: number,
    archivo: File
  ): Observable<any> {

    const formData = new FormData();

    formData.append('file', archivo);

    formData.append(
      'bloqueId',
      bloqueId.toString()
    );

    return this.subirArchivo(formData);
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/${id}`,
      { headers: this.authService.getAuthHeaders() },
    );
  }

  eliminarDocumento(id: number): Observable<void> {
    return this.eliminar(id);
  }

  private normalizarArchivoUrl(url: string): string {
    if (!url || /^https?:\/\//i.test(url) || url.startsWith('blob:') || url.startsWith('data:')) {
      return url;
    }

    return `${this.apiOrigin}${url.startsWith('/') ? url : `/${url}`}`;
  }
}
