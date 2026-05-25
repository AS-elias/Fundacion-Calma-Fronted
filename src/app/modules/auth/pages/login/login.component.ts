import { Component, inject, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { Router } from '@angular/router'
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms'; 
import { AuthService } from '../../services/auth.service';

import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, InputTextModule, PasswordModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  loginForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  cargando = signal(false);
  mensajeError = signal<string | null>(null);

  get f() { return this.loginForm.controls; }

  verificarBloqueo(email: string): boolean {
    const lockInfoStr = localStorage.getItem(`bloqueo_login_${email}`);
    if (lockInfoStr) {
      const lockInfo = JSON.parse(lockInfoStr);
      if (new Date().getTime() < lockInfo.hasta) {
        return true;
      } else {
        localStorage.removeItem(`bloqueo_login_${email}`);
        localStorage.removeItem(`intentos_login_${email}`);
      }
    }
    return false;
  }

  registrarIntentoFallido(email: string): void {
    let intentos = parseInt(localStorage.getItem(`intentos_login_${email}`) || '0', 10);
    intentos++;
    localStorage.setItem(`intentos_login_${email}`, intentos.toString());

    if (intentos >= 5) {
      const lockUntil = new Date().getTime() + 15 * 60 * 1000; // 15 minutos
      localStorage.setItem(`bloqueo_login_${email}`, JSON.stringify({ hasta: lockUntil }));
      this.mensajeError.set('Has superado el límite de intentos. Por seguridad, tu cuenta ha sido bloqueada por 15 minutos. Usa "Recuperar contraseña" si la olvidaste.');
    } else {
      this.mensajeError.set(`Correo o contraseña incorrectos. Intento ${intentos} de 5.`);
    }
  }

  limpiarIntentos(email: string): void {
    localStorage.removeItem(`intentos_login_${email}`);
    localStorage.removeItem(`bloqueo_login_${email}`);
  }

  onLogin() {
    this.mensajeError.set(null);

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    const { email, password } = this.loginForm.value;

    if (this.verificarBloqueo(email)) {
      this.mensajeError.set('Tu cuenta está temporalmente bloqueada por seguridad. Usa "Recuperar contraseña" o espera 15 minutos.');
      return;
    }

    this.cargando.set(true);
    console.log("🔄 Intentando login...");
    
    this.authService.login(email, password).subscribe({
      next: (respuesta) => {
        this.limpiarIntentos(email);
        this.cargando.set(false);
        console.log("✅ Respuesta del backend:", respuesta);
        
        if (respuesta.requirePasswordChange) {
          console.log("⚠️ Se requiere cambio de contraseña.");
          this.router.navigate(['/change-password'], {
            state: { email, tempPassword: password }
          });
          return;
        }

        const rol = respuesta.usuario?.rol;
        console.log("🎯 Rol detectado:", rol);
        
        // Redirigir según el rol usando los métodos del AuthService
        if (this.authService.isAdmin() || this.authService.isDirector()) {
          console.log("👑 Redirigiendo a /dashboard/admin-dashboard");
          this.router.navigate(['/dashboard/admin-dashboard']);
        } else {
          console.log("👤 Redirigiendo a /dashboard/usuario-dashboard");
          this.router.navigate(['/dashboard/usuario-dashboard']);
        }
      },
      error: (error) => {
        this.cargando.set(false);
        console.error("❌ Error:", error);
        if (error.status === 0) {
          this.mensajeError.set('No se puede conectar al servidor.');
        } else if (error.status === 401) {
          this.registrarIntentoFallido(email);
        } else {
          this.mensajeError.set('Ocurrió un error inesperado. Inténtalo de nuevo.');
        }
      }
    });
  }
}
