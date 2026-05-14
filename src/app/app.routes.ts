import { Routes } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './modules/auth/services/auth.service';
import { LoginComponent } from './modules/auth/pages/login/login.component';
import { LogoutComponent } from './modules/auth/pages/logout/logout.component';
import { authGuard, adminGuard } from './core/guards/auth.guard';

import { AdminComponent } from './modules/dashboard/pages/admin/admin.component';
import { UserComponent } from './modules/dashboard/pages/user/user.component';
import { MainLayoutComponent } from './shared/layouts/main-layout/main-layout';

import { ComunicacionesComponent } from './modules/comunicaciones/pages/comunicaciones/comunicaciones.component';
import { ComunidadComponent } from './modules/comunidad/pages/comunidad/comunidad.component';
import { Notificaciones } from './modules/notificaciones/pages/notificaciones/notificaciones';
import { SalasTrabajo } from './modules/salas-trabajo/pages/salas-trabajo/salas-trabajo';
import { Repositorio } from './modules/repositorio/pages/repositorio/repositorio';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  { path: 'login', component: LoginComponent },
  { path: 'logout', component: LogoutComponent },

  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        children: [
          {
            path: 'admin-dashboard',
            component: AdminComponent,
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
            path: 'usuario-dashboard',
            component: UserComponent,
            canActivate: [authGuard],
          },
          {
            path: 'director-dashboard',
            loadChildren: () =>
              import('./modules/area-estrategia-desarrollo-comercial/comercial.routes')
                .then((m) => m.COMERCIAL_ROUTES),
            canActivate: [adminGuard],
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
        component: ComunicacionesComponent
      },
      {
        path: 'comunidad-calma',
        component: ComunidadComponent
      },
      {
        path: 'salas-trabajo',
        component: SalasTrabajo
      },
      {
        path: 'notificaciones',
        component: Notificaciones
      },
      {
        path: 'repositorio',
        component: Repositorio
      }
    ],
  },

  { path: '**', redirectTo: 'login' },
];