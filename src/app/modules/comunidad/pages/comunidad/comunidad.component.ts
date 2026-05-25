import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ComunidadService, Contacto, ContactoBackend, UsuarioOtraArea, SolicitudContacto } from '../../services/comunidad.service';
import { AuthService } from '../../../auth/services/auth.service';
import { User } from '../../../../shared/models/user.model';
import { forkJoin, of, Subscription } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { CommunicationService } from '../../../../core/services/communication.service';
import { NavbarSearchService } from '../../../../shared/services/navbar-search.service';
import {
  esCumpleanosHoy,
  formatDateOnlyLong,
} from '../../../../shared/utils/date-only';

@Component({
  selector: 'app-comunidad',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule],
  templateUrl: './comunidad.component.html',
  styleUrls: ['./comunidad.component.scss']
})
export class ComunidadComponent implements OnInit, OnDestroy {
  
  // ====== CONTACTOS DIRECTOS (Misma Área) ======
  contactos: Contacto[] = [];
  contactosFiltrados: Contacto[] = [];
  mostrarBuscador: boolean = false;
  textoBusqueda: string = '';
  areaSeleccionada: string = 'Todos';
  cargando: boolean = false;
  guardando: boolean = false;
  buscandoEmail: boolean = false;
  areas: string[] = [];
  private readonly FAVORITOS_STORAGE_KEY = 'comunidad_favoritos';

  
  usuarioAutenticado: User | null = null;
  areaUsuario: string = 'Todos';

  private syncSub?: Subscription;

  constructor(
    private router: Router, 
    private comunidadService: ComunidadService,
    private authService: AuthService,
    private communicationService: CommunicationService,
    private navbarSearchService: NavbarSearchService
  ) {
    this.usuarioAutenticado = authService.getCurrentUser();
    if (this.usuarioAutenticado?.area) {
      this.areaUsuario = this.usuarioAutenticado.area;
      this.areaSeleccionada = this.areaUsuario;
    }
  }

  ngOnInit() {
    this.obtenerContactos();
    this.conectarYEscucharSockets();

    this.syncSub = this.communicationService.sistemaActualizado$.subscribe((event: any) => {
      if (event.modulo === 'comunidad') {
        this.solicitarUsuariosConectados();
      }
    });

    // Escuchar búsqueda del navbar
    this.navbarSearchService.searchQuery$.subscribe(query => {
      this.textoBusqueda = query;
      this.aplicarFiltros();
    });
  }

  ngOnDestroy() {
    this.communicationService.disconnect();
    if (this.syncSub) {
      this.syncSub.unsubscribe();
    }
  }

  private solicitarUsuariosConectados() {
    const socket = this.communicationService.getSocket();
    if (socket && socket.connected) {
      socket.emit('getConnectedUsers', {}, (response: any) => {
        if (response && response.connectedUsers) {
          const arr = Array.isArray(response.connectedUsers) ? response.connectedUsers : Array.from(response.connectedUsers);
          arr.forEach((uid: any) => this.actualizarEstadoUsuario(Number(uid), true));
        }
      });
    }
  }

  private conectarYEscucharSockets() {
    const token = this.authService.getToken();
    if (!token) return;

    this.communicationService.connect(token).then(() => {
      const socket = this.communicationService.getSocket();
      if (!socket) return;

      socket.off('userOnline');
      socket.off('userOffline');

      socket.on('userOnline', (data: any) => {
        if (data?.userId) this.actualizarEstadoUsuario(data.userId, true);
      });

      socket.on('userOffline', (data: any) => {
        if (data?.userId) this.actualizarEstadoUsuario(data.userId, false);
      });

      // Recibir lista de todos los usuarios online al conectar
      socket.on('onlineUsers', (data: any[]) => {
        if (Array.isArray(data)) {
          data.forEach(uid => this.actualizarEstadoUsuario(uid, true));
        }
      });

      // Pedir lista actual de conectados
      socket.emit('getConnectedUsers', {}, (response: any) => {
        if (response && response.connectedUsers) {
          const arr = Array.isArray(response.connectedUsers) ? response.connectedUsers : Array.from(response.connectedUsers);
          arr.forEach((uid: any) => this.actualizarEstadoUsuario(Number(uid), true));
        }
      });
    }).catch(err => console.error('Error conectando sockets en comunidad:', err));
  }

  private usuariosOnline = new Set<number>();

  private actualizarEstadoUsuario(userId: number, online: boolean) {
    if (online) {
      this.usuariosOnline.add(Number(userId));
    } else {
      this.usuariosOnline.delete(Number(userId));
    }

    let cambiado = false;
    this.contactos.forEach(c => {
      if (Number(c.usuarioId) === Number(userId) || Number(c.id) === Number(userId)) {
        if (c.online !== online) {
          c.online = online;
          cambiado = true;
        }
      }
    });
    
    if (cambiado) {
      this.contactos = [...this.contactos];
      this.aplicarFiltros();
    }
  }

  // ============================================
  // CONTACTOS DIRECTOS (Misma Área)
  // ============================================

  obtenerContactos() {
    this.cargando = true;
    console.log('Obteniendo TODOS los usuarios de la comunidad...');
    
    forkJoin({
      mismaArea: this.comunidadService.getContactosAccesibles().pipe(catchError(() => of([]))),
      otrasAreas: this.comunidadService.buscarUsuariosOtraArea('').pipe(catchError(() => of([])))
    }).subscribe({
      next: ({ mismaArea, otrasAreas }) => {
        this.procesarContactosCombinados(mismaArea, otrasAreas);
      },
      error: (err: any) => {
        console.error('Error al obtener usuarios:', err);
        this.cargando = false;
        alert('Error al conectar con la comunidad. Verifica tu sesión.');
      }
    });
  }

  private procesarContactosCombinados(mismaArea: any, otrasAreas: any) {
    // Extracción segura del arreglo de usuarios dependiendo del formato que devuelva el backend
    const arrMismaArea = Array.isArray(mismaArea) ? mismaArea : (mismaArea?.data || mismaArea?.users || []);
    const arrOtrasAreas = Array.isArray(otrasAreas) ? otrasAreas : (otrasAreas?.data || otrasAreas?.users || []);

    const todosLosUsuarios = [...arrMismaArea, ...arrOtrasAreas];
    const usuariosUnicos = Array.from(new Map(todosLosUsuarios.map(u => [u.email, u])).values());

    const dataSinUsuario = usuariosUnicos.filter(
      (u: any) => u.email !== this.usuarioAutenticado?.email && Number(u.id) !== Number(this.usuarioAutenticado?.id)
    );

    const favoritosGuardados = this.cargarFavoritos();
    
    this.contactos = dataSinUsuario.map((u: any) => {
      const uId = Number(u.id);
      const uUsuarioId = Number(u.usuarioId || u.id);
      
      return {
        id: uId,
        usuarioId: uUsuarioId,
        nombre: u.nombreCompleto || u.nombre || 'Usuario',
        rol: u.rolNombre || u.rol || u.puesto || 'Usuario',
        area: u.areaPrincipal || u.area || 'General',
        email: u.email,
        telefono: u.telefono || undefined,
        iniciales: (u.nombreCompleto || u.nombre || u.email || 'U').substring(0, 2).toUpperCase(),
        online: this.usuariosOnline.has(uId) || this.usuariosOnline.has(uUsuarioId) || u.online || u.enLinea || false,
        esFavorito: favoritosGuardados.includes(uId),
        fecha_nacimiento: u.fechaNacimiento || u.fecha_nacimiento || undefined,
        linkedin_url: u.linkedinUrl || u.linkedin_url || undefined,
        biografia: u.biografia || undefined,
        foto_url: u.fotoUrl || u.foto_url || undefined
      };
    });
    
    this.areas = [...new Set(this.contactos.map(c => c.area).filter(Boolean))];
    console.log('Contactos procesados en total:', this.contactos.length);
    this.aplicarFiltros();
    this.cargando = false;
  }

  // ============================================
  // PERFIL COMPLETO (MODAL)
  // ============================================
  contactoSeleccionado: Contacto | null = null;
  mostrarModalPerfil: boolean = false;

  abrirPerfil(contacto: Contacto) {
    this.contactoSeleccionado = contacto;
    this.mostrarModalPerfil = true;
  }

  cerrarPerfil() {
    this.mostrarModalPerfil = false;
    setTimeout(() => this.contactoSeleccionado = null, 300);
  }

  filtroRapido: 'Todos' | 'MiArea' | 'Favoritos' | 'EnLinea' = 'Todos';

  setFiltroRapido(filtro: 'Todos' | 'MiArea' | 'Favoritos' | 'EnLinea') {
    this.filtroRapido = filtro;
    this.aplicarFiltros();
  }

  aplicarFiltros() {
    let result = [...this.contactos];

    if (this.filtroRapido === 'MiArea' && this.areaUsuario !== 'Todos') {
      result = result.filter(c => c.area === this.areaUsuario);
    } else if (this.filtroRapido === 'Favoritos') {
      result = result.filter(c => c.esFavorito);
    } else if (this.filtroRapido === 'EnLinea') {
      result = result.filter(c => c.online);
    }

    if (this.areaSeleccionada !== 'Todos') {
      result = result.filter(c => c.area === this.areaSeleccionada);
    }

    if (this.textoBusqueda.trim()) {
      const term = this.textoBusqueda.toLowerCase().trim();
      result = result.filter(c => 
        c.nombre.toLowerCase().includes(term) ||
        (c.email && c.email.toLowerCase().includes(term)) ||
        c.rol.toLowerCase().includes(term)
      );
    }

    result.sort((a, b) => {
      // Primero ordenamos por favoritos, luego alfabéticamente
      if (a.esFavorito !== b.esFavorito) return a.esFavorito ? -1 : 1;
      return a.nombre.localeCompare(b.nombre);
    });

    this.contactosFiltrados = result;
  }

  onBusquedaChange() {
    this.aplicarFiltros();
  }

  onAreaChange() {
    this.aplicarFiltros();
  }

  esCumpleanos(fechaStr?: string): boolean {
    return esCumpleanosHoy(fechaStr);
  }

  cumpleanosTexto(fechaStr?: string): string {
    return formatDateOnlyLong(fechaStr);
  }

  // ============================================
  // SOLICITUDES DE CONTACTO
  // ============================================

  eliminarContacto(id: number | undefined) {
    if (!id) return;
    
    if (confirm('¿Estás seguro de eliminar este contacto?')) {
      this.comunidadService.deleteContacto(id).subscribe({
        next: () => {
          this.contactos = this.contactos.filter(c => c.id !== id);
          this.aplicarFiltros();
          console.log('Contacto eliminado exitosamente');
        },
        error: (err: unknown) => {
          console.error('Error al eliminar contacto:', err);
          alert('Error al eliminar el contacto.');
        }
      });
    }
  }

  async abrirChat(contacto: Contacto) {
    const targetId = contacto.usuarioId || contacto.id;
    
    this.router.navigate(['/comunicaciones'], {
      queryParams: {
        chatContactoId: targetId,
        chatContactoNombre: contacto.nombre
      }
    });
  }

  enviarCorreo(contacto: Contacto) {
    if (contacto.email) {
      window.location.href = `mailto:${contacto.email}`;
      return;
    }

    this.abrirChat(contacto);
  }

  async iniciarLlamada(contacto: Contacto) {
    if (contacto.telefono) {
      window.location.href = `tel:${contacto.telefono}`;
    } else {
      alert('El usuario no tiene un número de teléfono registrado.');
    }
  }

  toggleFavorito(contacto: Contacto) {
    contacto.esFavorito = !contacto.esFavorito;
    this.guardarFavoritos();
    this.aplicarFiltros();
    console.log(`Favorito actualizado para ${contacto.nombre}`);
  }

  private cargarFavoritos(): number[] {
    const favoritos = localStorage.getItem(this.FAVORITOS_STORAGE_KEY);
    return favoritos ? JSON.parse(favoritos) : [];
  }

  private guardarFavoritos(): void {
    const favoritosIds = this.contactos
      .filter(c => c.esFavorito)
      .map(c => c.id)
      .filter(id => id !== undefined) as number[];
    localStorage.setItem(this.FAVORITOS_STORAGE_KEY, JSON.stringify(favoritosIds));
  }

  // ====== UTILIDADES ======
  
  getInitiales(nombre: string | undefined): string {
    if (!nombre) return '??';
    return nombre.substring(0, 2).toUpperCase();
  }
}
