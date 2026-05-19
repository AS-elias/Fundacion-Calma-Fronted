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
  });

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

  private poblarFormulario(usuario: any): void {
    this.form.patchValue({
      nombre_completo: usuario?.nombre_completo ?? '',
      apellido_completo: usuario?.apellido_completo ?? '',
      telefono: usuario?.telefono ?? '',
      puesto: usuario?.puesto ?? '',
    });
  }

  private normalizarArchivoUrl(url: string | null | undefined): string | null {
    if (!url || /^https?:\/\//i.test(url) || url.startsWith('blob:') || url.startsWith('data:')) {
      return url ?? null;
    }

    return `http://localhost:3005${url.startsWith('/') ? url : `/${url}`}`;
  }
}
