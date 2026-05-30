import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { of, tap } from 'rxjs';

// Almacén de caché en memoria
const cache = new Map<string, { data: HttpResponse<any>, expiry: number }>();
// Tiempo de vida de la caché: 2 minutos
const CACHE_DURATION_MS = 2 * 60 * 1000; 

export const cacheInterceptor: HttpInterceptorFn = (req, next) => {
  // 1. Invalidador Inteligente: Si el usuario CREA, EDITA o ELIMINA algo, 
  // vaciamos toda la caché para asegurar que la próxima vez que navegue vea datos frescos.
  if (req.method !== 'GET') {
    if (cache.size > 0) {
      console.log('🔄 Mutación detectada (POST/PUT/DELETE). Vaciando caché...');
      cache.clear();
    }
    return next(req);
  }

  // 2. Comprobar Caché para peticiones GET
  const cachedResponse = cache.get(req.urlWithParams);
  
  if (cachedResponse) {
    if (Date.now() < cachedResponse.expiry) {
      // Retornar clon de la respuesta en caché instantáneamente
      return of(cachedResponse.data.clone());
    } else {
      // Caché expirada, limpiar registro
      cache.delete(req.urlWithParams);
    }
  }

  // 3. Si no hay caché válida, dejar pasar la petición y guardarla al volver
  return next(req).pipe(
    tap(event => {
      if (event instanceof HttpResponse) {
        cache.set(req.urlWithParams, {
          data: event.clone(),
          expiry: Date.now() + CACHE_DURATION_MS
        });
      }
    })
  );
};
