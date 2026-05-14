import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Notificacion {
  id: number;
  titulo: string;
  mensaje: string;
  tipo: string;
  leido: boolean;
  creado_at: Date;
}

@Injectable({
  providedIn: 'root'
})
export class NotificacionesService {

  private apiUrl = 'http://localhost:3005/api/notificaciones';

  constructor(private http: HttpClient) {}

  listar(): Observable<Notificacion[]> {
    return this.http.get<Notificacion[]>(this.apiUrl);
  }

  crear(data: any) {
    return this.http.post(this.apiUrl, data);
  }

  marcarLeido(id: number, leido: boolean) {
    return this.http.patch(`${this.apiUrl}/${id}/leido`, { leido });
  }

  eliminar(id: number) {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

}