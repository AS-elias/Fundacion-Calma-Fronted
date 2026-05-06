import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { Router } from '@angular/router'
import { FormsModule } from '@angular/forms'; 
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, InputTextModule, PasswordModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  email = '';
  password = '';

  onLogin() {
    if (!this.email || !this.password) {
      alert('Por favor, ingresa tu correo y contraseña');
      return;
    }

    console.log("🔄 Intentando login...");
    
    this.authService.login(this.email, this.password).subscribe({
      next: (respuesta) => {
        console.log("✅ Respuesta del backend:", respuesta);
        
        const rol = respuesta.usuario?.rol;
        console.log("🎯 Rol detectado:", rol);
        
        // Redirigir según el rol usando los métodos del AuthService
        if (this.authService.isAdmin() || this.authService.isDirector()) {
          console.log("👑 Redirigiendo a /dashboard/admin-dashboard");
          this.router.navigate(['/dashboard/admin-dashboard']).then(success => {
            console.log("✅ Navegación exitosa:", success);
          });
        } else {
          console.log("👤 Redirigiendo a /dashboard/usuario-dashboard");
          this.router.navigate(['/dashboard/usuario-dashboard']).then(success => {
            console.log("✅ Navegación exitosa:", success);
          });
        }
      },
      error: (error) => {
        console.error("❌ Error:", error);
        if (error.status === 0) {
          alert('❌ No se puede conectar al backend');
        } else if (error.status === 401) {
          alert('❌ Credenciales incorrectas');
        } else {
          alert(`❌ Error ${error.status}`);
        }
      }
    });
  }
}
