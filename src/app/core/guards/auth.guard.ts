import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../../modules/auth/services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  console.warn('⚠️ Usuario no autenticado. Redirigiendo al login...');
  router.navigate(['/login']);
  return false;
};

// Guard para verificar si el usuario es admin
export const adminGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAdmin() || authService.isDirector()) {
    return true;
  }

  console.warn('⚠️ Acceso denegado. Se requieren permisos de Director/Admin.');
  router.navigate(['/dashboard/usuario-dashboard']);
  return false;
};
