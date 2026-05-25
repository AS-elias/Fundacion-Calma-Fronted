import { Component, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PasswordModule } from 'primeng/password';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, PasswordModule, RouterModule],
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.scss'],
  changeDetection: ChangeDetectionStrategy.Default
})
export class ResetPasswordComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  token = '';
  newPassword = '';
  confirmPassword = '';
  cargando = false;
  exito = false;
  tokenInvalido = false;

  ngOnInit(): void {
    // Capturar el token de la URL: /reset-password?token=XYZ
    this.route.queryParams.subscribe(params => {
      this.token = params['token'];
      if (!this.token) {
        this.tokenInvalido = true;
      }
    });
  }

  onSubmit(): void {
    if (!this.newPassword || !this.confirmPassword) {
      alert('Por favor, completa ambos campos.');
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      alert('Las contraseñas no coinciden.');
      return;
    }

    if (this.newPassword.length < 8) {
      alert('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }

    this.cargando = true;
    this.authService.resetPassword(this.token, this.newPassword).subscribe({
      next: (res) => {
        this.cargando = false;
        this.exito = true;
      },
      error: (err) => {
        this.cargando = false;
        if (err.status === 400 || err.status === 401) {
          alert('El enlace ha expirado o no es válido. Por favor, solicita uno nuevo.');
          this.tokenInvalido = true;
        } else {
          alert('Ocurrió un error al cambiar la contraseña. Intenta nuevamente más tarde.');
        }
      }
    });
  }

  irAlLogin(): void {
    this.router.navigate(['/login']);
  }
}
