import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DatePicker } from 'primeng/datepicker';
import { DialogModule } from 'primeng/dialog';
import { DashboardService, UserDashboardStats } from '../../services/dashboard.service';
import { DashboardSocketService } from '../../services/dashboard-socket.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-user-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePicker, DialogModule],
  templateUrl: './user.component.html',
  styleUrls: ['./user.scss']
})
export class UserComponent implements OnInit, OnDestroy {
  fechaActual: Date = new Date();
  fechasConActividad: Set<string> = new Set();
  fechasConVencimiento: Set<string> = new Set();
  
  actividadesDelDiaSeleccionado: any[] = [];
  vencimientosDelDiaSeleccionado: any[] = [];
  mostrarDialogoDia: boolean = false;
  
  stats: UserDashboardStats | null = null;
  cargando = true;

  private dashboardService = inject(DashboardService);
  private dashboardSocket = inject(DashboardSocketService);
  private socketSub?: Subscription;

  ngOnInit(): void {
    this.loadDashboardData();

    // Conectar a WebSockets
    this.dashboardSocket.connect();
    this.socketSub = this.dashboardSocket.dashboardUpdated$.subscribe((payload) => {
      console.log('UserComponent: Actualización en tiempo real recibida', payload);
      this.loadDashboardData();
    });
  }

  loadDashboardData(): void {
    this.cargando = true;
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

        const proyectosArray = this.getArrayFromPayload(statsPayload, ['misProyectos', 'mis_proyectos']);
        const conveniosArray = this.getArrayFromPayload(statsPayload, ['misConvenios', 'mis_convenios']);
        const actividadReciente = this.getArrayFromPayload(statsPayload, [
          'actividadReciente', 'actividadesRecientes', 'actividades'
        ]);

        // Extraer vencimientos de proyectos
        if (proyectosArray) {
          proyectosArray.forEach((p: any) => {
            const fechaFin = p.fecha_fin || p.fecha_limite || p.fecha_entrega || p.fechaVencimiento;
            if (fechaFin) {
              const d = new Date(fechaFin);
              if (!isNaN(d.getTime())) {
                const dateStr = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
                this.fechasConVencimiento.add(dateStr);
              }
            }
          });
        }

        // Extraer vencimientos de convenios
        if (conveniosArray) {
          conveniosArray.forEach((c: any) => {
            const fechaFin = c.fecha_fin || c.fecha_limite || c.fecha_entrega || c.fechaVencimiento;
            if (fechaFin) {
              const d = new Date(fechaFin);
              if (!isNaN(d.getTime())) {
                const dateStr = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
                this.fechasConVencimiento.add(dateStr);
              }
            }
          });
        }

        if (actividadReciente) {
          actividadReciente.forEach((act: any) => {
            const fechaValida = act.fecha_actualizacion || act.creado_at || act.fecha;
            if (fechaValida) {
              const d = new Date(fechaValida);
              if (!isNaN(d.getTime())) {
                const dateStr = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
                this.fechasConActividad.add(dateStr);
              }
            }
          });
        }

        // Forzar siempre un punto en el día de hoy para que el usuario sepa dónde buscar sus tareas del día
        const hoy = new Date();
        const hoyStr = `${hoy.getFullYear()}-${hoy.getMonth()}-${hoy.getDate()}`;
        this.fechasConActividad.add(hoyStr);

        this.stats = {
          misProyectos,
          misConvenios,
          desempenoEquipo,
          desempenoPersonal,
          actividadReciente
        } as any;

        this.onDateSelect(this.fechaActual);
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

  /**
   * Verifica si una fecha en el calendario tiene alguna actividad reciente
   */
  hasEvent(date: any): boolean {
    const dateStr = `${date.year}-${date.month}-${date.day}`;
    return this.fechasConActividad.has(dateStr);
  }

  /**
   * Verifica si una fecha en el calendario tiene algún vencimiento (proyecto/convenio)
   */
  hasVencimiento(date: any): boolean {
    const dateStr = `${date.year}-${date.month}-${date.day}`;
    return this.fechasConVencimiento.has(dateStr);
  }

  /**
   * Filtra y muestra las actividades correspondientes al día seleccionado en el calendario
   */
  onDateSelect(selectedDate: Date) {
    if (!this.stats) {
      return;
    }
    
    // Filtrar actividades recientes
    this.actividadesDelDiaSeleccionado = (this.stats.actividadReciente || []).filter((act: any) => {
      const fechaValida = act.fecha_actualizacion || act.creado_at || act.fecha;
      if (!fechaValida) return false;
      const d = new Date(fechaValida);
      if (isNaN(d.getTime())) return false;
      return d.getFullYear() === selectedDate.getFullYear() &&
             d.getMonth() === selectedDate.getMonth() &&
             d.getDate() === selectedDate.getDate();
    });

    // Filtrar proyectos que vencen ese día
    const proyectosArray = this.getArrayFromPayload(this.stats, ['misProyectos', 'mis_proyectos']);
    const proyectosDelDia = proyectosArray.filter((p: any) => {
      const fechaFin = p.fecha_fin || p.fecha_limite || p.fecha_entrega || p.fechaVencimiento;
      if (!fechaFin) return false;
      const d = new Date(fechaFin);
      if (isNaN(d.getTime())) return false;
      return d.getFullYear() === selectedDate.getFullYear() &&
             d.getMonth() === selectedDate.getMonth() &&
             d.getDate() === selectedDate.getDate();
    });

    // Filtrar convenios que vencen ese día
    const conveniosArray = this.getArrayFromPayload(this.stats, ['misConvenios', 'mis_convenios']);
    const conveniosDelDia = conveniosArray.filter((c: any) => {
      const fechaFin = c.fecha_fin || c.fecha_limite || c.fecha_entrega || c.fechaVencimiento;
      if (!fechaFin) return false;
      const d = new Date(fechaFin);
      if (isNaN(d.getTime())) return false;
      return d.getFullYear() === selectedDate.getFullYear() &&
             d.getMonth() === selectedDate.getMonth() &&
             d.getDate() === selectedDate.getDate();
    });

    this.vencimientosDelDiaSeleccionado = [...proyectosDelDia, ...conveniosDelDia];
    
    // Solo abrir el modal si hay algo que mostrar y si no es la primera carga inicial
    if (this.actividadesDelDiaSeleccionado.length > 0 || this.vencimientosDelDiaSeleccionado.length > 0) {
      this.mostrarDialogoDia = true;
    }
  }

  ngOnDestroy(): void {
    if (this.socketSub) {
      this.socketSub.unsubscribe();
    }
    this.dashboardSocket.disconnect();
  }
}