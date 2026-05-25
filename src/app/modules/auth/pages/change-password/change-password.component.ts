import { Component, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [CommonModule, FormsModule, InputTextModule, PasswordModule],
  templateUrl: './change-password.component.html',
  styleUrls: ['./change-password.component.scss'],
  changeDetection: ChangeDetectionStrategy.Default
})
export class ChangePasswordComponent implements OnInit {
  private router = inject(Router);
  private authService = inject(AuthService);

  email = '';
  tempPassword = '';
  newPassword = '';
  confirmPassword = '';
  cargando = false;

  hasUppercase(str: string): boolean { return /[A-Z]/.test(str); }
  hasLowercase(str: string): boolean { return /[a-z]/.test(str); }
  hasNumber(str: string): boolean { return /\d/.test(str); }
  hasSymbol(str: string): boolean { return /[@$!%*?&]/.test(str); }

  ngOnInit(): void {
    const nav = this.router.getCurrentNavigation();
    if (nav?.extras.state) {
      this.email = nav.extras.state['email'] || '';
      this.tempPassword = nav.extras.state['tempPassword'] || '';
    } else {
      // Intenta sacar del history state si recargaron la página (aunque puede no estar si entraron directo)
      this.email = history.state.email || '';
      this.tempPassword = history.state.tempPassword || '';
    }

    if (!this.email || !this.tempPassword) {
      alert('Información incompleta. Por favor, inicie sesión nuevamente.');
      this.router.navigate(['/login']);
    }
  }

  onChangePassword(): void {
    if (!this.newPassword || !this.confirmPassword) {
      alert('Por favor, ingresa tu nueva contraseña y confírmala.');
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      alert('Las contraseñas no coinciden.');
      return;
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(this.newPassword)) {
      alert('La nueva contraseña no cumple con los requisitos de seguridad.');
      return;
    }

    this.cargando = true;
    this.authService.changePassword(this.email, this.tempPassword, this.newPassword).subscribe({
      next: (respuesta) => {
        this.cargando = false;
        
        // El authService ya guarda los tokens. Ahora redirigimos según el rol
        const rol = respuesta.usuario?.rol || this.authService.getUserRole();
        if (this.authService.isAdmin() || this.authService.isDirector()) {
          this.router.navigate(['/dashboard/admin-dashboard']);
        } else {
          this.router.navigate(['/dashboard/usuario-dashboard']);
        }
      },
      error: (err) => {
        this.cargando = false;
        console.error('Error cambiando contraseña:', err);
        alert('Ocurrió un error al cambiar la contraseña. Verifica tu conexión o intenta nuevamente.');
      }
    });
  }
}
