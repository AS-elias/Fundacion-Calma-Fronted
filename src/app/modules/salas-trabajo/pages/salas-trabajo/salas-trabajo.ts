import { Component, OnInit, OnDestroy } from '@angular/core';
import { GrupoSalas, Sala, SalasTrabajoService } from '../../services/salas-trabajo.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../auth/services/auth.service';
import { Subscription } from 'rxjs';
import { MessageService } from 'primeng/api';
import { CommunicationService, SistemaActualizadoEvent } from '../../../../core/services/communication.service';

interface NuevaSala {
  id?: number;
  nombre: string;
  area: string;
  link: string;
  descripcion: string;
  es_privada: boolean;
  es_general?: boolean;
}

@Component({
  selector: 'app-salas-trabajo',
  imports: [FormsModule, CommonModule],
  templateUrl: './salas-trabajo.html',
  styleUrl: './salas-trabajo.scss',
})
export class SalasTrabajo implements OnInit, OnDestroy {

  salaGeneral?: Sala;
  grupos: GrupoSalas[] = [];
  nuevaSala: NuevaSala = {
    nombre: '',
    area: '',
    link: '',
    descripcion: '',
    es_privada: false,
    es_general: false
  };

  mostrarModalAgregar = false;
  modoEdicion = false;
  mostrarConfirmacionEliminar = false;
  salaAEliminar: { grupoIndex: number, salaIndex: number, id?: number } | null = null;

  areasSugeridas: string[] = [];
  mostrarInputArea = false;

  // Real-time Sync
  private syncSub?: Subscription;

  constructor(
    private salasTrabajoService: SalasTrabajoService,
    private authService: AuthService,
    private communicationService: CommunicationService,
    private messageService: MessageService
  ) {}

  get puedeModificarSalas(): boolean {
    return this.authService.isAdmin() || this.authService.isDirector();
  }

  verificarArea(event: any) {
    if (event.target.value === 'OTRA') {
      this.mostrarInputArea = true;
      this.nuevaSala.area = '';
    }
  }

  cancelarNuevaArea() {
    this.mostrarInputArea = false;
    this.nuevaSala.area = '';
  }

  ngOnInit(): void {
    this.cargarSalas();

    const token = this.authService.getToken();
    if (token) {
      this.communicationService.connect(token).catch(err => {
        console.error('Error conectando sockets en salas:', err);
      });
    }

    this.syncSub = this.communicationService.sistemaActualizado$.subscribe((event: SistemaActualizadoEvent) => {
      if (event.modulo === 'salas') {
        this.cargarSalas(); // Recarga automática al detectar cambios
      }
    });
  }

  ngOnDestroy(): void {
    if (this.syncSub) {
      this.syncSub.unsubscribe();
    }
  }

  cargarSalas(): void {
    this.salasTrabajoService.getSalaGeneral().subscribe({
      next: (sala) => {
        this.salaGeneral = sala;
      },
      error: (err) => console.error('Error cargando sala general:', err)
    });

    this.salasTrabajoService.getSalas().subscribe({
      next: (gruposDesdeBackend) => {
        this.grupos = gruposDesdeBackend;

        // Combinar áreas dinámicas
        const todasLasAreas = new Set<string>(this.areasSugeridas);
        this.grupos.forEach(g => todasLasAreas.add(g.area));
        this.areasSugeridas = Array.from(todasLasAreas).sort();
      },
      error: (err) => console.error('Error cargando las salas:', err)
    });
  }

  entrar(link?: string) {
    if (link) {
      window.open(link, '_blank');
    } else {
      console.log('No hay link configurado para esta sala.');
    }
  }

  abrirModalAgregar() {
    this.modoEdicion = false;
    this.mostrarInputArea = false;
    this.cancelarFormulario();
    this.mostrarModalAgregar = true;
  }

  abrirModalEditar(sala: Sala) {
    this.modoEdicion = true;
    this.nuevaSala = {
      id: sala.id,
      nombre: sala.nombre,
      area: sala.area || '',
      link: sala.link,
      descripcion: sala.descripcion,
      es_privada: sala.es_privada || false,
      es_general: sala.es_general || false
    };
    
    if (!this.nuevaSala.es_general && this.nuevaSala.area && !this.areasSugeridas.includes(this.nuevaSala.area)) {
      this.mostrarInputArea = true;
    } else {
      this.mostrarInputArea = false;
    }
    
    this.mostrarModalAgregar = true;
  }

  cerrarModalAgregar() {
    this.mostrarModalAgregar = false;
    this.cancelarFormulario();
  }

  guardarSala() {
    if (!this.nuevaSala.nombre || (!this.nuevaSala.es_general && !this.nuevaSala.area) || !this.nuevaSala.link) {
      this.messageService.add({severity:'warn', summary:'Atención', detail:'Por favor, completa los campos requeridos (*).'});
      return;
    }

    const payload: any = {
      nombre: this.nuevaSala.nombre,
      descripcion: this.nuevaSala.descripcion,
      link: this.nuevaSala.link
    };
    
    if (this.nuevaSala.es_general) {
      payload.es_general = true;
    } else {
      payload.area = this.nuevaSala.area;
    }

    if (this.modoEdicion) {
      if (!this.nuevaSala.id) {
        console.error('Error Crítico: No se encontró el ID de la sala a editar.', this.nuevaSala);
        this.messageService.add({severity:'error', summary:'Error', detail:'Ocurrió un error al intentar editar. Por favor, recarga la página.'});
        return;
      }

      // EDICIÓN
      this.salasTrabajoService.editarSala(this.nuevaSala.id, payload).subscribe({
        next: (salaEditada) => {
          // Actualizar localmente si es la sala general
          if (this.nuevaSala.es_general && this.salaGeneral) {
            this.salaGeneral.nombre = this.nuevaSala.nombre;
            this.salaGeneral.descripcion = this.nuevaSala.descripcion;
            this.salaGeneral.link = this.nuevaSala.link;
          } else {
            // Si es otra sala, recargar todo para reordenar grupos
            this.cargarSalas();
          }
          
          this.cerrarModalAgregar();
          this.messageService.add({severity:'success', summary:'Éxito', detail:'Sala editada correctamente.'});
        },
        error: (err) => {
          console.error('Error al editar sala:', err);
          this.messageService.add({severity:'error', summary:'Error', detail:'Ocurrió un error al editar la sala.'});
        }
      });
    } else {
      // CREACIÓN
      this.salasTrabajoService.crearSala(payload).subscribe({
        next: (salaCreada) => {
          this.cargarSalas(); // Recargar para mantener el estado fresco
          this.cerrarModalAgregar();
          this.messageService.add({severity:'success', summary:'Éxito', detail:'Sala creada correctamente.'});
        },
        error: (err) => {
          console.error('Error al crear sala:', err);
          this.messageService.add({severity:'error', summary:'Error', detail:'Ocurrió un error al crear la sala.'});
        }
      });
    }
  }

  cancelarFormulario() {
    this.nuevaSala = {
      id: undefined,
      nombre: '',
      area: '',
      link: '',
      descripcion: '',
      es_privada: false
    };
  }

  abrirConfirmacionEliminar(grupoIndex: number, salaIndex: number) {
    const sala = this.grupos[grupoIndex].salas[salaIndex];
    this.salaAEliminar = { grupoIndex, salaIndex, id: sala.id };
    this.mostrarConfirmacionEliminar = true;
  }

  cerrarConfirmacionEliminar() {
    this.mostrarConfirmacionEliminar = false;
    this.salaAEliminar = null;
  }

  confirmarEliminar() {
    if (this.salaAEliminar && this.salaAEliminar.id) {
      this.salasTrabajoService.eliminarSala(this.salaAEliminar.id).subscribe({
        next: () => {
          const { grupoIndex, salaIndex } = this.salaAEliminar!;
          this.grupos[grupoIndex].salas.splice(salaIndex, 1);
          if (this.grupos[grupoIndex].salas.length === 0) {
            this.grupos.splice(grupoIndex, 1);
          }
          this.cerrarConfirmacionEliminar();
          this.messageService.add({severity:'success', summary:'Éxito', detail:'Sala eliminada correctamente.'});
        },
        error: (err) => {
          console.error('Error al eliminar sala:', err);
          this.messageService.add({severity:'error', summary:'Error', detail:'Ocurrió un error al eliminar la sala.'});
          this.cerrarConfirmacionEliminar();
        }
      });
    } else {
      this.cerrarConfirmacionEliminar();
    }
  }
}
