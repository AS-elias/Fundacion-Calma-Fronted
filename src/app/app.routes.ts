import { Routes } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './modules/auth/services/auth.service';
import { LoginComponent } from './modules/auth/pages/login/login.component';
import { LogoutComponent } from './modules/auth/pages/logout/logout.component';
import { authGuard, adminGuard } from './core/guards/auth.guard';

import { AdminComponent } from './modules/dashboard/pages/admin/admin.component';
import { UserComponent } from './modules/dashboard/pages/user/user.component';
import { MainLayoutComponent } from './shared/layouts/main-layout/main-layout';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  { path: 'login', component: LoginComponent },
  { path: 'logout', component: LogoutComponent },
  { 
    path: 'change-password', 
    loadComponent: () => import('./modules/auth/pages/change-password/change-password.component').then(m => m.ChangePasswordComponent) 
  },
  {
    path: 'recuperar-password',
    loadComponent: () => import('./modules/auth/pages/recuperar-password/recuperar-password.component').then(m => m.RecuperarPasswordComponent)
  },
  {
    path: 'reset-password',
    loadComponent: () => import('./modules/auth/pages/reset-password/reset-password.component').then(m => m.ResetPasswordComponent)
  },

  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        children: [
          {
            path: 'admin-dashboard/usuarios/registro',
            loadComponent: () =>
              import('./modules/dashboard/pages/admin/usuarios/registro/registro-usuario.component')
                .then(m => m.RegistroUsuarioComponent),
            canActivate: [adminGuard],
          },
          {
            path: 'admin-dashboard/usuarios/editar/:id',
            loadComponent: () =>
              import('./modules/dashboard/pages/admin/usuarios/editar/editar-usuario.component')
                .then(m => m.EditarUsuarioComponent),
            canActivate: [adminGuard],
          },
          {
            path: 'admin-dashboard/usuarios',
            loadComponent: () =>
              import('./modules/dashboard/pages/admin/usuarios/lista-usuarios/lista-usuarios.component')
                .then(m => m.ListaUsuariosComponent),
            canActivate: [adminGuard],
          },
          {
            path: 'admin-dashboard',
            title: 'Fundación Calma | Administrador',
            loadComponent: () => import('./modules/dashboard/pages/admin/admin.component').then(m => m.AdminComponent),
            canActivate: [adminGuard],
          },
          {
            path: 'usuario-dashboard',
            title: 'Fundación Calma | Panel de Usuario',
            loadComponent: () => import('./modules/dashboard/pages/user/user.component').then(m => m.UserComponent),
            canActivate: [authGuard],
          },
          {
            path: 'director-dashboard',
            loadChildren: () =>
              import('./modules/area-estrategia-desarrollo-comercial/comercial.routes')
                .then((m) => m.COMERCIAL_ROUTES),
            canActivate: [authGuard],
          },
          {
            path: '',
            redirectTo: () => {
              const authService = inject(AuthService);
              if (authService.isAdmin() || authService.isDirector()) {
                return 'admin-dashboard';
              } else {
                return 'usuario-dashboard';
              }
            },
            pathMatch: 'full',
          },
        ]
      },
      {
        path: 'comunicaciones',
        title: 'Fundación Calma | Comunicaciones',
        loadComponent: () => import('./modules/comunicaciones/pages/comunicaciones/comunicaciones.component').then(m => m.ComunicacionesComponent)
      },
      {
        path: 'comunidad-calma',
        title: 'Fundación Calma | Comunidad',
        loadComponent: () => import('./modules/comunidad/pages/comunidad/comunidad.component').then(m => m.ComunidadComponent)
      },
      {
        path: 'salas-trabajo',
        title: 'Fundación Calma | Salas de Trabajo',
        loadComponent: () => import('./modules/salas-trabajo/pages/salas-trabajo/salas-trabajo').then(m => m.SalasTrabajo)
      },
      {
        path: 'notificaciones',
        title: 'Fundación Calma | Notificaciones',
        loadComponent: () => import('./modules/notificaciones/pages/notificaciones/notificaciones').then(m => m.Notificaciones)
      },
      {
        path: 'repositorio',
        title: 'Fundación Calma | Repositorio',
        loadComponent: () => import('./modules/repositorio/pages/repositorio/repositorio').then(m => m.Repositorio)
      },
      {
        path: 'perfil',
        loadComponent: () =>
          import('./modules/perfil/perfil.component')
            .then(m => m.PerfilComponent)
      }
    ],
  },

  { path: '**', redirectTo: 'login' },
];
