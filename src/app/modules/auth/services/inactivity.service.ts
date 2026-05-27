import { Injectable, NgZone, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { MessageService } from 'primeng/api';

@Injectable({
  providedIn: 'root'
})
export class InactivityService {
  private timeoutId: any;
  private readonly TIMEOUT_MS = 15 * 60 * 1000; // 15 minutos
  
  private router = inject(Router);
  private authService = inject(AuthService);
  private ngZone = inject(NgZone);
  private messageService = inject(MessageService);

  // Eventos que reinician el temporizador
  private readonly eventos = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];

  iniciarTemporizador(): void {
    // Si no está autenticado, no hacer nada
    if (!this.authService.isAuthenticated()) return;

    // Ejecutar fuera de Angular Zone para no saturar el change detection
    this.ngZone.runOutsideAngular(() => {
      this.eventos.forEach(evento => {
        window.addEventListener(evento, () => this.reiniciarTemporizador(), { passive: true });
      });
    });

    this.reiniciarTemporizador();
  }

  detenerTemporizador(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
    this.eventos.forEach(evento => {
      window.removeEventListener(evento, () => this.reiniciarTemporizador());
    });
  }

  private reiniciarTemporizador(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
    
    // Configurar nuevo timeout
    this.timeoutId = setTimeout(() => {
      this.ngZone.run(() => {
        this.cerrarSesionPorInactividad();
      });
    }, this.TIMEOUT_MS);
  }

  private cerrarSesionPorInactividad(): void {
    if (this.authService.isAuthenticated()) {
      this.authService.logout();
      
      this.messageService.add({
        severity: 'warn',
        summary: 'Sesión Expirada',
        detail: 'Tu sesión ha expirado por seguridad debido a 15 minutos de inactividad.',
        life: 10000,
        sticky: true
      });
    }
  }
}
