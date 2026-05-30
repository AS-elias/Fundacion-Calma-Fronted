import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { retry, timer } from 'rxjs';

export const retryInterceptor: HttpInterceptorFn = (req, next) => {
  // Solo reintentar peticiones GET para evitar envíos duplicados (POST/PUT/DELETE)
  if (req.method === 'GET') {
    return next(req).pipe(
      retry({
        count: 2,
        delay: (error: HttpErrorResponse, retryCount: number) => {
          // No reintentar errores de autenticación (401, 403) ni errores de cliente (400, 404)
          if (error.status >= 400 && error.status < 500) {
            throw error;
          }
          // Esperar 1 segundo antes de cada reintento silencioso
          console.warn(`Intento de reconexión ${retryCount}/2 para ${req.url}...`);
          return timer(1000);
        }
      })
    );
  }
  return next(req);
};
