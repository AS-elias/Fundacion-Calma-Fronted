import { Component, ChangeDetectionStrategy, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../modules/auth/services/auth.service';

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

  // Señales para los datos del usuario
  nombreUsuario = signal<string>('Usuario');
  rolUsuario = signal<string>('Rol Desconocido');
  inicialesUsuario = signal<string>('U');

  ngOnInit() {
    this.cargarDatosUsuario();
  }

  cargarDatosUsuario() {
    const user = this.authService.getCurrentUser();
    
    if (user) {
      const nombreCompleto = user.nombre || 'Usuario';
      this.nombreUsuario.set(nombreCompleto);
      
      // Formatear rol
      this.rolUsuario.set(user.rol ? user.rol : 'Usuario');

      // Generar iniciales (primera letra del nombre + primera letra del apellido si existe)
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

  toggleDarkMode() {
    const element = document.querySelector('html');
    if (element) {
      element.classList.toggle('app-dark');
      this.isDarkMode.set(element.classList.contains('app-dark'));
    }
  }
}
