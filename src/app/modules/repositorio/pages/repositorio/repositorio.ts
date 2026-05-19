import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../auth/services/auth.service';
import { Bloque, RepositorioService } from '../../services/repositorio.service';

type TipoToast = 'success' | 'error';

@Component({
  selector: 'app-repositorio',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './repositorio.html',
  styleUrls: ['./repositorio.scss'],
})
export class Repositorio implements OnInit, OnDestroy {
  bloques: Bloque[] = [];
  bloqueSeleccionado: Bloque | null = null;
  archivoSeleccionado: File | null = null;
  cargando = false;
  subiendo = false;
  notificacionToast: { tipo: TipoToast; mensaje: string } | null = null;
  private notificacionTimeout: ReturnType<typeof setTimeout> | null = null;

  nuevoNombre = '';
  nuevoLink = '';

  constructor(
    private repoService: RepositorioService,
    private authService: AuthService,
  ) {}

  get puedeEliminarRepositorio(): boolean {
    return !this.authService.isPracticante();
  }

  ngOnInit() {
    this.cargarBloques();
  }

  ngOnDestroy(): void {
    if (this.notificacionTimeout) {
      clearTimeout(this.notificacionTimeout);
    }
  }

  cargarBloques() {
    this.cargando = true;

    this.repoService.listar().subscribe({
      next: (data) => {
        this.bloques = (data || []).map((bloque) => this.mapearBloque(bloque));

        if (this.bloqueSeleccionado) {
          this.bloqueSeleccionado =
            this.bloques.find((bloque) => bloque.id === this.bloqueSeleccionado?.id) ?? null;
        }

        this.cargando = false;
      },
      error: (err) => {
        console.error('Error al listar bloques:', err);
        this.bloques = [];
        this.bloqueSeleccionado = null;
        this.cargando = false;
      },
    });
  }

  seleccionarBloque(bloque: Bloque) {
    this.bloqueSeleccionado = bloque;
  }

  cerrarModal() {
    this.bloqueSeleccionado = null;
    this.archivoSeleccionado = null;
    this.nuevoNombre = '';
    this.nuevoLink = '';
  }

  esRedesSociales(): boolean {
    return this.bloqueSeleccionado ? this.esBloqueRedes(this.bloqueSeleccionado) : false;
  }

  esBloqueRedes(bloque: Bloque): boolean {
    return bloque.titulo.toLowerCase().includes('redes');
  }

  obtenerExtension(nombre: string): string {
    const extension = nombre.split('.').pop()?.trim().toUpperCase();
    return extension && extension.length <= 5 ? extension : 'DOC';
  }

  obtenerNombreArchivo(url: string): string {
    const limpio = url.split('?')[0];
    const nombre = limpio.split('/').pop();
    return nombre ? decodeURIComponent(nombre) : 'Documento almacenado';
  }

  obtenerDominio(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  }

  claseRedSocial(url: string): string {
    const normalizedUrl = url.toLowerCase();

    if (normalizedUrl.includes('facebook')) {
      return 'facebook';
    }

    if (normalizedUrl.includes('instagram')) {
      return 'instagram';
    }

    if (normalizedUrl.includes('tiktok')) {
      return 'tiktok';
    }

    if (normalizedUrl.includes('linkedin')) {
      return 'linkedin';
    }

    return 'web';
  }

  etiquetaRedSocial(url: string): string {
    const tipo = this.claseRedSocial(url);

    if (tipo === 'facebook') {
      return 'f';
    }

    if (tipo === 'instagram') {
      return 'IG';
    }

    if (tipo === 'tiktok') {
      return 'TK';
    }

    if (tipo === 'linkedin') {
      return 'in';
    }

    return 'www';
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    this.archivoSeleccionado = file;
  }

  agregarDocumento() {
    if (!this.bloqueSeleccionado) {
      this.mostrarNotificacion('error', 'Selecciona una carpeta.');
      return;
    }

    if (!this.archivoSeleccionado) {
      this.mostrarNotificacion('error', 'Selecciona un archivo primero.');
      return;
    }

    const formData = new FormData();
    formData.append('file', this.archivoSeleccionado);
    formData.append('bloqueId', this.bloqueSeleccionado.id.toString());

    this.subiendo = true;

    this.repoService.subirArchivo(formData).subscribe({
      next: () => {
        this.archivoSeleccionado = null;
        this.subiendo = false;
        this.cargarBloques();
        this.mostrarNotificacion('success', 'Documento agregado correctamente.');
      },
      error: (err) => {
        console.error('Error al subir:', err);
        this.subiendo = false;
        this.mostrarNotificacion('error', err?.error?.message || 'Error al subir documento.');
      },
    });
  }

  agregarRedSocial() {
    if (!this.bloqueSeleccionado || !this.nuevoLink) {
      this.mostrarNotificacion('error', 'Completa el enlace de la red social.');
      return;
    }

    const bloqueId = this.bloqueSeleccionado.id;
    const nombre = this.nuevoNombre.trim() || 'Fundacion Calma';
    const url = this.nuevoLink.trim();

    this.repoService.agregarEnlace(bloqueId, nombre, url).subscribe({
      next: () => {
        this.nuevoNombre = '';
        this.nuevoLink = '';
        this.cargarBloques();
        this.mostrarNotificacion('success', 'Red social agregada correctamente.');
      },
      error: (err) => {
        console.error('Error al agregar red social:', err);
        this.mostrarNotificacion('error', err?.error?.message || 'Error al agregar red social.');
      },
    });
  }

  eliminarDocumento(index: number) {
    if (!this.puedeEliminarRepositorio) {
      this.mostrarNotificacion('error', 'Los practicantes no pueden eliminar archivos ni enlaces.');
      return;
    }

    if (!this.bloqueSeleccionado) {
      return;
    }

    const documento = this.bloqueSeleccionado.documentos[index];

    if (!documento?.id) {
      this.bloqueSeleccionado.documentos.splice(index, 1);
      this.mostrarNotificacion('success', 'Elemento eliminado correctamente.');
      return;
    }

    this.repoService.eliminar(documento.id).subscribe({
      next: () => {
        this.bloqueSeleccionado?.documentos.splice(index, 1);
        this.mostrarNotificacion('success', 'Documento eliminado correctamente.');
      },
      error: (err) => {
        console.error('Error al eliminar:', err);
        this.mostrarNotificacion('error', err?.error?.message || 'Error al eliminar documento.');
      },
    });
  }

  eliminarRed(index: number) {
    this.eliminarDocumento(index);
  }

  private mapearBloque(bloque: Bloque): Bloque {
    return {
      id: bloque.id,
      titulo: bloque.titulo,
      subtitulo: bloque.subtitulo,
      icono: bloque.icono || '📁',
      documentos: (bloque.documentos || []).map((documento) => ({
        id: documento.id,
        nombre: documento.nombre,
        url: documento.url,
        icono: documento.icono,
        fecha: documento.fecha,
      })),
    };
  }

  mostrarNotificacion(tipo: TipoToast, mensaje: string): void {
    if (this.notificacionTimeout) {
      clearTimeout(this.notificacionTimeout);
    }

    this.notificacionToast = { tipo, mensaje };
    this.notificacionTimeout = setTimeout(() => {
      this.notificacionToast = null;
      this.notificacionTimeout = null;
    }, 3500);
  }

  cerrarNotificacion(): void {
    if (this.notificacionTimeout) {
      clearTimeout(this.notificacionTimeout);
      this.notificacionTimeout = null;
    }

    this.notificacionToast = null;
  }
}
