import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ChartModule } from 'primeng/chart';
import { DashboardService, AdminDashboardStats, UserDashboardStats } from '../../services/dashboard.service';
import { AuthService } from '../../../auth/services/auth.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, DatePipe, ChartModule],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.scss']
})
export class AdminComponent implements OnInit {
  stats: AdminDashboardStats | null = null;
  userStats: UserDashboardStats | null = null;
  cargando = true;
  esAdmin = false;

  private dashboardService = inject(DashboardService);
  private authService = inject(AuthService);

  // Configuración de las gráficas
  tareasChartData: any;
  comunicacionesChartData: any;
  desempenoChartData: any;

  pieOptions: any;
  barOptions: any;

  ngOnInit(): void {
    this.initChartOptions();
    this.esAdmin = this.authService.isAdmin();

    this.dashboardService.getStatsForCurrentUser().subscribe({
      next: (data) => {
        if (this.esAdmin) {
          this.stats = data as AdminDashboardStats | null;
          if (data) {
            this.initCharts(data as AdminDashboardStats);
          }
        } else {
          this.userStats = data as UserDashboardStats | null;
          if (data) {
            this.initDirectorCharts(data as UserDashboardStats);
          }
        }
        this.cargando = false;
      },
      error: () => {
        this.cargando = false;
      }
    });
  }


  initChartOptions() {
    const documentStyle = getComputedStyle(document.documentElement);
    const textColor = documentStyle.getPropertyValue('--text-color') || '#495057';
    const textColorSecondary = documentStyle.getPropertyValue('--text-color-secondary') || '#6c757d';
    const surfaceBorder = documentStyle.getPropertyValue('--surface-border') || '#dfe7ef';

    this.pieOptions = {
      plugins: {
        legend: {
          labels: {
            color: textColor
          }
        }
      }
    };

    this.barOptions = {
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        x: {
          ticks: { color: textColorSecondary },
          grid: { color: surfaceBorder, drawBorder: false }
        },
        y: {
          ticks: { color: textColorSecondary },
          grid: { color: surfaceBorder, drawBorder: false }
        }
      }
    };
  }

  initCharts(stats: AdminDashboardStats) {
    // 1. Gráfico Circular de Tareas
    this.tareasChartData = {
      labels: ['Pendientes', 'Planificación', 'Ejecución', 'Completadas', 'Otros'],
      datasets: [
        {
          data: [
            stats.estadisticasTareas?.pendientes || 0,
            stats.estadisticasTareas?.planificacion || 0,
            stats.estadisticasTareas?.ejecucion || 0,
            stats.estadisticasTareas?.completadas || 0,
            stats.estadisticasTareas?.otros || 0
          ],
          backgroundColor: ['#f59e0b', '#3b82f6', '#8b5cf6', '#10b981', '#64748b'],
          hoverBackgroundColor: ['#d97706', '#2563eb', '#7c3aed', '#059669', '#475569']
        }
      ]
    };

    // 2. Gráfico Circular de Comunicaciones
    this.comunicacionesChartData = {
      labels: ['En Negociación', 'Firmados', 'Descartados', 'Otros'],
      datasets: [
        {
          data: [
            stats.estadisticasComunicaciones?.negociacion || 0,
            stats.estadisticasComunicaciones?.firmados || 0,
            stats.estadisticasComunicaciones?.descartados || 0,
            stats.estadisticasComunicaciones?.otros || 0
          ],
          backgroundColor: ['#eab308', '#22c55e', '#ef4444', '#94a3b8'],
          hoverBackgroundColor: ['#ca8a04', '#16a34a', '#dc2626', '#64748b']
        }
      ]
    };

    // 3. Gráfico de Barras (Desempeño general de ejemplo)
    this.desempenoChartData = {
      labels: ['Desempeño Global'],
      datasets: [
        {
          label: 'Porcentaje',
          data: [stats.desempenoEquipo || 0],
          backgroundColor: ['#0ea5e9'],
          borderRadius: 8
        }
      ]
    };
  }

  /** Deriva los datos de gráficas para el Director a partir de las tareas de su área */
  initDirectorCharts(stats: UserDashboardStats) {
    // --- 1. Gráfico de Tareas del Área ---
    // Si el backend ya devuelve conteos agrupados, se usan; si no, se cuentan del listado
    let pendientes = 0, planificacion = 0, ejecucion = 0, completadas = 0, otros = 0;

    if (stats.estadisticasTareas) {
      ({ pendientes, planificacion, ejecucion, completadas, otros } = stats.estadisticasTareas);
    } else {
      (stats.misTareasRecientes || []).forEach((t: any) => {
        const estado: string = t.estado || '';
        if (estado === 'PENDIENTE')        pendientes++;
        else if (estado === 'PLANIFICACION') planificacion++;
        else if (estado === 'EN_EJECUCION') ejecucion++;
        else if (estado === 'COMPLETADA')   completadas++;
        else                               otros++;
      });
    }

    this.tareasChartData = {
      labels: ['Pendientes', 'Planificación', 'Ejecución', 'Completadas', 'Otros'],
      datasets: [{
        data: [pendientes, planificacion, ejecucion, completadas, otros],
        backgroundColor: ['#f59e0b', '#3b82f6', '#8b5cf6', '#10b981', '#64748b'],
        hoverBackgroundColor: ['#d97706', '#2563eb', '#7c3aed', '#059669', '#475569']
      }]
    };

    // --- 2. Gráfico de Comunicaciones/Convenios del Área ---
    const com = stats.estadisticasComunicaciones;
    this.comunicacionesChartData = {
      labels: ['En Negociación', 'Firmados', 'Descartados', 'Otros'],
      datasets: [{
        data: [
          com?.negociacion || 0,
          com?.firmados    || 0,
          com?.descartados || 0,
          com?.otros       || 0
        ],
        backgroundColor: ['#eab308', '#22c55e', '#ef4444', '#94a3b8'],
        hoverBackgroundColor: ['#ca8a04', '#16a34a', '#dc2626', '#64748b']
      }]
    };

    // --- 3. Gráfico de Desempeño del Área ---
    this.desempenoChartData = {
      labels: ['Desempeño Equipo', 'Desempeño Personal'],
      datasets: [{
        label: 'Porcentaje',
        data: [stats.desempenoEquipoArea || 0, stats.desempenoPersonal || 0],
        backgroundColor: ['#0ea5e9', '#8b5cf6'],
        borderRadius: 8
      }]
    };
  }

}
