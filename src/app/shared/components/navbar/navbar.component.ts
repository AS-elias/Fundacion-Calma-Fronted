import {
  Component,
  ChangeDetectionStrategy,
  signal,
  inject,
  OnInit,
  HostListener,
  OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { interval, Subscription } from 'rxjs';
import { Router } from '@angular/router';

import { AuthService } from '../../../modules/auth/services/auth.service';
import { NavbarSearchService } from '../../services/navbar-search.service';
import {
  NotificacionesService,
  Notificacion
} from '../../../modules/notificaciones/services/notificaciones.service';
import { LayoutService } from '../../services/layout.service';
import { CommunicationService } from '../../../core/services/communication.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavbarComponent implements OnInit, OnDestroy {

  isDarkMode = signal(false);

  private authService = inject(AuthService);
  private notifService = inject(NotificacionesService);
  private router = inject(Router);
  private navbarSearchService = inject(NavbarSearchService);
  public layoutService = inject(LayoutService);
  private commService = inject(CommunicationService);

  nombreUsuario = signal<string>('Usuario');
  rolUsuario = signal<string>('Rol Desconocido');
  inicialesUsuario = signal<string>('U');
  fotoUsuario = signal<string | null>(null);

  notificaciones = signal<Notificacion[]>([]);
  mostrarDropdown = signal(false);

  notificacionSeleccionada: Notificacion | null = null;
  private cambiosSub?: Subscription;
  private pollingSub?: Subscription;
  private commSub?: Subscription;

  private IDsConocidos = new Set<number>();
  notificacionToast = signal<Notificacion | null>(null);
  campanaAnimada = signal<boolean>(false);
  private toastTimeout: ReturnType<typeof setTimeout> | null = null;

  ngOnInit() {
    this.inicializarTema();
    this.cargarDatosUsuario();
    this.cargarNotificaciones();
    this.cambiosSub = this.notifService.cambios$.subscribe(() => {
      this.cargarNotificaciones();
    });
    this.pollingSub = interval(5000).subscribe(() => {
      this.cargarNotificaciones();
    });
    this.commSub = this.commService.sistemaActualizado$.subscribe(() => {
      this.cargarNotificaciones();
    });
  }

  onSearchInput(event: Event) {
    const input = event.target as HTMLInputElement;
    this.navbarSearchService.setSearchQuery(input.value);
  }

  ngOnDestroy() {
    this.cambiosSub?.unsubscribe();
    this.pollingSub?.unsubscribe();
    this.commSub?.unsubscribe();
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }
  }

  cargarDatosUsuario() {
    const user = this.authService.getCurrentUser();

    if (user) {
      const nombreCompleto = user.nombre || 'Usuario';

      this.nombreUsuario.set(nombreCompleto);
      this.rolUsuario.set(user.rol || 'Usuario');
      this.fotoUsuario.set(this.normalizarArchivoUrl(user.foto_url ?? user.fotoUrl ?? null));

      let iniciales = nombreCompleto.charAt(0).toUpperCase();

      if ((user as any).apellido) {
        iniciales += (user as any).apellido.charAt(0).toUpperCase();
      } else {
        const partes = nombreCompleto.split(' ');
        if (partes.length > 1) {
          iniciales += partes[1].charAt(0).toUpperCase();
        }
      }

      this.inicialesUsuario.set(iniciales);
    }
  }

  private normalizarArchivoUrl(url: string | null | undefined): string | null {
    if (!url) {
      return null;
    }

    if (/^https?:\/\//i.test(url) || url.startsWith('data:') || url.startsWith('blob:')) {
      return url;
    }

    return `https://fundacion-calma-backend.onrender.com${url.startsWith('/') ? url : `/${url}`}`;
  }

  cargarNotificaciones() {
    this.notifService.listar().subscribe({
      next: (data: Notificacion[]) => {
        // Detectar nuevas notificaciones no leídas
        if (this.IDsConocidos.size > 0) {
          const nuevas = data.filter(n => !n.leido && !this.IDsConocidos.has(n.id));
          if (nuevas.length > 0) {
            const masReciente = nuevas.reduce((prev, curr) => (curr.id > prev.id ? curr : prev), nuevas[0]);
            this.mostrarBurbujaToast(masReciente);
          }
        } else {
          // Primera carga: si hay notificaciones sin leer, mostrar la más reciente de inmediato
          const pendientes = data.filter(n => !n.leido);
          if (pendientes.length > 0) {
            const masReciente = pendientes.reduce((prev, curr) => (curr.id > prev.id ? curr : prev), pendientes[0]);
            // Esperar un momento corto (e.g. 500ms) para que la página renderice completamente antes del toast
            setTimeout(() => {
              this.mostrarBurbujaToast(masReciente);
            }, 500);
          }
        }

        // Registrar IDs conocidos
        data.forEach(n => this.IDsConocidos.add(n.id));
        this.notificaciones.set(data);
      },
      error: (err) => console.error(err)
    });
  }

  playNotificationSound() {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const now = ctx.currentTime;
      
      const playNote = (freq: number, startTime: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);
        
        gain.gain.setValueAtTime(0.12, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(startTime);
        osc.stop(startTime + duration);
      };
      
      playNote(550, now, 0.3);
      playNote(880, now + 0.12, 0.45);
    } catch (e) {
      console.warn('AudioContext sound blocked or unsupported:', e);
    }
  }

  mostrarBurbujaToast(n: Notificacion) {
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }
    this.notificacionToast.set(n);
    this.campanaAnimada.set(true);
    this.playNotificationSound();

    setTimeout(() => {
      this.campanaAnimada.set(false);
    }, 1500);

    this.toastTimeout = setTimeout(() => {
      this.notificacionToast.set(null);
    }, 6000);
  }

  cerrarToast(event: MouseEvent) {
    event.stopPropagation();
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }
    this.notificacionToast.set(null);
  }

  hacerClicEnToast(n: Notificacion) {
    this.abrirNotificacion(n);
    this.notificacionToast.set(null);
  }

  toggleDropdown() {
    this.mostrarDropdown.update(v => !v);

    if (this.mostrarDropdown()) {
      this.cargarNotificaciones();
    }
  }

  abrirNotificacion(n: Notificacion) {
    this.notificacionSeleccionada = n;
    this.mostrarDropdown.set(false);

    if (!n.leido) {
      this.notifService.marcarLeido(n.id, true).subscribe({
        next: () => {
          this.notificaciones.update(lista =>
            lista.map(notif =>
              notif.id === n.id
                ? { ...notif, leido: true }
                : notif
            )
          );
          this.notifService.notificarCambio();
        },
        error: (err) => console.error(err)
      });
    }
  }

  cerrarDetalleNotificacion() {
    this.notificacionSeleccionada = null;
  }

  noLeidas() {
    return this.notificaciones().filter(n => !n.leido).length;
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

  resumenMensaje(n: Notificacion): string {
    const mensaje = this.mensajePrincipal(n);
    return mensaje.length > 105 ? `${mensaje.slice(0, 105).trim()}...` : mensaje;
  }

  firmaNotificacion(n: Notificacion | null): string | null {
    const linea = this.obtenerLinea(n, (value) => this.esLineaFirma(value));
    return linea ? linea.replace(/^Atte\.?\s*/i, '').trim() : null;
  }

  enlaceNotificacion(n: Notificacion | null): string | null {
    const linea = this.obtenerLinea(n, (value) => this.esLineaEnlace(value));
    const enlace = linea ? linea.replace(/^Enlace:\s*/i, '').trim() : null;
    return enlace || null;
  }

  etiquetaTipo(n: Notificacion): string {
    return n.tipo === 'sistema' ? 'Sistema' : 'Comunicado';
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

    if (texto.includes('convenio')) return 'Convenios';
    if (texto.includes('actividad') || texto.includes('tarea')) return 'Actividades';
    if (texto.includes('archivo') || texto.includes('documento') || texto.includes('repositorio')) return 'Repositorio';

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

    this.cerrarDetalleNotificacion();
    void this.router.navigateByUrl(ruta);
  }

  irAPerfil(): void {
    void this.router.navigateByUrl('/perfil');
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
    return /^Enlace:\s*/i.test(linea.trim());
  }

  private esLineaSistema(linea: string): boolean {
    return /^(Apartado|Accion|Ruta|Usuario|Origen):\s*/i.test(linea.trim());
  }

  private esLineaCambios(linea: string): boolean {
    const value = linea.trim();
    return /^Cambios realizados:\s*$/i.test(value) || /^-\s+/.test(value);
  }

  private valorSistema(n: Notificacion | null, clave: string): string | null {
    const linea = this.obtenerLinea(n, (value) =>
      new RegExp(`^${clave}:\\s*`, 'i').test(value),
    );

    return linea ? linea.replace(new RegExp(`^${clave}:\\s*`, 'i'), '').trim() : null;
  }

  private inferirAccionSistema(n: Notificacion | null): string {
    const texto = `${n?.titulo ?? ''} ${n?.mensaje ?? ''}`.toLowerCase();

    if (texto.includes('elimin')) return 'Eliminacion';
    if (texto.includes('agreg') || texto.includes('cre')) return 'Creacion';
    if (texto.includes('venc')) return 'Aviso automatico';

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

  @HostListener('document:click', ['$event'])
  cerrarDropdown(event: MouseEvent) {
    const target = event.target as HTMLElement;

    if (!target.closest('.notif-container')) {
      this.mostrarDropdown.set(false);
    }
  }

  toggleDarkMode() {
    const element = document.querySelector('html');

    if (element) {
      element.classList.toggle('app-dark');
      this.isDarkMode.set(element.classList.contains('app-dark'));
      localStorage.setItem('calma-theme', this.isDarkMode() ? 'dark' : 'light');
    }
  }

  private inicializarTema(): void {
    const element = document.querySelector('html');
    const temaGuardado = localStorage.getItem('calma-theme');

    if (!element) {
      return;
    }

    element.classList.toggle('app-dark', temaGuardado === 'dark');
    this.isDarkMode.set(element.classList.contains('app-dark'));
  }
}
