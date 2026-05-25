import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-recuperar-password',
  standalone: true,
  imports: [CommonModule, FormsModule, InputTextModule, RouterModule],
  templateUrl: './recuperar-password.component.html',
  styleUrls: ['./recuperar-password.component.scss'],
  changeDetection: ChangeDetectionStrategy.Default
})
export class RecuperarPasswordComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  email = '';
  cargando = false;
  enviado = false;

  onSubmit(): void {
    if (!this.email || !this.email.includes('@')) {
      alert('Por favor, ingresa un correo electrónico válido.');
      return;
    }

    this.cargando = true;
    this.authService.forgotPassword(this.email).subscribe({
      next: (res) => {
        this.cargando = false;
        this.enviado = true;
      },
      error: (err) => {
        this.cargando = false;
        // Aunque falle (ej. correo no existe), por seguridad es mejor decir que se envió,
        // o si es un error 500 mostrar alerta. Depende de cómo el backend lo maneje.
        // Aquí mostraremos éxito de igual manera por privacidad, o alerta si es red.
        if (err.status === 0) {
          alert('Error de conexión con el servidor.');
        } else {
          // Asumimos que si falla con 404 igual mostramos éxito para no revelar correos.
          this.enviado = true;
        }
      }
    });
  }

  volverAlLogin(): void {
    this.router.navigate(['/login']);
  }
}
