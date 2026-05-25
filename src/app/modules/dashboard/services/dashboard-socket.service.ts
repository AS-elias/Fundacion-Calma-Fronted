import { Injectable, OnDestroy } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable, Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class DashboardSocketService implements OnDestroy {
  private socket: Socket | null = null;
  private dashboardUpdatedSubject = new Subject<any>();
  public dashboardUpdated$: Observable<any> = this.dashboardUpdatedSubject.asObservable();

  constructor() {}

  /**
   * Conecta al namespace /dashboard del backend usando el JWT
   */
  connect(): void {
    const token = localStorage.getItem('calma_token') || localStorage.getItem('token');
    
    if (!token) {
      console.warn('DashboardSocketService: No se encontró token JWT. No se conectará el socket.');
      return;
    }

    if (this.socket && this.socket.connected) {
      return; // Ya está conectado
    }

    console.log('DashboardSocketService: Conectando a /dashboard...');
    this.socket = io('https://fundacion-calma-backend.onrender.com/dashboard', {
      auth: {
        token: token,
      },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });

    this.socket.on('connect', () => {
      console.log('DashboardSocketService: ¡Conectado exitosamente!');
    });

    this.socket.on('dashboardUpdated', (payload: any) => {
      console.log('DashboardSocketService: Evento dashboardUpdated recibido!', payload);
      this.dashboardUpdatedSubject.next(payload);
    });

    this.socket.on('connect_error', (error) => {
      console.error('DashboardSocketService: Error de conexión', error);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('DashboardSocketService: Desconectado', reason);
    });
  }

  /**
   * Desconecta el socket si está activo
   */
  disconnect(): void {
    if (this.socket) {
      console.log('DashboardSocketService: Desconectando manual...');
      this.socket.disconnect();
      this.socket = null;
    }
  }

  ngOnDestroy(): void {
    this.disconnect();
    this.dashboardUpdatedSubject.complete();
  }
}
