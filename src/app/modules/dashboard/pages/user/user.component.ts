import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DatePicker } from 'primeng/datepicker';
import { DashboardService, UserDashboardStats } from '../../services/dashboard.service';

@Component({
  selector: 'app-user-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePicker],
  templateUrl: './user.component.html',
  styleUrls: ['./user.scss']
})
export class UserComponent implements OnInit {
  fechaActual: Date = new Date();
  
  stats: UserDashboardStats | null = null;
  cargando = true;

  private dashboardService = inject(DashboardService);

  ngOnInit(): void {
    this.dashboardService.getUserStats().subscribe({
      next: (data) => {
        const statsPayload: any = this.normalizeBackendPayload(data);
        
        const misProyectos = this.getNumberFromPayload(statsPayload, [
          'misProyectos', 'mis_proyectos', 'proyectos', 'proyectos_count', 'totalProyectos', 'total_proyectos'
        ]) || this.sumTaskCounts(statsPayload.estadisticasTareas || statsPayload);

        const misConvenios = this.getNumberFromPayload(statsPayload, [
          'misConvenios', 'mis_convenios', 'convenios', 'convenios_count', 'conveniosVigentes', 'convenios_vigentes'
        ]);

        const desempenoEquipo = this.getNumberFromPayload(statsPayload, ['desempenoEquipo', 'desempeno_equipo', 'desempenoEquipoArea']);
        const desempenoPersonal = this.getNumberFromPayload(statsPayload, ['desempenoPersonal', 'desempeno_personal']);
        
        const actividadReciente = this.getArrayFromPayload(statsPayload, [
          'actividadReciente', 'actividadesRecientes', 'actividades'
        ]);

        this.stats = {
          misProyectos,
          misConvenios,
          desempenoEquipo,
          desempenoPersonal,
          actividadReciente
        } as any;

        this.cargando = false;
      },
      error: () => {
        this.cargando = false;
      }
    });
  }

  private normalizeBackendPayload(payload: any): any {
    if (!payload || typeof payload !== 'object') return {};
    return payload.data || payload.result || payload.payload || payload;
  }

  private getNumberFromPayload(payload: any, keys: string[]): number | undefined {
    if (!payload || typeof payload !== 'object') return undefined;
    for (const key of keys) {
      if (payload[key] !== undefined && payload[key] !== null) {
        let value = payload[key];
        if (typeof value === 'string' && value.trim() !== '') value = Number(value);
        if (typeof value === 'number' && Number.isFinite(value)) return value;
      }
    }
    return undefined;
  }

  private getArrayFromPayload(payload: any, keys: string[]): any[] {
    if (!payload || typeof payload !== 'object') return [];
    for (const key of keys) {
      const value = payload[key];
      if (Array.isArray(value)) return value;
    }
    return [];
  }

  private sumTaskCounts(statsPayload: any): number {
    if (!statsPayload || typeof statsPayload !== 'object') return 0;
    let total = 0;
    
    // Contamos tanto de las propiedades directas como de namespaces internos
    const countFrom = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;
      const mapKeys = [
        'pendientes', 'pendiente', 
        'progreso', 'en_progreso', 'proceso', 'en_proceso', 'planificacion', 'planificación', 'revision', 'en_revision',
        'ejecucion', 'ejecución', 'en_ejecucion', 'en_ejecución',
        'completadas', 'completado', 'terminado', 'finalizado',
        'paralizado', 'otros', 'pausado', 'cancelado'
      ];
      for (const k of mapKeys) {
        if (obj[k] !== undefined && obj[k] !== null) {
          const val = Number(obj[k]);
          if (!isNaN(val)) total += val;
        }
      }
    };

    countFrom(statsPayload);
    for (const ns of ['desarrollo_actividades', 'estrategia_actividades', 'analisis_tareas']) {
      countFrom(statsPayload[ns]);
    }

    return total;
  }

  /**
   * Limpia los textos provenientes del backend eliminando fragmentos como "(id=1)"
   */
  limpiarTexto(texto: string): string {
    if (!texto) return '';
    // Remueve fragmentos como " (id=1)"
    return texto.replace(/\s*\(id=\d+\)/g, '');
  }
}