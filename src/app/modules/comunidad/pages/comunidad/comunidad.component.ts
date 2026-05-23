import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ComunidadService, Contacto, ContactoBackend, UsuarioOtraArea, SolicitudContacto } from '../../services/comunidad.service';
import { AuthService } from '../../../auth/services/auth.service';
import { User } from '../../../../shared/models/user.model';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { CommunicationService } from '../../../../core/services/communication.service';

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

  constructor(
    private router: Router, 
    private comunidadService: ComunidadService,
    private authService: AuthService,
    private communicationService: CommunicationService
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
  }

  ngOnDestroy() {
    this.communicationService.disconnect();
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
      socket.emit('getOnlineUsers');
    }).catch(err => console.error('Error conectando sockets en comunidad:', err));
  }

  private actualizarEstadoUsuario(userId: number, online: boolean) {
    let cambiado = false;
    this.contactos.forEach(c => {
      if (c.usuarioId === userId || c.id === userId) {
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
    
    this.contactos = dataSinUsuario.map((u: any) => ({
      id: Number(u.id),
      usuarioId: Number(u.usuarioId || u.id),
      nombre: u.nombreCompleto || u.nombre || 'Usuario',
      rol: u.rolNombre || u.rol || u.puesto || 'Usuario',
      area: u.areaPrincipal || u.area || 'General',
      email: u.email,
      telefono: u.telefono || undefined,
      iniciales: (u.nombreCompleto || u.nombre || u.email || 'U').substring(0, 2).toUpperCase(),
      online: u.online || u.enLinea || false,
      esFavorito: favoritosGuardados.includes(Number(u.id))
    }));
    
    this.areas = [...new Set(this.contactos.map(c => c.area).filter(Boolean))];
    console.log('Contactos procesados en total:', this.contactos.length);
    this.aplicarFiltros();
    this.cargando = false;
  }

  aplicarFiltros() {
    let resultado = [...this.contactos];

    if (this.textoBusqueda.trim()) {
      const busqueda = this.textoBusqueda.toLowerCase();
      resultado = resultado.filter(c =>
        c.nombre.toLowerCase().includes(busqueda) ||
        c.rol.toLowerCase().includes(busqueda) ||
        (c.email && c.email.toLowerCase().includes(busqueda))
      );
    }

    if (this.areaSeleccionada !== 'Todos') {
      resultado = resultado.filter(c => c.area === this.areaSeleccionada);
    }

    resultado.sort((a, b) => {
      // Primero ordenamos por favoritos, luego alfabéticamente
      if (a.esFavorito !== b.esFavorito) return a.esFavorito ? -1 : 1;
      return a.nombre.localeCompare(b.nombre);
    });

    this.contactosFiltrados = resultado;
  }

  onBusquedaChange() {
    this.aplicarFiltros();
  }

  onAreaChange() {
    this.aplicarFiltros();
  }

  // ============================================
  // CONTACTOS - ACCIONES
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