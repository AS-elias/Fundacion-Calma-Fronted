import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { AuthService } from '../../modules/auth/services/auth.service';
import { MessageService } from 'primeng/api';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const messageService = inject(MessageService);

  const token = authService.getToken();

  // Clonar la petición para inyectar el token si existe (y si no es a una ruta pública como login)
  let authReq = req;
  if (token && !req.url.includes('/auth/login') && !req.url.includes('/auth/reset-password')) {
    authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // Si el backend nos rechaza porque el token es falso o expiró
      if (error.status === 401) {
        console.warn('⚠️ Alerta de Seguridad: Token inválido o expirado. Expulsando usuario.');
        authService.logout();
        messageService.add({
          severity: 'error',
          summary: 'Sesión Expirada',
          detail: 'Por motivos de seguridad, tu sesión ha sido cerrada.'
        });
        setTimeout(() => {
          window.location.href = '/login';
        }, 1500);
      }
      return throwError(() => error);
    })
  );
};
