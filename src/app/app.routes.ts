import { Routes } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './modules/auth/services/auth.service';
import { LoginComponent } from './modules/auth/pages/login/login.component';
import { LogoutComponent } from './modules/auth/pages/logout/logout.component';
import { authGuard, adminGuard } from './core/guards/auth.guard';
import { AdminComponent } from './modules/dashboard/pages/admin/admin.component';
import { UserComponent } from './modules/dashboard/pages/user/user.component';
import { MainLayoutComponent } from './shared/layouts/main-layout/main-layout';

// Nuevos componentes importados
import { ComunicacionesComponent } from './modules/comunicaciones/pages/comunicaciones/comunicaciones.component';
import { ComunidadComponent } from './modules/comunidad/pages/comunidad/comunidad.component';
import { RepositorioComponent } from './modules/repositorio/pages/repositorio/repositorio.component';
import { SalasTrabajoComponent } from './modules/salas-trabajo/pages/salas-trabajo/salas-trabajo.component';
import { NotificacionesComponent } from './modules/notificaciones/pages/notificaciones/notificaciones.component';

export const routes: Routes = [
  // 1. Redirigir raíz al login
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  // 2. Login (sin protección)
  { path: 'login', component: LoginComponent },
  { path: 'logout', component: LogoutComponent },

  // 3. Dashboard protegido con el layout
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        children: [
          // Dashboard de Admin (solo admins)
          {
            path: 'admin-dashboard', // <-- CAMBIADO
            component: AdminComponent,
            canActivate: [adminGuard],
          },
          // Gestión de Usuarios (lista)
          {
            path: 'admin-dashboard/usuarios',
            loadComponent: () => import('./modules/dashboard/pages/admin/usuarios/lista-usuarios/lista-usuarios.component').then(m => m.ListaUsuariosComponent),
            canActivate: [adminGuard],
          },
          // Registro de Usuarios (solo admins)
          {
            path: 'admin-dashboard/usuarios/registro',
            loadComponent: () => import('./modules/dashboard/pages/admin/usuarios/registro/registro-usuario.component').then(m => m.RegistroUsuarioComponent),
            canActivate: [adminGuard],
          },
          // Edición de Usuarios (solo admins)
          {
            path: 'admin-dashboard/usuarios/editar/:id',
            loadComponent: () => import('./modules/dashboard/pages/admin/usuarios/editar/editar-usuario.component').then(m => m.EditarUsuarioComponent),
            canActivate: [adminGuard],
          },
          // Dashboard de Usuario (cualquier usuario autenticado)
          {
            path: 'usuario-dashboard', // <-- CAMBIADO
            component: UserComponent,
            canActivate: [authGuard],
          },
          // Rutas de las áreas (Estrategia, Análisis, etc.)
          {
            path: 'director-dashboard',
            loadChildren: () =>
              import('./modules/area-estrategia-desarrollo-comercial/comercial.routes').then(
                (m) => m.COMERCIAL_ROUTES,
              ),
            canActivate: [authGuard]
          },
          // Redirigir dashboard raíz según el rol del usuario
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
      // Nuevas rutas agregadas del Sidebar (Fuera de 'dashboard' pero dentro del layout)
      {
        path: 'comunicaciones',
        component: ComunicacionesComponent
      },
      {
        path: 'comunidad-calma',
        component: ComunidadComponent
      },
      {
        path: 'repositorio',
        component: RepositorioComponent
      },
      {
        path: 'salas-trabajo',
        component: SalasTrabajoComponent
      },
      {
        path: 'notificaciones',
        component: NotificacionesComponent
      }
    ],
  },

  // 4. Comodín para atrapar rutas que no existen
  { path: '**', redirectTo: 'login' },
];