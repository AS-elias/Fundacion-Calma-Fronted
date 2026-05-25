import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../../../auth/services/auth.service';
import {
  Notificacion,
  NotificacionesService,
  TipoNotificacion,
} from '../../services/notificaciones.service';

type TipoToast = 'success' | 'error';
type FiltroNotificaciones = TipoNotificacion | 'favoritos';

@Component({
  selector: 'app-notificaciones',
  standalone: true,
  imports: [CommonModule, HttpClientModule, FormsModule],
  templateUrl: './notificaciones.html',
  styleUrls: ['./notificaciones.scss'],
})
export class Notificaciones implements OnInit, OnDestroy {
  private service = inject(NotificacionesService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private notificacionTimeout: ReturnType<typeof setTimeout> | null = null;

  mostrarConfirmacion = false;
  idAEliminar: number | null = null;
  filtroSeleccionado: FiltroNotificaciones = 'comunicados';
  filtroAntesFavoritos: TipoNotificacion = 'comunicados';
  fechaDesde = '';
  fechaHasta = '';
  mostrarFiltroFecha = false;
  notificacionToast: { tipo: TipoToast; mensaje: string } | null = null;

  notificaciones: Notificacion[] = [];
  notificacionSeleccionada: Notificacion | null = null;

  mostrarFormulario = false;
  archivoImagen: File | null = null;
  guardando = false;

  form = {
    titulo: '',
    mensaje: '',
    enlace: '',
    firma: 'Fundacion Calma',
    tipo: 'comunicados' as TipoNotificacion,
    imagen: null as string | null,
  };

  ngOnInit() {
    this.cargarNotificaciones();
  }

  ngOnDestroy(): void {
    if (this.notificacionTimeout) {
      clearTimeout(this.notificacionTimeout);
    }
  }

  cargarNotificaciones(): void {
    this.service.listar().subscribe({
      next: (data) => {
        this.notificaciones = data;
      },
      error: (err) => console.error('Error al cargar notificaciones:', err),
    });
  }

  get cantidadNoLeidas(): number {
    return this.notificaciones.filter((n) => !n.leido).length;
  }

  get notificacionesFiltradas(): Notificacion[] {
    const dentroDeFechas = (n: Notificacion) => this.cumpleFiltroFecha(n);

    if (this.filtroSeleccionado === 'favoritos') {
      return this.notificaciones.filter((n) =>
        n.favorito && dentroDeFechas(n),
      );
    }

    return this.notificaciones.filter((n) =>
      n.tipo === this.filtroSeleccionado && dentroDeFechas(n),
    );
  }

  get puedeCrearNotificacion(): boolean {
    return this.authService.isAdmin() || this.authService.isDirector();
  }

  cambiarFiltro(filtro: FiltroNotificaciones): void {
    if (filtro === 'favoritos') {
      if (this.filtroSeleccionado === 'favoritos') {
        this.filtroSeleccionado = this.filtroAntesFavoritos;
        return;
      }

      this.filtroAntesFavoritos = this.filtroSeleccionado;
    }

    this.filtroSeleccionado = filtro;

    if (filtro !== 'favoritos') {
      this.filtroAntesFavoritos = filtro;
    }
  }

  limpiarFiltroFecha(): void {
    this.fechaDesde = '';
    this.fechaHasta = '';
    this.mostrarFiltroFecha = false;
  }

  toggleFiltroFecha(): void {
    this.mostrarFiltroFecha = !this.mostrarFiltroFecha;
  }

  abrirDetalle(n: Notificacion): void {
    this.notificacionSeleccionada = n;

    if (!n.leido) {
      this.service.marcarLeido(n.id, true).subscribe({
        next: () => {
          this.notificaciones = this.notificaciones.map((item) =>
            item.id === n.id ? { ...item, leido: true } : item,
          );
          this.service.notificarCambio();
        },
        error: (err) => console.error(err),
      });
    }
  }

  cerrarModal(): void {
    this.notificacionSeleccionada = null;
  }

  toggleLeido(n: Notificacion): void {
    const nuevoEstado = !n.leido;

    this.service.marcarLeido(n.id, nuevoEstado).subscribe({
      next: () => {
        this.notificaciones = this.notificaciones.map((item) =>
          item.id === n.id ? { ...item, leido: nuevoEstado } : item,
        );
        this.service.notificarCambio();
      },
      error: (err) => console.error(err),
    });
  }

  toggleFavorito(n: Notificacion, event?: Event): void {
    event?.stopPropagation();
    const nuevoEstado = !n.favorito;

    this.notificaciones = this.notificaciones.map((item) =>
      item.id === n.id ? { ...item, favorito: nuevoEstado } : item,
    );

    this.service.marcarFavorito(n.id, nuevoEstado).subscribe({
      next: () => this.service.notificarCambio(),
      error: (err) => {
        console.error(err);
        this.notificaciones = this.notificaciones.map((item) =>
          item.id === n.id ? { ...item, favorito: !nuevoEstado } : item,
        );
        this.mostrarNotificacion('error', 'No se pudo actualizar favorito.');
      },
    });
  }

  eliminarNotificacion(id: number): void {
    this.service.eliminar(id).subscribe({
      next: () => {
        this.notificaciones = this.notificaciones.filter((n) => n.id !== id);
        this.service.notificarCambio();
        this.mostrarNotificacion('success', 'Notificacion eliminada.');
      },
      error: (err) => {
        console.error(err);
        this.mostrarNotificacion('error', err?.error?.message || 'Error al eliminar la notificacion.');
      },
    });
  }

  toggleFormulario(): void {
    if (!this.puedeCrearNotificacion) {
      this.mostrarNotificacion('error', 'Solo el administrador o director pueden crear notificaciones.');
      return;
    }

    this.mostrarFormulario = !this.mostrarFormulario;

    if (this.mostrarFormulario) {
      this.form = {
        titulo: '',
        mensaje: '',
        enlace: '',
        firma: 'Fundacion Calma',
        tipo: 'comunicados',
        imagen: null,
      };

      this.archivoImagen = null;
      this.guardando = false;
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    this.archivoImagen = file;
    this.form.imagen = file.name;
    input.value = '';
  }

  guardarNotificacion(): void {
    if (!this.puedeCrearNotificacion) {
      this.mostrarNotificacion('error', 'Solo el administrador o director pueden crear notificaciones.');
      return;
    }

    if (!this.form.titulo.trim() || !this.form.mensaje.trim()) {
      this.mostrarNotificacion('error', 'Completa título y descripción.');
      return;
    }

    const formData = new FormData();
    formData.append('titulo', this.form.titulo.trim());
    formData.append('mensaje', this.construirMensaje());
    formData.append('tipo', 'comunicados');

    if (this.archivoImagen) {
      formData.append('imagen', this.archivoImagen);
    }

    this.guardando = true;

    this.service.crear(formData).subscribe({
      next: () => {
        this.cargarNotificaciones();
        this.service.notificarCambio();
        this.form = {
          titulo: '',
          mensaje: '',
          enlace: '',
          firma: 'Fundacion Calma',
          tipo: 'comunicados',
          imagen: null,
        };
        this.archivoImagen = null;
        this.mostrarFormulario = false;
        this.guardando = false;
        this.mostrarNotificacion('success', 'Notificacion creada correctamente.');
      },
      error: (err) => {
        console.error('Error al crear notificacion:', err);
        this.guardando = false;
        this.mostrarNotificacion('error', err?.error?.message || 'Error al publicar notificacion.');
      },
    });
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

  abrirConfirmacion(id: number, event: Event): void {
    event.stopPropagation();
    this.idAEliminar = id;
    this.mostrarConfirmacion = true;
  }

  cancelarEliminar(): void {
    this.mostrarConfirmacion = false;
    this.idAEliminar = null;
  }

  confirmarEliminar(): void {
    if (this.idAEliminar !== null) {
      this.eliminarNotificacion(this.idAEliminar);
    }

    this.cancelarEliminar();
  }

  mensajePrincipal(n: Notificacion | null): string {
    if (!n?.mensaje) {
      return '';
    }

    return n.mensaje
      .split('\n')
      .filter((linea) =>
        !this.esLineaFirma(linea)
        && !this.esLineaEnlace(linea)
        && !this.esLineaSistema(linea)
        && !this.esLineaCambios(linea)
      )
      .join('\n')
      .trim();
  }

  cambiosSistema(n: Notificacion | null): string[] {
    if (!this.esSistema(n) || !n?.mensaje) {
      return [];
    }

    const lineas = n.mensaje.split('\n').map((linea) => linea.trim());
    const indice = lineas.findIndex((linea) => /^Cambios realizados:\s*$/i.test(linea));

    if (indice === -1) {
      return [];
    }

    return lineas
      .slice(indice + 1)
      .filter((linea) => linea.startsWith('- '))
      .map((linea) => linea.replace(/^-\s*/, '').trim())
      .filter(Boolean);
  }

  firmaNotificacion(n: Notificacion | null): string | null {
    const linea = this.obtenerLinea(n, (value) => this.esLineaFirma(value));
    return linea ? linea.replace(/^Atte\.?\s*/i, '').trim() : null;
  }

  enlaceNotificacion(n: Notificacion | null): string | null {
    const linea = this.obtenerLinea(n, (value) => this.esLineaEnlace(value));
    const enlace = linea
      ? linea.replace(/^Enlace:\s*/i, '').trim()
      : this.extraerUrl(n?.mensaje ?? '');

    return enlace || null;
  }

  resumenMensaje(n: Notificacion): string {
    const mensaje = this.mensajePrincipal(n);
    return mensaje.length > 180 ? `${mensaje.slice(0, 180).trim()}...` : mensaje;
  }

  esSistema(n: Notificacion | null): boolean {
    return n?.tipo === 'sistema';
  }

  apartadoSistema(n: Notificacion | null): string {
    const apartado = this.valorSistema(n, 'Apartado');

    if (apartado) {
      return apartado;
    }

    const texto = `${n?.titulo ?? ''} ${n?.mensaje ?? ''}`.toLowerCase();

    if (texto.includes('convenio')) {
      return 'Convenios';
    }

    if (texto.includes('actividad') || texto.includes('tarea')) {
      return 'Actividades';
    }

    if (texto.includes('archivo') || texto.includes('documento') || texto.includes('repositorio')) {
      return 'Repositorio';
    }

    if (texto.includes('usuario')) {
      return 'Usuarios';
    }

    return 'Sistema';
  }

  accionSistema(n: Notificacion | null): string {
    return this.valorSistema(n, 'Accion') ?? this.inferirAccionSistema(n);
  }

  usuarioSistema(n: Notificacion | null): string | null {
    return this.valorSistema(n, 'Usuario');
  }

  origenSistema(n: Notificacion | null): string {
    return this.valorSistema(n, 'Origen') ?? 'Accion del sistema';
  }

  rutaSistema(n: Notificacion | null): string | null {
    return this.valorSistema(n, 'Ruta') ?? this.inferirRutaSistema(n);
  }

  textoBotonSistema(n: Notificacion | null): string {
    const apartado = this.apartadoSistema(n);
    return apartado && apartado !== 'Sistema' ? `Ir a ${apartado}` : 'Ir al apartado';
  }

  navegarSistema(n: Notificacion | null): void {
    const ruta = this.rutaSistema(n);

    if (!ruta) {
      return;
    }

    this.cerrarModal();
    void this.router.navigateByUrl(ruta);
  }

  private construirMensaje(): string {
    const partes = [this.form.mensaje.trim()];
    const firma = this.form.firma.trim();
    const enlace = this.normalizarUrl(this.form.enlace.trim());

    if (firma) {
      partes.push(`Atte. ${firma}`);
    }

    if (enlace) {
      partes.push(`Enlace: ${enlace}`);
    }

    return partes.join('\n\n');
  }

  private normalizarUrl(url: string): string {
    if (!url) {
      return '';
    }

    return /^https?:\/\//i.test(url) ? url : `https://${url}`;
  }

  private obtenerLinea(
    n: Notificacion | null,
    predicate: (linea: string) => boolean,
  ): string | null {
    return n?.mensaje?.split('\n').find((linea) => predicate(linea.trim())) ?? null;
  }

  private esLineaFirma(linea: string): boolean {
    return /^Atte\.?\s+/i.test(linea.trim());
  }

  private esLineaEnlace(linea: string): boolean {
    const value = linea.trim();
    return /^Enlace:\s*/i.test(value) || /^https?:\/\/\S+$/i.test(value);
  }

  private esLineaSistema(linea: string): boolean {
    return /^(Apartado|Accion|Ruta|Usuario|Origen):\s*/i.test(linea.trim());
  }

  private esLineaCambios(linea: string): boolean {
    const value = linea.trim();
    return /^Cambios realizados:\s*$/i.test(value) || /^-\s+/.test(value);
  }

  private extraerUrl(texto: string): string | null {
    return texto.match(/https?:\/\/\S+/i)?.[0] ?? null;
  }

  private valorSistema(n: Notificacion | null, clave: string): string | null {
    const linea = this.obtenerLinea(n, (value) =>
      new RegExp(`^${clave}:\\s*`, 'i').test(value),
    );

    return linea ? linea.replace(new RegExp(`^${clave}:\\s*`, 'i'), '').trim() : null;
  }

  private inferirAccionSistema(n: Notificacion | null): string {
    const texto = `${n?.titulo ?? ''} ${n?.mensaje ?? ''}`.toLowerCase();

    if (texto.includes('elimin')) {
      return 'Eliminación';
    }

    if (texto.includes('agreg') || texto.includes('cre')) {
      return 'Creación';
    }

    if (texto.includes('venc')) {
      return 'Aviso automatico';
    }

    return 'Evento del sistema';
  }

  private inferirRutaSistema(n: Notificacion | null): string | null {
    const apartado = this.apartadoSistema(n).toLowerCase();

    if (apartado.includes('convenio') || apartado.includes('desarrollo')) {
      return '/dashboard/director-dashboard/desarrollo-comercial';
    }

    if (apartado.includes('estrategia')) {
      return '/dashboard/director-dashboard/estrategia-comercial';
    }

    if (apartado.includes('analisis') || apartado.includes('análisis')) {
      return '/dashboard/director-dashboard/analisis-datos';
    }

    if (apartado.includes('repositorio')) {
      return '/repositorio';
    }

    if (apartado.includes('usuario')) {
      return '/dashboard/admin-dashboard/usuarios';
    }

    return null;
  }

  private cumpleFiltroFecha(n: Notificacion): boolean {
    if (!this.fechaDesde && !this.fechaHasta) {
      return true;
    }

    if (!n.creado_at) {
      return false;
    }

    const fechaNotificacion = new Date(n.creado_at);

    if (Number.isNaN(fechaNotificacion.getTime())) {
      return false;
    }

    const desde = this.fechaDesde ? this.inicioDia(this.fechaDesde) : null;
    const hasta = this.fechaHasta ? this.finDia(this.fechaHasta) : null;

    if (desde && fechaNotificacion < desde) {
      return false;
    }

    if (hasta && fechaNotificacion > hasta) {
      return false;
    }

    return true;
  }

  private inicioDia(fecha: string): Date {
    const value = new Date(`${fecha}T00:00:00`);
    value.setHours(0, 0, 0, 0);
    return value;
  }

  private finDia(fecha: string): Date {
    const value = new Date(`${fecha}T23:59:59`);
    value.setHours(23, 59, 59, 999);
    return value;
  }
}
