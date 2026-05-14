import { Component, OnInit } from '@angular/core';
import { GrupoSalas, Sala, SalasTrabajoService } from '../../services/salas-trabajo.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

interface NuevaSala {
  nombre: string;
  area: string;
  link: string;
  descripcion: string;
  es_privada: boolean;
}

@Component({
  selector: 'app-salas-trabajo',
  imports: [FormsModule, CommonModule],
  templateUrl: './salas-trabajo.html',
  styleUrl: './salas-trabajo.scss',
})
export class SalasTrabajo implements OnInit {

  salaGeneral?: Sala;
  grupos: GrupoSalas[] = [];
  nuevaSala: NuevaSala = {
    nombre: '',
    area: '',
    link: '',
    descripcion: '',
    es_privada: false
  };

  mostrarModalAgregar = false;
  mostrarConfirmacionEliminar = false;
  salaAEliminar: { grupoIndex: number, salaIndex: number, id?: number } | null = null;

  constructor(private salasTrabajoService: SalasTrabajoService) {}

  ngOnInit(): void {
    this.cargarSalas();
  }

  cargarSalas(): void {
    this.salasTrabajoService.getSalaGeneral().subscribe({
      next: (sala) => {
        this.salaGeneral = sala;
      },
      error: (err) => console.error('Error cargando sala general:', err)
    });

    this.salasTrabajoService.getSalas().subscribe({
      next: (salas) => {
        const salasNormales = salas.filter((s: Sala) => !s.es_general);
        
        const gruposMap = new Map<string, Sala[]>();
        salasNormales.forEach((sala: Sala) => {
          const areaNombre = sala.area || 'Otras Salas';
          if (!gruposMap.has(areaNombre)) {
            gruposMap.set(areaNombre, []);
          }
          gruposMap.get(areaNombre)!.push(sala);
        });

        this.grupos = Array.from(gruposMap.keys()).map(area => ({
          area,
          salas: gruposMap.get(area)!
        }));
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
    this.mostrarModalAgregar = true;
  }

  cerrarModalAgregar() {
    this.mostrarModalAgregar = false;
    this.cancelarFormulario();
  }

  crearSala() {
    if (!this.nuevaSala.nombre || !this.nuevaSala.descripcion || !this.nuevaSala.area || !this.nuevaSala.link) {
      alert('Por favor, completa los campos requeridos (*).');
      return;
    }

    const payload = {
      nombre: this.nuevaSala.nombre,
      descripcion: this.nuevaSala.descripcion,
      es_privada: this.nuevaSala.es_privada,
      area: this.nuevaSala.area,
      link: this.nuevaSala.link
    };

    this.salasTrabajoService.crearSala(payload).subscribe({
      next: (salaCreada) => {
        const area = salaCreada.area || this.nuevaSala.area;
        const grupoExistente = this.grupos.find(g => g.area === area);
        if (grupoExistente) {
          grupoExistente.salas.push(salaCreada);
        } else {
          this.grupos.push({ area, salas: [salaCreada] });
        }
        this.cerrarModalAgregar();
      },
      error: (err) => {
        console.error('Error al crear sala:', err);
        alert('Ocurrió un error al crear la sala.');
      }
    });
  }

  cancelarFormulario() {
    this.nuevaSala = {
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
        },
        error: (err) => {
          console.error('Error al eliminar sala:', err);
          alert('Ocurrió un error al eliminar la sala.');
          this.cerrarConfirmacionEliminar();
        }
      });
    } else {
      this.cerrarConfirmacionEliminar();
    }
  }
}
