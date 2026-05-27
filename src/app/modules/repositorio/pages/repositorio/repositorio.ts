import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../auth/services/auth.service';
import { Bloque, RepositorioService } from '../../services/repositorio.service';

import { Subscription } from 'rxjs';
import { CommunicationService, SistemaActualizadoEvent } from '../../../../core/services/communication.service';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

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

  // Carpetas Navigation
  historialCarpetas: {id: number | null, nombre: string}[] = [];
  creandoCarpeta = false;
  nombreNuevaCarpeta = '';

  // Drag and Drop
  documentoArrastrado: any = null;
  carpetaDestinoOverId: number | null | undefined = undefined;

  // Visor
  documentoAVisualizar: any = null;
  urlVisorSegura: SafeResourceUrl | null = null;
  tipoVisor: 'imagen' | 'iframe' | 'nativo' | null = null;

  // Real-time Sync
  private syncSub?: Subscription;

  constructor(
    private repoService: RepositorioService,
    private authService: AuthService,
    private communicationService: CommunicationService,
    private sanitizer: DomSanitizer
  ) {}

  get puedeEliminarRepositorio(): boolean {
    return !this.authService.isPracticante();
  }

  get puedeAprobarRepositorio(): boolean {
    return !this.authService.isPracticante();
  }

  ngOnInit() {
    this.cargarBloques();

    const token = this.authService.getToken();
    if (token) {
      this.communicationService.connect(token).catch(err => {
        console.error('Error conectando sockets en repositorio:', err);
      });
    }

    this.syncSub = this.communicationService.sistemaActualizado$.subscribe((event: SistemaActualizadoEvent) => {
      if (event.modulo === 'repositorio') {
        this.cargarBloques(true); // Recarga silenciosa
      }
    });
  }

  ngOnDestroy(): void {
    if (this.notificacionTimeout) {
      clearTimeout(this.notificacionTimeout);
    }
    if (this.syncSub) {
      this.syncSub.unsubscribe();
    }
  }

  cargarBloques(silencioso = false) {
    if (!silencioso) {
      this.cargando = true;
    }

    this.repoService.listar().subscribe({
      next: (data) => {
        this.bloques = (data || []).map((bloque) => this.mapearBloque(bloque));

        // Preserve selected block if it exists
        if (this.bloqueSeleccionado) {
          const updatedBlock = this.bloques.find(b => b.id === this.bloqueSeleccionado?.id);
          if (updatedBlock) {
            this.bloqueSeleccionado = updatedBlock;
          }
        }

        if (!silencioso) {
          this.cargando = false;
        }
      },
      error: (err) => {
        console.error('Error al listar bloques:', err);
        if (!silencioso) {
          this.cargando = false;
        }
        this.bloques = [];
        this.bloqueSeleccionado = null;
      },
    });
  }

  seleccionarBloque(bloque: Bloque) {
    this.bloqueSeleccionado = bloque;
    this.historialCarpetas = [{ id: null, nombre: 'Inicio' }];
    this.creandoCarpeta = false;
    this.nombreNuevaCarpeta = '';
  }

  get carpetaActualId(): number | null {
    if (this.historialCarpetas.length === 0) return null;
    return this.historialCarpetas[this.historialCarpetas.length - 1].id;
  }

  get elementosMostrados() {
    if (!this.bloqueSeleccionado) return [];
    
    // Si estamos en un bloque de redes sociales, no aplicamos lógica de carpetas
    if (this.esRedesSociales()) return this.bloqueSeleccionado.documentos;

    // Filtrar por carpeta actual
    let docs = this.bloqueSeleccionado.documentos.filter(d => 
      (d.padreId || null) === this.carpetaActualId
    );

    // Filtrar pendientes si es practicante
    if (this.authService.isPracticante()) {
      const currentUserId = this.authService.getCurrentUser()?.id;
      docs = docs.filter(d => d.esCarpeta || d.estado !== 'pendiente' || d.subidoPor === currentUserId);
    }

    return docs;
  }

  entrarCarpeta(doc: any) {
    if (doc.esCarpeta) {
      this.historialCarpetas.push({ id: doc.id || 0, nombre: doc.nombre });
    }
  }

  irACarpeta(index: number) {
    this.historialCarpetas = this.historialCarpetas.slice(0, index + 1);
  }

  toggleCrearCarpeta() {
    this.creandoCarpeta = !this.creandoCarpeta;
    this.nombreNuevaCarpeta = '';
  }

  // --- Drag and Drop Handlers ---
  onDragStart(event: DragEvent, doc: any) {
    this.documentoArrastrado = doc;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', doc.id.toString());
    }
  }

  onDragOver(event: DragEvent, carpetaDestinoId: number | null | undefined) {
    if (!this.documentoArrastrado) return;
    if (this.documentoArrastrado.id === carpetaDestinoId) return; // No mover a sí mismo
    if ((this.documentoArrastrado.padreId || null) === (carpetaDestinoId || null)) return; // Ya está aquí

    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    this.carpetaDestinoOverId = carpetaDestinoId;
  }

  onDragLeave(event: DragEvent) {
    this.carpetaDestinoOverId = undefined;
  }

  onDrop(event: DragEvent, carpetaDestinoId: number | null | undefined) {
    event.preventDefault();
    this.carpetaDestinoOverId = undefined;

    if (!this.documentoArrastrado) return;
    const doc = this.documentoArrastrado;
    this.documentoArrastrado = null;

    if (doc.id === carpetaDestinoId) return;
    if ((doc.padreId || null) === (carpetaDestinoId || null)) return;

    this.repoService.moverDocumento(doc.id, carpetaDestinoId || null, !!doc.esCarpeta).subscribe({
      next: () => {
        this.mostrarNotificacion('success', 'Elemento movido correctamente.');
        this.cargarBloques(); // Recargar todo para reflejar el estado real
      },
      error: (err) => {
        this.mostrarNotificacion('error', err?.error?.message || 'Error al mover elemento.');
      }
    });
  }
  // -----------------------------

  crearCarpeta() {
    if (!this.bloqueSeleccionado || !this.nombreNuevaCarpeta.trim()) return;

    this.repoService.crearCarpeta(
      this.bloqueSeleccionado.id, 
      this.nombreNuevaCarpeta.trim(), 
      this.carpetaActualId
    ).subscribe({
      next: () => {
        this.toggleCrearCarpeta();
        this.cargarBloques();
        this.mostrarNotificacion('success', 'Carpeta creada.');
      },
      error: (err) => {
        this.mostrarNotificacion('error', err?.error?.message || 'Error al crear carpeta.');
      }
    });
  }

  cerrarModal() {
    this.bloqueSeleccionado = null;
    this.archivoSeleccionado = null;
    this.nuevoNombre = '';
    this.nuevoLink = '';
  }

  abrirVisor(doc: any) {
    this.documentoAVisualizar = doc;
    const ext = this.obtenerExtension(doc.nombre).toLowerCase();
    
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
      this.tipoVisor = 'imagen';
      this.urlVisorSegura = this.sanitizer.bypassSecurityTrustResourceUrl(doc.url);
    } else if (['pdf', 'mp4', 'webm'].includes(ext)) {
      this.tipoVisor = 'nativo'; 
      this.urlVisorSegura = this.sanitizer.bypassSecurityTrustResourceUrl(doc.url);
    } else {
      const viewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(doc.url)}&embedded=true`;
      this.tipoVisor = 'iframe';
      this.urlVisorSegura = this.sanitizer.bypassSecurityTrustResourceUrl(viewerUrl);
    }
  }

  cerrarVisor() {
    this.documentoAVisualizar = null;
    this.urlVisorSegura = null;
    this.tipoVisor = null;
  }

  esRedesSociales(): boolean {
    return this.bloqueSeleccionado ? this.esBloqueRedes(this.bloqueSeleccionado) : false;
  }

  esBloqueRedes(bloque: Bloque): boolean {
    return bloque.titulo.toLowerCase().includes('redes');
  }

  obtenerExtension(nombre: string): string {
    const extension = nombre.split('.').pop()?.trim().toLowerCase();
    return extension && extension.length <= 5 ? extension : 'doc';
  }

  obtenerIconoPrime(nombre: string, esCarpeta: boolean = false): string {
    if (esCarpeta) return 'pi-folder folder-icon';
    
    const ext = this.obtenerExtension(nombre);
    switch (ext) {
      case 'pdf': return 'pi-file-pdf pdf-icon';
      case 'doc':
      case 'docx': return 'pi-file-word word-icon';
      case 'xls':
      case 'xlsx':
      case 'csv': return 'pi-file-excel excel-icon';
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'webp': return 'pi-image image-icon';
      case 'zip':
      case 'rar': return 'pi-box zip-icon';
      case 'mp4':
      case 'avi':
      case 'mkv': return 'pi-video video-icon';
      default: return 'pi-file generic-icon';
    }
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

  iconoRedSocial(url: string): string {
    const tipo = this.claseRedSocial(url);

    if (tipo === 'facebook') {
      return 'pi pi-facebook';
    }

    if (tipo === 'instagram') {
      return 'pi pi-instagram';
    }

    if (tipo === 'tiktok') {
      return 'pi pi-tiktok';
    }

    if (tipo === 'linkedin') {
      return 'pi pi-linkedin';
    }

    return 'pi pi-link';
  }

  isDragOverZone = false;

  onFileDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOverZone = true;
  }

  onFileDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOverZone = false;
  }

  onFileDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOverZone = false;

    if (event.dataTransfer && event.dataTransfer.files.length > 0) {
      this.archivoSeleccionado = event.dataTransfer.files[0];
      this.agregarDocumento(); // Autoupload when dropped
    }
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

    this.subiendo = true;

    this.repoService.subirDocumento(
      this.bloqueSeleccionado.id,
      this.archivoSeleccionado,
      this.carpetaActualId
    ).subscribe({
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

    this.repoService.agregarEnlace(bloqueId, nombre, url, this.carpetaActualId).subscribe({
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

  aprobarDocumento(doc: any, index: number) {
    if (!doc.id || !this.puedeAprobarRepositorio) return;
    this.repoService.cambiarEstado(doc.id, 'aprobado').subscribe({
      next: () => {
        doc.estado = 'aprobado';
        this.mostrarNotificacion('success', 'Documento aprobado correctamente.');
      },
      error: (err) => {
        this.mostrarNotificacion('error', err?.error?.message || 'Error al aprobar documento.');
      }
    });
  }

  rechazarDocumento(doc: any, index: number) {
    if (!doc.id || !this.puedeAprobarRepositorio) return;
    this.repoService.cambiarEstado(doc.id, 'rechazado').subscribe({
      next: () => {
        this.bloqueSeleccionado?.documentos.splice(index, 1);
        this.mostrarNotificacion('success', 'Documento rechazado y eliminado.');
      },
      error: (err) => {
        this.mostrarNotificacion('error', err?.error?.message || 'Error al rechazar documento.');
      }
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
        esCarpeta: documento.esCarpeta,
        padreId: documento.padreId,
        estado: documento.estado,
        subidoPor: documento.subidoPor,
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
