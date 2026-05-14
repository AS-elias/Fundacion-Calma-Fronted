import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { NotificacionesService } from '../../services/notificaciones.service';
import { FormsModule } from '@angular/forms';

export type TipoNotificacion = 'comunicado' | 'alerta';

export interface Notificacion {
  id: number;
  titulo: string;
  mensaje: string;
  tipo: string;
  creado_at: Date;
  leido: boolean;
  imagen?: string;
}

@Component({
  selector: 'app-notificaciones',
  standalone: true,
  imports: [CommonModule, HttpClientModule, FormsModule],
  templateUrl: './notificaciones.html',
  styleUrls: ['./notificaciones.scss'],
})
export class Notificaciones implements OnInit {

  mostrarConfirmacion = false;
  idAEliminar: number | null = null;

  filtroSeleccionado: 'todos' | TipoNotificacion = 'todos';
  notificaciones: Notificacion[] = [];

  notificacionSeleccionada: Notificacion | null = null;

  mostrarFormulario = false;

  form = {
    titulo: '',
    mensaje: '',
    tipo: 'comunicado',
    imagen: null as string | null
  };

  constructor(private service: NotificacionesService) {}

  ngOnInit(): void {
    this.cargarNotificaciones();
  }

  cargarNotificaciones(): void {
    this.service.listar().subscribe({
      next: (data) => {
        this.notificaciones = data;
      },
      error: (err) => {
        console.error('Error cargando notificaciones', err);
      }
    });
  }

  get cantidadNoLeidas(): number {
    return this.notificaciones.filter(n => !n.leido).length;
  }

  cambiarFiltro(filtro: 'todos' | TipoNotificacion): void {
    this.filtroSeleccionado = filtro;
  }

  get notificacionesFiltradas(): Notificacion[] {
    if (this.filtroSeleccionado === 'todos') {
      return this.notificaciones;
    }
    return this.notificaciones.filter(n => n.tipo === this.filtroSeleccionado);
  }

  toggleLeido(n: Notificacion): void {
    const nuevoEstado = !n.leido;

    this.service.marcarLeido(n.id, nuevoEstado).subscribe({
      next: () => {
        n.leido = nuevoEstado;
      },
      error: (err) => {
        console.error('Error al cambiar estado', err);
      }
    });
  }

  eliminarNotificacion(id: number): void {
    this.service.eliminar(id).subscribe({
      next: () => {
        this.notificaciones = this.notificaciones.filter(n => n.id !== id);
      },
      error: (err) => {
        console.error('Error al eliminar', err);
      }
    });
  }

  toggleFormulario(): void {
    this.mostrarFormulario = !this.mostrarFormulario;
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      this.form.imagen = reader.result as string;
    };

    reader.readAsDataURL(file);

    input.value = '';
  }

  guardarNotificacion(): void {
    this.service.crear(this.form).subscribe({
      next: () => {
        this.cargarNotificaciones();

        this.form = {
          titulo: '',
          mensaje: '',
          tipo: 'comunicado',
          imagen: null
        };

        this.mostrarFormulario = false;
      },
      error: (err) => {
        console.error('Error al crear', err);
      }
    });
  }

  abrirDetalle(n: Notificacion): void {
    console.log('CLICK', n);
    this.notificacionSeleccionada = n;
  }

  cerrarModal(): void {
    this.notificacionSeleccionada = null;
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

}