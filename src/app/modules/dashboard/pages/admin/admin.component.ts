import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ChartModule } from 'primeng/chart';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { DashboardService, AdminDashboardStats, UserDashboardStats } from '../../services/dashboard.service';
import { AuthService } from '../../../auth/services/auth.service';

interface DirectorUserEvaluation {
  id?: number | string;
  usuarioId?: number;
  nombre: string;
  puesto?: string;
  rol?: string;
  rating?: number;
  comentario?: string;
  fecha?: string;
  pendiente?: boolean;
  activo?: boolean;
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, DatePipe, ChartModule, FormsModule, DialogModule],
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
  usuariosParaEvaluar: DirectorUserEvaluation[] = [];
  usuarioSeleccionadoParaEvaluar: DirectorUserEvaluation | null = null;

  private dashboardService = inject(DashboardService);
  private authService = inject(AuthService);
  
  // Método público para usar en la plantilla
  isDirector(): boolean {
    return this.authService.isDirector();
  }
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
            // El payload del director puede venir con nombres de propiedades variables,
            // o puede estar anidado bajo `data`, `result` u otra envoltura.
            const statsPayload: any = this.normalizeBackendPayload(data);
            
            // 🔍 LOG DE DIAGNÓSTICO: Mostrar todo el payload para depuración
            console.log('📊 DIRECTOR DASHBOARD - Raw Backend Payload:', data);
            console.log('📊 DIRECTOR DASHBOARD - Normalized Payload:', statsPayload);
            console.log('📊 DIRECTOR DASHBOARD - Payload Keys:', Object.keys(statsPayload));
            console.log('📊 DIRECTOR DASHBOARD - estadisticasTareas:', statsPayload.estadisticasTareas);
            console.log('📊 DIRECTOR DASHBOARD - estadisticasComunicaciones:', statsPayload.estadisticasComunicaciones);

            const proyectosCount = this.getNumberFromPayload(statsPayload, [
              'misProyectos', 'mis_proyectos', 'proyectos', 'proyectosArea', 'proyectos_area', 'totalProyectos', 'total_proyectos', 'proyectos_count', 'proyectosTotales', 'proyectosRegistrados', 'proyectos_registrados'
            ]) || this.sumTaskCounts(statsPayload.estadisticasTareas || statsPayload || {});
            console.log('📊 DIRECTOR DASHBOARD - Proyectos Count Resolved:', proyectosCount);
            this.userStats!.misProyectos = proyectosCount || this.getNumberFromPayload(statsPayload, ['totalProyectos', 'total_proyectos', 'proyectosRegistrados', 'proyectos_registrados']) || 0;

            const conveniosCount = this.getNumberFromPayload(statsPayload, [
              'misConvenios', 'mis_convenios', 'convenios', 'conveniosArea', 'convenios_area', 'conveniosVigentes', 'convenios_vigentes', 'convenios_count', 'firmados', 'conveniosRegistrados', 'convenios_registrados'
            ]) || 0;
            this.userStats!.misConvenios = conveniosCount || this.getNumberFromPayload(statsPayload, ['conveniosVigentes', 'convenios_vigentes', 'convenios_count', 'firmados']) || 0;

            const promedioEvaluacion = this.getNumberFromPayload(statsPayload, [
              'promedioEvaluacionDirector', 'promedio_evaluacion_director', 'promedioEvaluacion', 'evaluacionPromedio', 'promedioCalificacion', 'calificacionPromedio'
            ]);
            const backendDesempenoEquipo = this.getNumberFromPayload(statsPayload, [
              'desempenoEquipo', 'desempeno_equipo', 'desempenoEquipoArea', 'desempenoArea', 'desempeno_equipo_area'
            ]);
            const hasBackendDesempenoEquipo = this.hasAnyKey(statsPayload, [
              'desempenoEquipo', 'desempeno_equipo', 'desempenoEquipoArea', 'desempenoArea', 'desempeno_equipo_area'
            ]);
            const desempenoEquipo = hasBackendDesempenoEquipo
              ? backendDesempenoEquipo
              : promedioEvaluacion
                ? promedioEvaluacion * 20
                : 0;
            this.userStats!.desempenoEquipo = desempenoEquipo;
            this.userStats!.desempenoEquipoArea = Number.isFinite(desempenoEquipo) ? Math.round(desempenoEquipo) : 0;
            if (!this.userStats!.promedioEvaluacionDirector && promedioEvaluacion) {
              this.userStats!.promedioEvaluacionDirector = promedioEvaluacion;
            }

            const hasBackendDesempenoPersonal = this.hasAnyKey(statsPayload, ['desempenoPersonal', 'desempeno_personal', 'desempenoPersonalArea', 'desempeno_personal_area']);
            
            // El desempeño de los directores siempre será 100% hasta que alguien superior los evalúe
            if (this.isDirector()) {
              this.userStats!.desempenoPersonal = 100;
            } else if (hasBackendDesempenoPersonal) {
              this.userStats!.desempenoPersonal = this.getNumberFromPayload(statsPayload, ['desempenoPersonal', 'desempeno_personal', 'desempenoPersonalArea', 'desempeno_personal_area']);
            }

            this.userStats!.actividadReciente = this.getArrayFromPayload(statsPayload, [
              'actividadReciente', 'actividadesRecientes', 'actividadesRecientesArea', 'actividadRecienteArea', 'actividades', 'actividad'
            ]);

            this.userStats!.estadisticasTareas = this.getObjectFromPayload(statsPayload, ['estadisticasTareas', 'tareas', 'estadoTareas', 'estadisticas_tareas']) || {};
            this.userStats!.estadisticasComunicaciones = this.getObjectFromPayload(statsPayload, ['estadisticasComunicaciones', 'comunicaciones', 'estadoComunicaciones', 'estadisticas_comunicaciones']) || {};
            this.usuariosParaEvaluar = this.parsePendingDirectorEvaluations(statsPayload);

            this.initDirectorCharts(this.userStats as UserDashboardStats);
            
            // Solo cargar pendientes concretos del director.
            this.cargarUsuariosPendientesDirector();
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
    const { pendientes, progreso, ejecucion, completadas, paralizado } = this.aggregateTaskCounts(t);

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
    const { pendientes, progreso, ejecucion, completadas, paralizado } = this.aggregateTaskCounts(t);

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
    const teamPerformance = stats.desempenoEquipo;
    const personalPerformance = stats.desempenoPersonal;
    const labels = ['Desempeño Equipo'];
    const data = [teamPerformance ?? 0];
    const backgroundColor = ['#0ea5e9'];

    if (personalPerformance !== undefined && personalPerformance !== null) {
      labels.push('Desempeño Personal');
      data.push(personalPerformance);
      backgroundColor.push('#8b5cf6');
    }

    this.desempenoChartData = {
      labels,
      datasets: [{
        label: 'Porcentaje (%)',
        data,
        backgroundColor,
        borderRadius: 8
      }]
    };
  }

  // --- LÓGICA DE EVALUACIÓN DEL DIRECTOR ---

  abrirEncuesta(usuario?: DirectorUserEvaluation) {
    this.mostrarEncuestaDirector = true;
    this.mensajeEvaluacion = null;
    this.evaluacionDirector = { rating: 0, comentario: '' };
    this.usuarioSeleccionadoParaEvaluar = usuario ?? null;
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

    const body: any = {
      rating: this.evaluacionDirector.rating,
      comentario: this.evaluacionDirector.comentario
    };
    if (this.usuarioSeleccionadoParaEvaluar?.usuarioId) {
      body.usuarioId = this.usuarioSeleccionadoParaEvaluar.usuarioId;
    } else if (this.usuarioSeleccionadoParaEvaluar?.id) {
      body.usuarioId = this.usuarioSeleccionadoParaEvaluar.id;
    }

    this.dashboardService.createDirectorEvaluation(body.rating, body.comentario, body.usuarioId as number | undefined)
      .subscribe({
        next: () => {
          this.enviandoEvaluacion = false;
          // Mostrar mensaje de éxito en lugar del alert feo
          this.mensajeEvaluacion = { tipo: 'exito', texto: 'Evaluación enviada exitosamente' };

          if (this.userStats) {
            this.userStats.desempenoEquipoArea = this.evaluacionDirector.rating * 20;
            this.initDirectorCharts(this.userStats);
          }

          if (this.usuarioSeleccionadoParaEvaluar) {
            const selected = this.usuarioSeleccionadoParaEvaluar;
            this.usuariosParaEvaluar = this.usuariosParaEvaluar.filter(u => !this.isSamePendingUser(u, selected));
          }
          
          this.cdr.detectChanges();

          // Cerrar el modal automáticamente después de 1.5 segundos
          setTimeout(() => {
            this.mostrarEncuestaDirector = false;
            this.usuarioSeleccionadoParaEvaluar = null;
            this.cdr.detectChanges();
          }, 1500);
        },
        error: (err: any) => {
          this.enviandoEvaluacion = false;
          this.mensajeEvaluacion = { tipo: 'error', texto: 'Ocurrió un error al enviar la evaluación.' };
          console.error(err);
        }
      });
  }

  cargarHistorialEvaluaciones() {
    if (!this.esAdmin && this.dashboardService.getDirectorEvaluations) {
      this.dashboardService.getDirectorEvaluations().subscribe({
        next: (response: any) => {
          const historial = response?.directorEvaluations || response?.data || response || [];
          this.historialEvaluaciones = Array.isArray(historial)
            ? historial.map((item: any) => this.normalizeEvaluationHistoryItem(item)).filter((item: any) => !!item.usuarioEvaluado)
            : [];
          this.cdr.detectChanges();
        },
        error: (err: any) => console.error('Error cargando historial de evaluaciones', err)
      });
    }
  }

  cargarUsuariosPendientesDirector() {
    if (!this.isDirector()) {
      return;
    }

    console.log('🔄 Fetching pending users (direct endpoint)');
    this.dashboardService.getDirectorPendingUsers().subscribe({
      next: (usuarios: any) => {
        // Aceptar cualquier forma de payload que el backend retorne:
        // - lista directa (array)
        // - objeto con propiedades (ej. { pendientes: [...] })
        console.log('✅ Director pending users RAW payload:', usuarios);
        console.log('✅ Payload type:', typeof usuarios, 'Is Array:', Array.isArray(usuarios));
        if (usuarios && typeof usuarios === 'object' && !Array.isArray(usuarios)) {
          console.log('✅ Payload keys:', Object.keys(usuarios));
        }
        this.usuariosParaEvaluar = this.parsePendingDirectorEvaluations(usuarios);
        console.log('✅ Parsed pending users:', this.usuariosParaEvaluar);
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('❌ Error cargando usuarios pendientes del director', err);
      }
    });
  }

  private parsePendingDirectorEvaluations(statsPayload: any): DirectorUserEvaluation[] {
    statsPayload = this.normalizeBackendPayload(statsPayload);

    // El backend indica que la propiedad correcta a leer es 'pendientesEvaluacion'
    let source = statsPayload.pendientesEvaluacion 
      || statsPayload.directorPendingEvaluations 
      || statsPayload.pendientes 
      || statsPayload;

    if (source && typeof source === 'object' && !Array.isArray(source)) {
      source = source.pendientesEvaluacion || source.data || source.items || source.lista || source.usuarios || [];
    }

    if (!Array.isArray(source)) {
      return [];
    }

    const mapped = source.map((item: any) => {
      const usuarioInfo = item.usuario || item.usuarioInfo || item.persona || {};
      const nombre = item.nombre || item.nombreCompleto || item.usuario || item.usuarioNombre || item.nombreUsuario || usuarioInfo?.nombreCompleto || usuarioInfo?.nombre || item.email || 'Usuario sin nombre';
      const puesto = item.puesto || item.cargo || item.area || item.areaEquipo || item.rolNombre || item.rol || usuarioInfo?.rol || usuarioInfo?.role || '';
      const rating = this.getNumberFromPayload(item, ['rating', 'promedioEvaluacionDirector', 'promedioEvaluacion', 'ultimaCalificacion', 'calificacion', 'ratingPromedio']);
      const role = item.rol || item.role || item.rolNombre || item.rolUsuario || item.rol_usuario || item.tipo || item.tipoUsuario || item.puesto || item.cargo || usuarioInfo?.rol || usuarioInfo?.role || '';
      const isActive = item.activo !== undefined
        ? item.activo === true
        : item.estado !== undefined
          ? item.estado.toString().toLowerCase() !== 'inactivo'
          : true;

      return {
        pendiente: true, // Si el backend lo manda aquí, es porque está pendiente según el propio backend
        id: item.id ?? item.usuarioId ?? item.userId ?? item.usuario_id ?? item.targetId ?? item.target_user_id,
        usuarioId: item.usuarioId ? Number(item.usuarioId) : item.userId ? Number(item.userId) : item.usuario_id ? Number(item.usuario_id) : item.id ? Number(item.id) : undefined,
        nombre,
        puesto,
        rating: rating || undefined,
        comentario: item.comentario || item.ultimoComentario || item.descripcion || item.mensaje || undefined,
        fecha: item.fecha || item.ultimaFecha || item.createdAt || item.updatedAt || undefined,
        rol: role,
        activo: isActive
      };

    });

    const unique = mapped.reduce((acc: DirectorUserEvaluation[], item) => {
      // El backend ya filtra, no aplicamos 'isNonEvaluableUser'. Solo descartamos si no hay nombre.
      if (!item.nombre || !item.activo) {
        return acc;
      }

      const exists = acc.some(existing => this.isSamePendingUser(existing, item));
      if (!exists) {
        acc.push(item);
      }
      return acc;
    }, [] as DirectorUserEvaluation[]);

    return unique;
  }

  private getNumberFromPayload(payload: any, keys: string[]): number {
    if (!payload || typeof payload !== 'object') {
      return 0;
    }

    for (const key of keys) {
      let value = payload[key];

      // Intentar convertir de texto a número si es necesario
      if (typeof value === 'string' && value.trim() !== '') {
        const num = Number(value);
        if (Number.isFinite(num)) value = num;
      }

      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }
      if (value && typeof value === 'object') {
        let count = value.count;
        if (typeof count === 'string') count = Number(count);
        if (typeof count === 'number' && Number.isFinite(count)) {
          return count;
        }
        let total = value.total;
        if (typeof total === 'string') total = Number(total);
        if (typeof total === 'number' && Number.isFinite(total)) {
          return total;
        }
      }
    }

    return 0;
  }

  private getArrayFromPayload(payload: any, keys: string[]): any[] {
    if (!payload || typeof payload !== 'object') {
      return [];
    }

    for (const key of keys) {
      const value = payload[key];
      if (Array.isArray(value)) {
        return value;
      }
    }

    return [];
  }

  private getObjectFromPayload(payload: any, keys: string[]): any {
    if (!payload || typeof payload !== 'object') {
      return null;
    }

    payload = this.normalizeBackendPayload(payload);

    for (const key of keys) {
      const value = payload[key];
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value;
      }
    }

    return null;
  }

  private hasAnyKey(payload: any, keys: string[]): boolean {
    if (!payload || typeof payload !== 'object') {
      return false;
    }

    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(payload, key)) {
        return true;
      }
    }
    return false;
  }

  private isNonEvaluableUser(item: any): boolean {
    const role = (item.rol || item.role || item.cargo || item.puesto || item.rolUsuario || item.rol_usuario || item.tipo || item.tipoUsuario || '')?.toString().toLowerCase();
    if (!role) {
      return false;
    }

    return ['admin', 'administrador', 'super admin', 'superadmin', 'director'].some(blocked => role.includes(blocked));
  }

  private isSamePendingUser(first: DirectorUserEvaluation, second: DirectorUserEvaluation): boolean {
    if (first.id !== undefined && second.id !== undefined && String(first.id) === String(second.id)) {
      return true;
    }
    if (first.usuarioId !== undefined && second.usuarioId !== undefined && first.usuarioId === second.usuarioId) {
      return true;
    }
    return false;
  }

  private normalizeEvaluationHistoryItem(item: any): any {
    const usuarioEvaluado = item.usuario || item.nombre || item.nombreCompleto || item.usuarioNombre || item.nombreUsuario || item.targetName || item.target || item.nombre_completo || item.usuario?.nombre || item.usuario?.nombreCompleto || '';
    return {
      ...item,
      usuarioEvaluado: usuarioEvaluado || '',
      usuarioId: item.usuarioId ?? item.userId ?? item.usuario_id ?? item.targetId ?? item.target_user_id ?? undefined
    };
  }

  private normalizeBackendPayload(payload: any): any {
    if (!payload || typeof payload !== 'object') {
      return {};
    }

    return payload.data || payload.result || payload.payload || payload;
  }

  private sumTaskCounts(statsPayload: any): number {
    const ag = this.aggregateTaskCounts(statsPayload);
    return ag.pendientes + ag.progreso + ag.ejecucion + ag.completadas + ag.paralizado;
  }

  /** Agrega soporte para sumar conteos desde namespaces como desarrollo_actividades, estrategia_actividades, analisis_tareas */
  private aggregateTaskCounts(statsPayload: any) {
    const result = { pendientes: 0, progreso: 0, ejecucion: 0, completadas: 0, paralizado: 0 };
    let hasDirectCounts = false;

    const addFrom = (obj: any) => {
      if (!obj) return;
      // Normalizamos las claves. Todas las variantes se mapearán a uno de nuestros 5 estados base.
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
          if (!isNaN(val)) {
            hasDirectCounts = true;
            if (['proceso', 'en_proceso', 'progreso', 'en_progreso', 'planificacion', 'planificación', 'revision', 'en_revision'].includes(k)) {
              result.progreso += val;
            } else if (['completadas', 'completado', 'terminado', 'finalizado'].includes(k)) {
              result.completadas += val;
            } else if (['ejecucion', 'ejecución', 'en_ejecucion', 'en_ejecución'].includes(k)) {
              result.ejecucion += val;
            } else if (['paralizado', 'otros', 'pausado', 'cancelado'].includes(k)) {
              result.paralizado += val;
            } else if (['pendientes', 'pendiente'].includes(k)) {
              result.pendientes += val;
            }
          }
        }
      }

      // Casos de respaldo
      if (typeof obj === 'number' && !isNaN(obj)) {
        hasDirectCounts = true;
        result.ejecucion += Number(obj);
      }
      if (Array.isArray(obj)) {
        hasDirectCounts = true;
        result.ejecucion += obj.length;
      }
    };

    // 1. Intentamos leer los conteos directamente en el objeto (modo normalizado)
    addFrom(statsPayload);

    // 2. Si no hay propiedades directas, intentamos buscar en los namespaces antiguos
    if (!hasDirectCounts && typeof statsPayload === 'object') {
      for (const ns of ['desarrollo_actividades', 'estrategia_actividades', 'analisis_tareas']) {
        if (statsPayload[ns]) {
          addFrom(statsPayload[ns]);
        }
      }
    }

    return result;
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
