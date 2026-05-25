import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../auth/services/auth.service';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './perfil.component.html',
  styleUrls: ['./perfil.component.scss'],
})
export class PerfilComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly apiUrl = 'http://localhost:3005/api/auth/me';

  cargando = true;
  editando = false;
  guardando = false;
  mensaje: { tipo: 'ok' | 'error'; texto: string } | null = null;
  usuario: any = null;
  fotoSeleccionada: File | null = null;
  fotoPreview: string | null = null;

  form = this.fb.group({
    nombre_completo: ['', [Validators.required, Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)]],
    apellido_completo: ['', [Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)]],
    telefono: ['', [Validators.pattern(/^\d{0,20}$/)]],
    puesto: ['', [Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]*$/)]],
    fecha_nacimiento: [''],
    linkedin_url: ['', [Validators.pattern(/^(https?:\/\/)?(www\.)?linkedin\.com\/.*$/i)]],
    biografia: ['', [Validators.maxLength(300)]],
  });

  cambiandoClave = false;
  guardandoClave = false;
  mensajeClave: { tipo: 'ok' | 'error'; texto: string } | null = null;
  cambiarClaveForm = this.fb.group({
    actual: ['', Validators.required],
    nueva: ['', [Validators.required, Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)]],
    confirmar: ['', Validators.required]
  });

  get fClave() { return this.cambiarClaveForm.controls; }

  hasUppercase(str: string): boolean { return /[A-Z]/.test(str); }
  hasLowercase(str: string): boolean { return /[a-z]/.test(str); }
  hasNumber(str: string): boolean { return /\d/.test(str); }
  hasSymbol(str: string): boolean { return /[@$!%*?&]/.test(str); }

  ngOnInit(): void {
    this.cargarPerfil();
  }

  get iniciales(): string {
    const nombre = this.usuario?.nombre_completo || 'Usuario';
    const apellido = this.usuario?.apellido_completo || '';
    return `${nombre.charAt(0)}${apellido.charAt(0) || ''}`.toUpperCase();
  }

  get fotoPerfil(): string | null {
    return this.fotoPreview || this.normalizarArchivoUrl(this.usuario?.foto_url);
  }

  get rol(): string {
    return this.usuario?.rol?.nombre || this.usuario?.roles?.nombre || 'Usuario';
  }

  cargarPerfil(): void {
    this.cargando = true;

    this.http.get<any>(this.apiUrl, { headers: this.authService.getAuthHeaders() }).subscribe({
      next: (usuario) => {
        this.usuario = usuario;
        this.poblarFormulario(usuario);
        this.cargando = false;
      },
      error: () => {
        this.mensaje = { tipo: 'error', texto: 'No se pudo cargar tu perfil.' };
        this.cargando = false;
      },
    });
  }

  activarEdicion(): void {
    this.editando = true;
    this.mensaje = null;
    this.fotoSeleccionada = null;
    this.fotoPreview = null;
    this.poblarFormulario(this.usuario);
  }

  cancelarEdicion(): void {
    this.editando = false;
    this.guardando = false;
    this.mensaje = null;
    this.fotoSeleccionada = null;
    this.fotoPreview = null;
    this.poblarFormulario(this.usuario);
  }

  seleccionarFoto(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    this.fotoSeleccionada = file;
    this.fotoPreview = URL.createObjectURL(file);
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.guardando = true;
    this.mensaje = null;

    const formData = new FormData();
    const values = this.form.value;
    formData.append('nombre_completo', values.nombre_completo ?? '');
    formData.append('apellido_completo', values.apellido_completo ?? '');
    formData.append('telefono', values.telefono ?? '');
    formData.append('puesto', values.puesto ?? '');
    formData.append('biografia', values.biografia ?? '');
    formData.append('linkedin_url', values.linkedin_url ?? '');
    if (values.fecha_nacimiento) {
      formData.append('fecha_nacimiento', values.fecha_nacimiento);
    }

    if (this.fotoSeleccionada) {
      formData.append('foto', this.fotoSeleccionada);
    }

    this.http.patch<any>(this.apiUrl, formData, {
      headers: this.authService.getAuthHeadersWithoutContentType(),
    }).subscribe({
      next: (usuario) => {
        this.usuario = usuario;
        this.authService.updateCurrentUser({
          nombre: usuario.nombre_completo,
          apellido: usuario.apellido_completo,
          email: usuario.email,
          foto_url: usuario.foto_url,
          rol: this.rol,
        });
        this.mensaje = { tipo: 'ok', texto: 'Perfil actualizado correctamente.' };
        this.guardando = false;
        this.editando = false;
        this.fotoSeleccionada = null;
        this.fotoPreview = null;
      },
      error: () => {
        this.mensaje = { tipo: 'error', texto: 'No se pudo guardar tu perfil.' };
        this.guardando = false;
      },
    });
  }

  iniciarCambioClave(): void {
    this.cambiandoClave = true;
    this.mensajeClave = null;
    this.cambiarClaveForm.reset();
  }

  cancelarCambioClave(): void {
    this.cambiandoClave = false;
    this.mensajeClave = null;
    this.cambiarClaveForm.reset();
  }

  guardarNuevaClave(): void {
    if (this.cambiarClaveForm.invalid) {
      this.cambiarClaveForm.markAllAsTouched();
      return;
    }

    const val = this.cambiarClaveForm.value;
    if (val.nueva !== val.confirmar) {
      this.mensajeClave = { tipo: 'error', texto: 'La nueva contraseña y su confirmación no coinciden.' };
      return;
    }

    this.guardandoClave = true;
    this.mensajeClave = null;

    // Aquí se reutiliza el changePassword del authService pero usando la contraseña actual como tempPassword
    this.authService.changePassword(this.usuario.email, val.actual!, val.nueva!).subscribe({
      next: () => {
        this.guardandoClave = false;
        this.cambiandoClave = false;
        this.mensaje = { tipo: 'ok', texto: 'Tu contraseña ha sido cambiada exitosamente.' };
      },
      error: (err) => {
        this.guardandoClave = false;
        if (err.status === 401 || err.status === 403 || err.status === 400) {
          this.mensajeClave = { tipo: 'error', texto: 'La contraseña actual ingresada es incorrecta.' };
        } else {
          this.mensajeClave = { tipo: 'error', texto: 'Hubo un error al intentar cambiar la contraseña.' };
        }
      }
    });
  }

  private formatFecha(fechaStr?: string): string {
    if (!fechaStr) return '';
    // If it's a full ISO string, return YYYY-MM-DD
    if (fechaStr.includes('T')) {
      return fechaStr.split('T')[0];
    }
    return fechaStr;
  }

  private poblarFormulario(usuario: any): void {
    this.form.patchValue({
      nombre_completo: usuario?.nombre_completo ?? '',
      apellido_completo: usuario?.apellido_completo ?? '',
      telefono: usuario?.telefono ?? '',
      puesto: usuario?.puesto ?? '',
      biografia: usuario?.biografia ?? '',
      linkedin_url: usuario?.linkedin_url ?? '',
      fecha_nacimiento: this.formatFecha(usuario?.fecha_nacimiento),
    });
  }

  private normalizarArchivoUrl(url: string | null | undefined): string | null {
    if (!url || /^https?:\/\//i.test(url) || url.startsWith('blob:') || url.startsWith('data:')) {
      return url ?? null;
    }

    return `http://localhost:3005${url.startsWith('/') ? url : `/${url}`}`;
  }
}
