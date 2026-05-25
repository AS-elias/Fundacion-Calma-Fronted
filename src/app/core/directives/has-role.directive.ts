import { Directive, Input, TemplateRef, ViewContainerRef, inject } from '@angular/core';
import { AuthService } from '../../modules/auth/services/auth.service';

@Directive({
  selector: '[appHasRole]',
  standalone: true
})
export class HasRoleDirective {
  private authService = inject(AuthService);
  private templateRef = inject(TemplateRef);
  private viewContainer = inject(ViewContainerRef);
  private isHidden = true;

  @Input() set appHasRole(rolesPermitidos: string[]) {
    // Si no se pasaron roles o el arreglo está vacío, ocultamos por defecto
    if (!rolesPermitidos || !rolesPermitidos.length) {
      this.ocultar();
      return;
    }

    const usuario = this.authService.getCurrentUser();
    
    // Extraer el rol real del usuario actual
    let rolUsuario = '';
    if (usuario && usuario.rol) {
      const rol = usuario.rol as any;
      rolUsuario = typeof rol === 'string' ? rol : rol.nombre;
    }
    
    if (rolUsuario) {
        rolUsuario = rolUsuario.toLowerCase();
    }

    // Verificar si el rol del usuario está dentro de los permitidos
    const tienePermiso = rolesPermitidos.some(rol => rol.toLowerCase() === rolUsuario);

    if (tienePermiso && this.isHidden) {
      this.mostrar();
    } else if (!tienePermiso && !this.isHidden) {
      this.ocultar();
    }
  }

  private mostrar(): void {
    this.viewContainer.createEmbeddedView(this.templateRef);
    this.isHidden = false;
  }

  private ocultar(): void {
    this.viewContainer.clear();
    this.isHidden = true;
  }
}
