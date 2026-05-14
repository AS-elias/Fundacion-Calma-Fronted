import { Component, ChangeDetectionStrategy, signal, inject, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../modules/auth/services/auth.service';
import { NotificacionesService, Notificacion } from '../../../modules/notificaciones/services/notificaciones.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavbarComponent implements OnInit {

  isDarkMode = signal(false);

  private authService = inject(AuthService);
  private notifService = inject(NotificacionesService);

  nombreUsuario = signal<string>('Usuario');
  rolUsuario = signal<string>('Rol Desconocido');
  inicialesUsuario = signal<string>('U');

  notificaciones = signal<Notificacion[]>([]);
  mostrarDropdown = signal(false);

  ngOnInit() {
    this.cargarDatosUsuario();
    this.cargarNotificaciones();
  }

  cargarDatosUsuario() {
    const user = this.authService.getCurrentUser();

    if (user) {
      const nombreCompleto = user.nombre || 'Usuario';
      this.nombreUsuario.set(nombreCompleto);

      this.rolUsuario.set(user.rol ? user.rol : 'Usuario');

      let iniciales = nombreCompleto.charAt(0).toUpperCase();
      if ((user as any).apellido) {
        iniciales += (user as any).apellido.charAt(0).toUpperCase();
      } else {
        const partes = nombreCompleto.split(' ');
        if (partes.length > 1) {
          iniciales += partes[1].charAt(0).toUpperCase();
        }
      }

      this.inicialesUsuario.set(iniciales);
    }
  }

  cargarNotificaciones() {
    this.notifService.listar().subscribe(data => {
      this.notificaciones.set(data);
    });
  }

  toggleDropdown() {
    this.mostrarDropdown.update(v => !v);
  }

  marcarLeida(n: Notificacion) {
    if (!n.leido) {
      this.notifService.marcarLeido(n.id, true).subscribe(() => {
        const actualizadas = this.notificaciones().map(notif =>
          notif.id === n.id ? { ...notif, leido: true } : notif
        );
        this.notificaciones.set(actualizadas);
      });
    }
  }

  noLeidas() {
    return this.notificaciones().filter(n => !n.leido).length;
  }

  @HostListener('document:click', ['$event'])
  cerrarDropdown(event: any) {
    if (!event.target.closest('.notif-container')) {
      this.mostrarDropdown.set(false);
    }
  }

  toggleDarkMode() {
    const element = document.querySelector('html');
    if (element) {
      element.classList.toggle('app-dark');
      this.isDarkMode.set(element.classList.contains('app-dark'));
    }
  }
}