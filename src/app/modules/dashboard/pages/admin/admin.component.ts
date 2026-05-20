import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ChartModule } from 'primeng/chart';
import { FormsModule } from '@angular/forms';
import { DashboardService, AdminDashboardStats, UserDashboardStats } from '../../services/dashboard.service';
import { AuthService } from '../../../auth/services/auth.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, DatePipe, ChartModule, FormsModule],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.scss']
})
export class AdminComponent implements OnInit {
  stats: AdminDashboardStats | null = null;
  userStats: UserDashboardStats | null = null;
  cargando = true;
  esAdmin = false;

  // Variables para la Evaluación del Director
  mostrarEncuestaDirector = false;
  enviandoEvaluacion = false;
  evaluacionDirector = { rating: 0, comentario: '' };
  mensajeEvaluacion: { tipo: 'exito' | 'error', texto: string } | null = null;
  historialEvaluaciones: any[] = [];

  private dashboardService = inject(DashboardService);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

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
            // --- NORMALIZACIONES ROBUSTAS PARA EL DIRECTOR ---
            // El payload del director puede venir con nombres de propiedades variables.
            // Esta sección intenta unificar los datos para que la vista no se rompa.
            const statsPayload: any = data;

            // 1. Forzar estadísticas de las tarjetas (Stats Cards)
            this.userStats!.misProyectos = statsPayload.misProyectos 
                || statsPayload.proyectos
                || statsPayload.totalProyectos
                || statsPayload.totalProyectosArea 
                || statsPayload.proyectosArea 
                || 0;

            this.userStats!.misConvenios = statsPayload.misConvenios 
                || statsPayload.convenios
                || statsPayload.totalConvenios
                || statsPayload.totalConveniosArea 
                || statsPayload.conveniosArea 
                || 0;

            // El backend ahora lo puede llamar 'desempenoEquipo' o 'promedioEvaluacionDirector'
            this.userStats!.desempenoEquipoArea = statsPayload.desempenoEquipoArea 
                || statsPayload.desempenoEquipo 
                || statsPayload.promedioEvaluacionDirector
                || statsPayload.desempenoArea 
                || 0;

            this.userStats!.desempenoPersonal = 100; // El director siempre tiene 100% de desempeño

            // 2. Rescatar la Actividad Reciente sin importar el nombre que envíe el backend
            this.userStats!.actividadReciente = statsPayload.actividadReciente 
              || statsPayload.actividadesRecientes 
              || statsPayload.actividadesRecientesArea 
              || statsPayload.actividadRecienteArea
              || [];

            // 3. Rescatar datos para los gráficos (pueden venir en la raíz del payload)
            this.userStats!.estadisticasTareas = statsPayload.estadisticasTareas || statsPayload || {};
            this.userStats!.estadisticasComunicaciones = statsPayload.estadisticasComunicaciones || statsPayload || {};

            this.initDirectorCharts(this.userStats as UserDashboardStats);
            
            // Cargar el historial de evaluaciones del Director
            this.cargarHistorialEvaluaciones();
          }
        }
        this.cargando = false;
        this.cdr.detectChanges(); // Forzamos actualización visual de los gráficos
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
          beginAtZero: true,
          max: 100, // Fijar máximo a 100% para el Desempeño
          ticks: { color: textColorSecondary },
          grid: { color: surfaceBorder, drawBorder: false }
        }
      }
    };
  }

  initCharts(stats: AdminDashboardStats) {
    const t = stats.estadisticasTareas || {};
    const pendientes = Number((t as any).pendientes || 0);
    const progreso = Number((t as any).progreso || 0);
    const ejecucion = Number((t as any).ejecucion || 0);
    const completadas = Number((t as any).completadas || 0);
    const paralizado = Number((t as any).paralizado || 0);

    // 1. Gráfico Circular de Tareas
    this.tareasChartData = {
      labels: ['Pendiente', 'En Progreso / Revisión', 'En Ejecución', 'Completado', 'Paralizado / Otros'],
      datasets: [
        {
          data: [pendientes, progreso, ejecucion, completadas, paralizado],
          backgroundColor: ['#f59e0b', '#3b82f6', '#8b5cf6', '#10b981', '#64748b'],
          hoverBackgroundColor: ['#d97706', '#2563eb', '#7c3aed', '#059669', '#475569']
        }
      ]
    };

    const c = stats.estadisticasComunicaciones || {};
    const conPendiente = Number((c as any).pendiente || 0);
    const conProceso = Number((c as any).proceso || 0);
    const conFirmados = Number((c as any).firmados || 0);
    const conCancelados = Number((c as any).cancelados || 0);

    // 2. Gráfico Circular de Comunicaciones
    this.comunicacionesChartData = {
      labels: ['Pendiente', 'En Proceso / Negociación', 'Firmados', 'Cancelados / Otros'],
      datasets: [
        {
          data: [conPendiente, conProceso, conFirmados, conCancelados],
          backgroundColor: ['#f97316', '#eab308', '#22c55e', '#ef4444'],
          hoverBackgroundColor: ['#ea580c', '#ca8a04', '#16a34a', '#dc2626']
        }
      ]
    };

    // Forzar que la tarjeta superior muestre al menos los firmados si el backend no mandó el número
    if (this.stats && !this.stats.conveniosVigentes) {
      this.stats.conveniosVigentes = conFirmados;
    }
    // Forzar total proyectos
    if (this.stats && !this.stats.totalProyectos) {
      this.stats.totalProyectos = pendientes + progreso + ejecucion + completadas + paralizado;
    }

    // 3. Gráfico de Barras (Desempeño general de ejemplo)
    this.desempenoChartData = {
      labels: ['Desempeño Global'],
      datasets: [
        {
          label: 'Porcentaje (%)',
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
    const t = stats.estadisticasTareas || {};
    const pendientes = Number((t as any).pendientes || 0);
    const progreso = Number((t as any).progreso || 0);
    const ejecucion = Number((t as any).ejecucion || 0);
    const completadas = Number((t as any).completadas || 0);
    const paralizado = Number((t as any).paralizado || 0);

    this.tareasChartData = {
      labels: ['Pendiente', 'En Progreso / Revisión', 'En Ejecución', 'Completado', 'Paralizado / Otros'],
      datasets: [{
        data: [pendientes, progreso, ejecucion, completadas, paralizado],
        backgroundColor: ['#f59e0b', '#3b82f6', '#8b5cf6', '#10b981', '#64748b'],
        hoverBackgroundColor: ['#d97706', '#2563eb', '#7c3aed', '#059669', '#475569']
      }]
    };

    // --- 2. Gráfico de Comunicaciones/Convenios del Área ---
    const c = stats.estadisticasComunicaciones || {};
    const conPendiente = Number((c as any).pendiente || 0);
    const conProceso = Number((c as any).proceso || 0);
    const conFirmados = Number((c as any).firmados || 0);
    const conCancelados = Number((c as any).cancelados || 0);

    this.comunicacionesChartData = {
      labels: ['Pendiente', 'En Proceso / Negociación', 'Firmados', 'Cancelados / Otros'],
      datasets: [{
        data: [
          conPendiente, conProceso, conFirmados, conCancelados
        ],
        backgroundColor: ['#f97316', '#eab308', '#22c55e', '#ef4444'],
        hoverBackgroundColor: ['#ea580c', '#ca8a04', '#16a34a', '#dc2626']
      }]
    };

    // Forzar que la tarjeta superior muestre al menos los firmados si el backend no mandó el número
    if (this.userStats && !this.userStats.misConvenios) {
      this.userStats.misConvenios = conFirmados;
    }
    // Forzar proyectos área
    if (this.userStats && !this.userStats.misProyectos) {
      this.userStats.misProyectos = pendientes + progreso + ejecucion + completadas + paralizado;
    }

    // --- 3. Gráfico de Desempeño del Área ---
    this.desempenoChartData = {
      labels: ['Desempeño Equipo', 'Desempeño Personal'],
      datasets: [{
        label: 'Porcentaje (%)',
        data: [stats.desempenoEquipoArea || 0, stats.desempenoPersonal || 100],
        backgroundColor: ['#0ea5e9', '#8b5cf6'],
        borderRadius: 8
      }]
    };
  }

  // --- LÓGICA DE EVALUACIÓN DEL DIRECTOR ---

  abrirEncuesta() {
    this.mostrarEncuestaDirector = true;
    this.mensajeEvaluacion = null;
    this.evaluacionDirector = { rating: 0, comentario: '' };
  }

  setRating(estrellas: number) {
    this.evaluacionDirector.rating = estrellas;
  }

  enviarEvaluacion() {
    if (this.evaluacionDirector.rating < 1 || this.evaluacionDirector.rating > 5) {
      this.mensajeEvaluacion = { tipo: 'error', texto: 'Por favor, selecciona una calificación de 1 a 5 estrellas.' };
      return;
    }

    this.enviandoEvaluacion = true;
    this.mensajeEvaluacion = null;

    // Llamada al endpoint para registrar evaluación
    (this.dashboardService as any).createDirectorEvaluation(this.evaluacionDirector.rating, this.evaluacionDirector.comentario)
      .subscribe({
        next: () => {
          this.enviandoEvaluacion = false;
          this.mostrarEncuestaDirector = false;
          
          if (this.userStats) {
             // Actualizar visualmente el desempeño de equipo (1 estrella = 20%)
             this.userStats.desempenoEquipoArea = this.evaluacionDirector.rating * 20; 
             this.initDirectorCharts(this.userStats);
          }
          
          this.cargarHistorialEvaluaciones();
          this.cdr.detectChanges();
          // Puedes usar un toast de PrimeNG si lo deseas, o este alert para verificar que funciona.
          alert('Evaluación enviada exitosamente. ¡Gracias por tu tiempo!');
        },
        error: (err: any) => {
          this.enviandoEvaluacion = false;
          this.mensajeEvaluacion = { tipo: 'error', texto: 'Ocurrió un error al enviar la evaluación.' };
          console.error(err);
        }
      });
  }

  cargarHistorialEvaluaciones() {
    if (!this.esAdmin && (this.dashboardService as any).getDirectorEvaluations) {
      (this.dashboardService as any).getDirectorEvaluations().subscribe({
        next: (historial: any) => {
          this.historialEvaluaciones = historial;
          this.cdr.detectChanges();
        },
        error: (err: any) => console.error('Error cargando historial de evaluaciones', err)
      });
    }
  }

  /**
   * Limpia los textos provenientes del backend eliminando fragmentos como "(id=1)"
   */
  limpiarTexto(texto: string): string {
    if (!texto) return '';
    // Esta expresión regular busca un espacio opcional seguido de "(id=" un número y ")"
    // y lo reemplaza por una cadena vacía.
    return texto.replace(/\s*\(id=\d+\)/g, '');
  }
}
