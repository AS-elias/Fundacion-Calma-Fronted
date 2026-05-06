import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize, forkJoin, of, switchMap } from 'rxjs';
import { AuthService } from '../../auth/services/auth.service';
import { EstrategiaComercialService } from './estrategia-comercial.service';

type VistaEstrategia = 'actividades' | 'proyectos';
type EstadoActividad =
  | 'Pendiente'
  | 'En progreso'
  | 'En revision'
  | 'En ejecucion'
  | 'Finalizado'
  | 'Paralizado'
  | 'Completado';
type EstadoProyecto = 'Pendiente' | 'En Progreso' | 'Completada' | 'Paralizado';
type FiltroProyecto = 'todos' | 'pendiente' | 'en-progreso' | 'completada' | 'paralizado';
type PrioridadActividad = 'Alta' | 'Media' | 'Baja';
type TipoNotificacion = 'success' | 'error';

type ActividadEnlace = {
  id?: string | number;
  nombre: string;
  url: string;
};

type ActividadKanban = {
  id: string;
  titulo: string;
  descripcion: string;
  estado: EstadoActividad;
  creadoPor: string;
  prioridad: PrioridadActividad;
  fechaCreacion: string;
  fechaLimite?: string;
  enlaces: ActividadEnlace[];
};

type ActividadForm = {
  titulo: string;
  descripcion: string;
  estado: EstadoActividad;
  responsable: string;
  prioridad: PrioridadActividad;
  fechaLimite: string;
  enlaces: ActividadEnlace[];
};

type ProyectoEnlace = {
  id?: string | number;
  etiqueta: string;
  url: string;
};

type ProyectoEmpresa = {
  id: string;
  titulo: string;
  descripcion: string;
  estado: EstadoProyecto;
  fechaLimite: string;
  enlaces: ProyectoEnlace[];
};

type EmpresaProyecto = {
  id: string;
  nombre: string;
  descripcion: string;
  expandida: boolean;
  proyectos: ProyectoEmpresa[];
};

type EmpresaProyectoVista = {
  empresa: EmpresaProyecto;
  proyectos: ProyectoEmpresa[];
};

type EmpresaForm = {
  nombre: string;
  descripcion: string;
};

type ProyectoForm = {
  titulo: string;
  descripcion: string;
  estado: EstadoProyecto;
  fechaLimite: string;
  enlaces: ProyectoEnlace[];
};

type ColumnaKanban = {
  estado: EstadoActividad;
  clase: string;
  icono: string;
  etiqueta: string;
};

type NotificacionToast = {
  tipo: TipoNotificacion;
  mensaje: string;
};

type ConfirmacionEliminacion =
  {
    tipo: 'empresa';
    empresaId: string;
    titulo: string;
    mensaje: string;
    detalle: string;
  };

@Component({
  selector: 'app-estrategia-comercial',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './estrategia-comercial.html',
  styleUrls: ['./estrategia-comercial.scss'],
})
export class EstrategiaComercial implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private estrategiaService = inject(EstrategiaComercialService);
  private notificationTimeoutId?: number;
  readonly nombreUsuarioActual = this.authService.getCurrentUser()?.nombre?.trim() || 'Usuario';

  vistaActiva: VistaEstrategia = 'actividades';
  busquedaProyecto = '';
  filtroProyecto: FiltroProyecto = 'todos';
  modalDetalleActividadAbierto = false;
  modalNuevaActividadAbierto = false;
  actividadEditandoId: string | null = null;
  guardandoActividad = false;
  actividadSeleccionada: ActividadKanban | null = null;
  actividadForm: ActividadForm = this.crearActividadForm('Pendiente');
  modalEmpresaAbierto = false;
  empresaEditandoId: string | null = null;
  empresaForm: EmpresaForm = this.crearEmpresaForm();
  modalProyectoAbierto = false;
  empresaProyectoActivaId: string | null = null;
  proyectoEditandoId: string | null = null;
  proyectoForm: ProyectoForm = this.crearProyectoForm();
  modalDetalleProyectoAbierto = false;
  empresaSeleccionada: EmpresaProyecto | null = null;
  proyectoSeleccionado: ProyectoEmpresa | null = null;
  confirmacionEliminacion: ConfirmacionEliminacion | null = null;
  notificacion: NotificacionToast | null = null;

  readonly prioridadesActividad: PrioridadActividad[] = ['Alta', 'Media', 'Baja'];

  readonly columnas: ColumnaKanban[] = [
    { estado: 'Pendiente', clase: 'pendiente', icono: 'pi pi-clock', etiqueta: 'Pendiente' },
    { estado: 'En progreso', clase: 'progreso', icono: 'pi pi-clock', etiqueta: 'En progreso' },
    { estado: 'En revision', clase: 'revision', icono: 'pi pi-clock', etiqueta: 'En revisión' },
    { estado: 'En ejecucion', clase: 'ejecucion', icono: 'pi pi-clock', etiqueta: 'En ejecución' },
    { estado: 'Finalizado', clase: 'finalizado', icono: 'pi pi-clock', etiqueta: 'Finalizado' },
    { estado: 'Paralizado', clase: 'paralizado', icono: 'pi pi-clock', etiqueta: 'Paralizado' },
    { estado: 'Completado', clase: 'completado', icono: 'pi pi-check-circle', etiqueta: 'Completado' },
  ];

  actividades: ActividadKanban[] = [
    {
      id: 'a1',
      titulo: 'Red nacional de voluntariado',
      descripcion: 'Construir la primera red de voluntariado de la Fundacion Calma.',
      estado: 'Pendiente',
      creadoPor: this.nombreUsuarioActual,
      prioridad: 'Media',
      fechaCreacion: '21/04/2026',
      fechaLimite: '',
      enlaces: [],
    },
    {
      id: 'a2',
      titulo: 'Estrategia de marca comercial',
      descripcion: '',
      estado: 'Completado',
      creadoPor: this.nombreUsuarioActual,
      prioridad: 'Media',
      fechaCreacion: '21/04/2026',
      fechaLimite: '',
      enlaces: [],
    },
  ];

  empresas: EmpresaProyecto[] = [
    {
      id: 'e1',
      nombre: 'Tayloy',
      descripcion: 'Retail de suministros escolares y oficinas',
      expandida: false,
      proyectos: [
        {
          id: 'p1',
          titulo: 'Campana Escolar 2026',
          descripcion: 'Alianza comercial para acciones de retorno a clases.',
          estado: 'Pendiente',
          fechaLimite: '2026-04-19',
          enlaces: [
            {
              etiqueta: 'Cronograma de taller',
              url: 'https://example.com/cronograma-escolar',
            },
          ],
        },
      ],
    },
    {
      id: 'e2',
      nombre: 'EduFutura',
      descripcion: 'Capacitaciones y talleres educativos',
      expandida: true,
      proyectos: [
        {
          id: 'p2',
          titulo: 'Taller Virtual Docentes',
          descripcion: 'Serie de talleres virtuales para docentes',
          estado: 'Pendiente',
          fechaLimite: '2026-04-19',
          enlaces: [
            {
              etiqueta: 'Cronograma de taller',
              url: 'https://example.com/taller-docentes-1',
            },
            {
              etiqueta: 'Material de apoyo',
              url: 'https://example.com/material-docentes-1',
            },
          ],
        },
        {
          id: 'p3',
          titulo: 'Taller Virtual Docentes',
          descripcion: 'Serie de talleres virtuales para docentes',
          estado: 'En Progreso',
          fechaLimite: '2026-04-19',
          enlaces: [
            {
              etiqueta: 'Cronograma de taller',
              url: 'https://example.com/taller-docentes-2',
            },
            {
              etiqueta: 'Lista de asistencia',
              url: 'https://example.com/asistencia-docentes',
            },
            {
              etiqueta: 'Reporte semanal',
              url: 'https://example.com/reporte-docentes',
            },
          ],
        },
        {
          id: 'p4',
          titulo: 'Taller Virtual Docentes',
          descripcion: 'Serie de talleres virtuales para docentes',
          estado: 'Completada',
          fechaLimite: '2026-04-19',
          enlaces: [
            {
              etiqueta: 'Cronograma de taller',
              url: 'https://example.com/taller-docentes-3',
            },
            {
              etiqueta: 'Evidencias',
              url: 'https://example.com/evidencias-docentes',
            },
            {
              etiqueta: 'Informe final',
              url: 'https://example.com/informe-docentes',
            },
          ],
        },
      ],
    },
  ];

  ngOnInit(): void {
    this.cargarDatosBackend();
  }

  ngOnDestroy(): void {
    this.limpiarNotificacionProgramada();
  }

  cambiarVista(vista: VistaEstrategia): void {
    this.vistaActiva = vista;
  }

  actividadesPorEstado(estado: EstadoActividad): ActividadKanban[] {
    return this.actividades.filter((actividad) => actividad.estado === estado);
  }

  abrirModalNuevaActividad(estado: EstadoActividad): void {
    this.actividadEditandoId = null;
    this.actividadForm = this.crearActividadForm(estado);
    this.modalNuevaActividadAbierto = true;
  }

  cerrarModalNuevaActividad(forzar = false): void {
    if (this.guardandoActividad && !forzar) return;

    this.modalNuevaActividadAbierto = false;
    this.actividadEditandoId = null;
  }

  verDetalleActividad(actividad: ActividadKanban): void {
    this.actividadSeleccionada = actividad;
    this.modalDetalleActividadAbierto = true;
  }

  cerrarDetalleActividad(): void {
    this.modalDetalleActividadAbierto = false;
    this.actividadSeleccionada = null;
  }

  editarActividadSeleccionada(): void {
    if (!this.actividadSeleccionada) return;

    this.actividadEditandoId = this.actividadSeleccionada.id;
    this.actividadForm = {
      titulo: this.actividadSeleccionada.titulo,
      descripcion: this.actividadSeleccionada.descripcion,
      estado: this.actividadSeleccionada.estado,
      responsable: this.actividadSeleccionada.creadoPor,
      prioridad: this.actividadSeleccionada.prioridad,
      fechaLimite: this.actividadSeleccionada.fechaLimite || '',
      enlaces: this.clonarEnlaces(this.actividadSeleccionada.enlaces),
    };

    this.cerrarDetalleActividad();
    this.modalNuevaActividadAbierto = true;
  }

  agregarEnlaceActividad(): void {
    this.actividadForm.enlaces.push({ nombre: '', url: '' });
  }

  crearActividad(): void {
    if (this.guardandoActividad) return;

    const titulo = this.actividadForm.titulo.trim();
    if (!titulo) return;

    const descripcion = this.actividadForm.descripcion.trim();
    const fechaLimite = this.actividadForm.fechaLimite.trim();
    const enlaces = this.actividadForm.enlaces
      .map((enlace) => ({
        nombre: enlace.nombre.trim(),
        url: enlace.url.trim(),
      }))
      .filter((enlace) => enlace.nombre || enlace.url);

    if (this.actividadEditandoId) {
      this.guardandoActividad = true;
      this.estrategiaService
        .updateActividad(this.actividadEditandoId, {
          titulo,
          descripcion,
          estado: this.toEstadoActividadApi(this.actividadForm.estado),
          creado_por: this.actividadForm.responsable,
          prioridad: this.actividadForm.prioridad,
          fecha_limite: fechaLimite || null,
        })
        .pipe(
          switchMap((actividad) =>
            this.guardarEnlacesActividad(actividad?.id ?? this.actividadEditandoId, enlaces),
          ),
          finalize(() => {
            this.guardandoActividad = false;
          }),
        )
        .subscribe({
          next: () => {
            this.cerrarModalNuevaActividad(true);
            this.modalDetalleActividadAbierto = true;
            this.cargarActividades();
            this.mostrarNotificacion('success', 'Los cambios de la actividad se guardaron correctamente.');
          },
          error: () => this.mostrarNotificacion('error', 'No se pudo guardar la actividad.'),
        });
      return;
    }

    this.guardandoActividad = true;
    this.estrategiaService
      .createActividad({
        titulo,
        descripcion,
        estado: this.toEstadoActividadApi(this.actividadForm.estado),
        creado_por: this.nombreUsuarioActual,
        prioridad: this.actividadForm.prioridad,
        fecha_creacion: this.fechaIsoActual(),
        fecha_limite: fechaLimite || null,
      })
      .pipe(
        switchMap((actividad) => this.guardarEnlacesActividad(actividad?.id, enlaces)),
        finalize(() => {
          this.guardandoActividad = false;
        }),
      )
      .subscribe({
        next: () => {
          this.cerrarModalNuevaActividad(true);
          this.cargarActividades();
          this.mostrarNotificacion('success', 'La actividad se creó correctamente.');
        },
        error: () => this.mostrarNotificacion('error', 'No se pudo crear la actividad.'),
      });

  }

  abrirModalNuevaEmpresa(): void {
    this.empresaEditandoId = null;
    this.empresaForm = this.crearEmpresaForm();
    this.modalEmpresaAbierto = true;
  }

  editarEmpresa(empresa: EmpresaProyecto): void {
    this.empresaEditandoId = empresa.id;
    this.empresaForm = {
      nombre: empresa.nombre,
      descripcion: empresa.descripcion,
    };
    this.modalEmpresaAbierto = true;
  }

  cerrarModalEmpresa(): void {
    this.modalEmpresaAbierto = false;
    this.empresaEditandoId = null;
  }

  guardarEmpresa(): void {
    const nombre = this.empresaForm.nombre.trim();
    if (!nombre) return;

    const descripcion = this.empresaForm.descripcion.trim();

    if (this.empresaEditandoId) {
      this.estrategiaService.updateEmpresa(this.empresaEditandoId, { nombre, descripcion }).subscribe({
        next: () => {
          this.cerrarModalEmpresa();
          this.cargarEmpresasYProyectos();
          this.mostrarNotificacion('success', 'Los cambios de la empresa se guardaron correctamente.');
        },
        error: () => this.mostrarNotificacion('error', 'No se pudo guardar la empresa.'),
      });
      return;
    }

    this.estrategiaService.createEmpresa({ nombre, descripcion }).subscribe({
      next: () => {
        this.cerrarModalEmpresa();
        this.cargarEmpresasYProyectos();
        this.mostrarNotificacion('success', 'La empresa se creó correctamente.');
      },
      error: () => this.mostrarNotificacion('error', 'No se pudo crear la empresa.'),
    });

  }

  pedirConfirmarEliminacionEmpresa(empresa: EmpresaProyecto): void {
    if (empresa.proyectos.length > 0) {
      this.mostrarNotificacion('error', 'Solo puedes eliminar la empresa cuando no tiene proyectos.');
      return;
    }

    this.confirmacionEliminacion = {
      tipo: 'empresa',
      empresaId: empresa.id,
      titulo: '¿Eliminar empresa?',
      mensaje: `¿Estás seguro de que deseas eliminar la empresa "${empresa.nombre}"?`,
      detalle: 'Esta acción no se puede deshacer.',
    };
  }

  eliminarEmpresa(empresaId: string): void {
    const indice = this.empresas.findIndex((item) => item.id === empresaId);
    if (indice === -1) return;

    const empresa = this.empresas[indice];
    if (empresa.proyectos.length > 0) {
      this.mostrarNotificacion('error', 'Solo puedes eliminar la empresa cuando no tiene proyectos.');
      this.confirmacionEliminacion = null;
      return;
    }

    this.estrategiaService.deleteEmpresa(empresaId).subscribe({
      next: () => {
        this.confirmacionEliminacion = null;
        this.cargarEmpresasYProyectos();
        this.mostrarNotificacion('success', 'La empresa se eliminó correctamente.');

        if (this.empresaSeleccionada?.id === empresaId) {
          this.cerrarDetalleProyecto();
        }
      },
      error: () => this.mostrarNotificacion('error', 'No se pudo eliminar la empresa.'),
    });
  }

  toggleEmpresa(empresa: EmpresaProyecto): void {
    const empresaActual = this.buscarEmpresaPorId(empresa.id);
    if (!empresaActual) return;

    empresaActual.expandida = !empresaActual.expandida;
  }

  abrirModalNuevoProyecto(empresa: EmpresaProyecto): void {
    this.empresaProyectoActivaId = empresa.id;
    this.proyectoEditandoId = null;
    this.proyectoForm = this.crearProyectoForm();
    this.modalProyectoAbierto = true;
  }

  editarProyecto(empresa: EmpresaProyecto, proyecto: ProyectoEmpresa): void {
    this.empresaProyectoActivaId = empresa.id;
    this.proyectoEditandoId = proyecto.id;
    this.proyectoForm = {
      titulo: proyecto.titulo,
      descripcion: proyecto.descripcion,
      estado: proyecto.estado,
      fechaLimite: proyecto.fechaLimite,
      enlaces: this.clonarEnlacesProyecto(proyecto.enlaces),
    };
    this.modalProyectoAbierto = true;
  }

  cerrarModalProyecto(): void {
    this.modalProyectoAbierto = false;
    this.empresaProyectoActivaId = null;
    this.proyectoEditandoId = null;
  }

  agregarEnlaceProyecto(): void {
    this.proyectoForm.enlaces.push({ etiqueta: '', url: '' });
  }

  guardarProyecto(): void {
    const empresa = this.empresaProyectoActivaId
      ? this.buscarEmpresaPorId(this.empresaProyectoActivaId)
      : null;
    const titulo = this.proyectoForm.titulo.trim();
    if (!empresa || !titulo) return;

    const descripcion = this.proyectoForm.descripcion.trim();
    const enlaces = this.proyectoForm.enlaces
      .map((enlace) => ({
        etiqueta: enlace.etiqueta.trim(),
        url: enlace.url.trim(),
      }))
      .filter((enlace) => enlace.etiqueta || enlace.url);

    if (this.proyectoEditandoId) {
      this.estrategiaService
        .updateProyecto(this.proyectoEditandoId, {
          empresa_id: empresa.id,
          titulo,
          descripcion,
          estado: this.toEstadoProyectoApi(this.proyectoForm.estado),
          fecha_limite: this.proyectoForm.fechaLimite || null,
        })
        .pipe(
          switchMap((proyecto) =>
            this.guardarEnlacesProyecto(proyecto?.id ?? this.proyectoEditandoId, enlaces),
          ),
        )
        .subscribe({
          next: () => {
            this.cerrarModalProyecto();
            this.modalDetalleProyectoAbierto = true;
            this.cargarEmpresasYProyectos();
            this.mostrarNotificacion('success', 'Los cambios del proyecto se guardaron correctamente.');
          },
          error: () => this.mostrarNotificacion('error', 'No se pudo guardar el proyecto.'),
        });
      return;
    }

    this.estrategiaService
      .createProyecto({
        empresa_id: empresa.id,
        titulo,
        descripcion,
        estado: this.toEstadoProyectoApi(this.proyectoForm.estado),
        fecha_limite: this.proyectoForm.fechaLimite || null,
      })
      .pipe(switchMap((proyecto) => this.guardarEnlacesProyecto(proyecto?.id, enlaces)))
      .subscribe({
        next: () => {
          this.cerrarModalProyecto();
          this.cargarEmpresasYProyectos();
          this.mostrarNotificacion('success', 'El proyecto se creó correctamente.');
        },
        error: () => this.mostrarNotificacion('error', 'No se pudo crear el proyecto.'),
      });

  }

  verDetalleProyecto(empresa: EmpresaProyecto, proyecto: ProyectoEmpresa): void {
    this.empresaSeleccionada = empresa;
    this.proyectoSeleccionado = proyecto;
    this.modalDetalleProyectoAbierto = true;
  }

  cerrarDetalleProyecto(): void {
    this.modalDetalleProyectoAbierto = false;
    this.empresaSeleccionada = null;
    this.proyectoSeleccionado = null;
  }

  editarProyectoSeleccionado(): void {
    if (!this.empresaSeleccionada || !this.proyectoSeleccionado) return;

    this.editarProyecto(this.empresaSeleccionada, this.proyectoSeleccionado);
    this.cerrarDetalleProyecto();
  }

  cancelarConfirmacionEliminacion(): void {
    this.confirmacionEliminacion = null;
  }

  confirmarEliminacion(): void {
    if (!this.confirmacionEliminacion) return;

    this.eliminarEmpresa(this.confirmacionEliminacion.empresaId);
  }

  abrirEnlaceProyecto(enlace: ProyectoEnlace): void {
    if (!enlace.url) return;
    window.open(enlace.url, '_blank', 'noopener,noreferrer');
  }

  formatearFechaProyecto(fecha: string): string {
    if (!fecha) return 'Sin fecha';

    const [anio, mes, dia] = fecha.split('-').map(Number);
    if (!anio || !mes || !dia) return fecha;

    const fechaProyecto = new Date(anio, mes - 1, dia);
    return new Intl.DateTimeFormat('es-PE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(fechaProyecto);
  }

  toggleEmpresaDesdeResumen(empresa: EmpresaProyecto): void {
    this.toggleEmpresa(empresa);
  }

  totalProyectos(empresa: EmpresaProyecto): number {
    return empresa.proyectos.length;
  }

  toggleEmpresaDesdeTeclado(event: KeyboardEvent, empresa: EmpresaProyecto): void {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    this.toggleEmpresa(empresa);
  }

  proyectosLabel(empresa: EmpresaProyecto): string {
    const total = this.totalProyectos(empresa);
    return `${total} Proyecto${total === 1 ? '' : 's'}`;
  }

  get empresasFiltradas(): EmpresaProyectoVista[] {
    const busqueda = this.normalizar(this.busquedaProyecto);

    return this.empresas
      .map((empresa) => {
        const coincideEmpresa =
          !busqueda ||
          this.normalizar(empresa.nombre).includes(busqueda) ||
          this.normalizar(empresa.descripcion).includes(busqueda);
        const proyectos = empresa.proyectos.filter((proyecto) => {
          const coincideFiltro =
            this.filtroProyecto === 'todos' ||
            this.filtroProyecto === this.estadoProyectoClase(proyecto.estado);
          const coincideBusqueda =
            coincideEmpresa ||
            this.normalizar(proyecto.titulo).includes(busqueda) ||
            this.normalizar(proyecto.descripcion).includes(busqueda) ||
            proyecto.enlaces.some(
              (enlace) =>
                this.normalizar(enlace.etiqueta).includes(busqueda) ||
                this.normalizar(enlace.url).includes(busqueda),
            );

          return coincideFiltro && coincideBusqueda;
        });

        return { empresa, proyectos };
      })
      .filter(({ empresa, proyectos }) => {
        if (this.filtroProyecto !== 'todos' && !proyectos.length) return false;
        if (!busqueda) return true;

        return (
          this.normalizar(empresa.nombre).includes(busqueda) ||
          this.normalizar(empresa.descripcion).includes(busqueda) ||
          proyectos.length > 0
        );
      });
  }

  estadoProyectoClase(estado: EstadoProyecto): string {
    if (estado === 'En Progreso') return 'en-progreso';
    if (estado === 'Completada') return 'completada';
    if (estado === 'Paralizado') return 'paralizado';
    return 'pendiente';
  }

  prioridadClase(prioridad: PrioridadActividad): string {
    return prioridad.toLowerCase();
  }

  etiquetaEstado(estado: EstadoActividad): string {
    return this.columnas.find((columna) => columna.estado === estado)?.etiqueta || estado;
  }

  inicialCreador(nombre: string): string {
    return (nombre || '?').trim().charAt(0).toUpperCase() || '?';
  }

  abrirEnlaceActividad(enlace: ActividadEnlace): void {
    if (!enlace.url) return;
    window.open(enlace.url, '_blank', 'noopener,noreferrer');
  }

  nombreEmpresaActiva(): string {
    if (!this.empresaProyectoActivaId) return '';
    return this.buscarEmpresaPorId(this.empresaProyectoActivaId)?.nombre || '';
  }

  private cargarDatosBackend(): void {
    this.cargarActividades();
    this.cargarEmpresasYProyectos();
  }

  private cargarActividades(): void {
    forkJoin({
      actividades: this.estrategiaService.getActividades(),
      enlaces: this.estrategiaService.getActividadEnlaces(),
    }).subscribe(({ actividades, enlaces }) => {
      const enlacesPorActividad = this.agruparPorId(enlaces, 'actividad_id');
      this.actividades = actividades.map((actividad) =>
        this.fromActividadApi(actividad, enlacesPorActividad.get(String(actividad.id)) ?? actividad.enlaces ?? []),
      );

      if (this.actividadSeleccionada) {
        this.actividadSeleccionada =
          this.actividades.find((actividad) => actividad.id === this.actividadSeleccionada?.id) ??
          this.actividadSeleccionada;
      }
    });
  }

  private cargarEmpresasYProyectos(): void {
    forkJoin({
      empresas: this.estrategiaService.getEmpresas(),
      proyectos: this.estrategiaService.getProyectos(),
      enlaces: this.estrategiaService.getProyectoEnlaces(),
    }).subscribe(({ empresas, proyectos, enlaces }) => {
      const proyectosPorEmpresa = this.agruparPorId(proyectos, 'empresa_id');
      const enlacesPorProyecto = this.agruparPorId(enlaces, 'proyecto_id');

      this.empresas = empresas.map((empresa) => {
        const empresaId = String(empresa.id);
        const empresaPrevia = this.buscarEmpresaPorId(empresaId);

        return {
          id: empresaId,
          nombre: String(empresa.nombre ?? ''),
          descripcion: String(empresa.descripcion ?? ''),
          expandida: empresaPrevia?.expandida ?? false,
          proyectos: (proyectosPorEmpresa.get(empresaId) ?? empresa.proyectos ?? []).map((proyecto: any) =>
            this.fromProyectoApi(
              proyecto,
              enlacesPorProyecto.get(String(proyecto.id)) ?? proyecto.enlaces ?? [],
            ),
          ),
        };
      });

      if (this.empresaSeleccionada) {
        const empresaActualizada = this.buscarEmpresaPorId(this.empresaSeleccionada.id);
        this.empresaSeleccionada = empresaActualizada ?? this.empresaSeleccionada;
        if (empresaActualizada && this.proyectoSeleccionado) {
          this.proyectoSeleccionado =
            empresaActualizada.proyectos.find((proyecto) => proyecto.id === this.proyectoSeleccionado?.id) ??
            this.proyectoSeleccionado;
        }
      }
    });
  }

  private guardarEnlacesActividad(actividadId: string | number | null | undefined, enlaces: ActividadEnlace[]) {
    if (!actividadId || !enlaces.length) return of([]);

    const enlacesExistentes =
      this.actividades.find((actividad) => actividad.id === String(actividadId))?.enlaces ?? [];
    const enlacesFaltantes = enlaces.filter(
      (enlace) =>
        !enlacesExistentes.some(
          (existente) => existente.nombre === enlace.nombre && existente.url === enlace.url,
        ),
    );

    if (!enlacesFaltantes.length) return of([]);

    return forkJoin(
      enlacesFaltantes.map((enlace) =>
        this.estrategiaService.createActividadEnlace({
          actividad_id: actividadId,
          nombre: enlace.nombre,
          url: enlace.url,
        }),
      ),
    );
  }

  private guardarEnlacesProyecto(proyectoId: string | number | null | undefined, enlaces: ProyectoEnlace[]) {
    if (!proyectoId || !enlaces.length) return of([]);

    const enlacesExistentes =
      this.empresas
        .flatMap((empresa) => empresa.proyectos)
        .find((proyecto) => proyecto.id === String(proyectoId))?.enlaces ?? [];
    const enlacesFaltantes = enlaces.filter(
      (enlace) =>
        !enlacesExistentes.some(
          (existente) => existente.etiqueta === enlace.etiqueta && existente.url === enlace.url,
        ),
    );

    if (!enlacesFaltantes.length) return of([]);

    return forkJoin(
      enlacesFaltantes.map((enlace) =>
        this.estrategiaService.createProyectoEnlace({
          proyecto_id: proyectoId,
          etiqueta: enlace.etiqueta,
          url: enlace.url,
        }),
      ),
    );
  }

  private fromActividadApi(actividad: any, enlaces: any[]): ActividadKanban {
    return {
      id: String(actividad.id ?? `a${Date.now()}`),
      titulo: String(actividad.titulo ?? ''),
      descripcion: String(actividad.descripcion ?? ''),
      estado: this.normalizarEstadoActividad(String(actividad.estado ?? 'Pendiente')),
      creadoPor: String(actividad.creado_por ?? actividad.creadoPor ?? this.nombreUsuarioActual),
      prioridad: this.normalizarPrioridad(String(actividad.prioridad ?? 'Media')),
      fechaCreacion: this.formatearFechaVista(
        String(actividad.fecha_creacion ?? actividad.fechaCreacion ?? actividad.created_at ?? ''),
      ),
      fechaLimite: this.normalizarFechaInput(String(actividad.fecha_limite ?? actividad.fechaLimite ?? '')),
      enlaces: enlaces.map((enlace) => this.fromActividadEnlaceApi(enlace)),
    };
  }

  private fromActividadEnlaceApi(enlace: any): ActividadEnlace {
    return {
      id: enlace.id,
      nombre: String(enlace.nombre ?? ''),
      url: String(enlace.url ?? ''),
    };
  }

  private fromProyectoApi(proyecto: any, enlaces: any[]): ProyectoEmpresa {
    return {
      id: String(proyecto.id ?? `p${Date.now()}`),
      titulo: String(proyecto.titulo ?? ''),
      descripcion: String(proyecto.descripcion ?? ''),
      estado: this.normalizarEstadoProyecto(String(proyecto.estado ?? 'Pendiente')),
      fechaLimite: this.normalizarFechaInput(String(proyecto.fecha_limite ?? proyecto.fechaLimite ?? '')),
      enlaces: enlaces.map((enlace) => this.fromProyectoEnlaceApi(enlace)),
    };
  }

  private fromProyectoEnlaceApi(enlace: any): ProyectoEnlace {
    return {
      id: enlace.id,
      etiqueta: String(enlace.etiqueta ?? ''),
      url: String(enlace.url ?? ''),
    };
  }

  private agruparPorId(items: any[], campo: string): Map<string, any[]> {
    const grupos = new Map<string, any[]>();
    for (const item of items) {
      const id = item[campo] ?? item[this.camelizar(campo)];
      if (id === undefined || id === null) continue;
      const clave = String(id);
      grupos.set(clave, [...(grupos.get(clave) ?? []), item]);
    }
    return grupos;
  }

  private camelizar(valor: string): string {
    return valor.replace(/_([a-z])/g, (_, letra: string) => letra.toUpperCase());
  }

  private normalizarEstadoActividad(estado: string): EstadoActividad {
    const estadoNormalizado = this.normalizar(estado).replace(/_/g, ' ');

    if (estadoNormalizado === 'pendiente') return 'Pendiente';
    if (estadoNormalizado === 'en progreso') return 'En progreso';
    if (estadoNormalizado === 'en revision') return 'En revision';
    if (estadoNormalizado === 'en ejecucion') return 'En ejecucion';
    if (estadoNormalizado === 'finalizado') return 'Finalizado';
    if (estadoNormalizado === 'paralizado') return 'Paralizado';
    if (estadoNormalizado === 'completado') return 'Completado';

    return this.columnas.find((columna) => this.normalizar(columna.estado) === estadoNormalizado)?.estado ?? 'Pendiente';
  }

  private toEstadoActividadApi(estado: EstadoActividad): string {
    const estadosApi: Record<EstadoActividad, string> = {
      Pendiente: 'PENDIENTE',
      'En progreso': 'EN_PROGRESO',
      'En revision': 'EN_REVISION',
      'En ejecucion': 'EN_EJECUCION',
      Finalizado: 'FINALIZADO',
      Paralizado: 'PARALIZADO',
      Completado: 'COMPLETADO',
    };

    return estadosApi[estado];
  }

  private normalizarEstadoProyecto(estado: string): EstadoProyecto {
    const estadoNormalizado = this.normalizar(estado).replace(/_/g, ' ');

    if (estadoNormalizado === 'en progreso') return 'En Progreso';
    if (estadoNormalizado === 'completada' || estadoNormalizado === 'completado') return 'Completada';
    if (estadoNormalizado === 'paralizado') return 'Paralizado';
    return 'Pendiente';
  }

  private toEstadoProyectoApi(estado: EstadoProyecto): string {
    const estadosApi: Record<EstadoProyecto, string> = {
      Pendiente: 'PENDIENTE',
      'En Progreso': 'EN_PROGRESO',
      Completada: 'COMPLETADA',
      Paralizado: 'PARALIZADO',
    };

    return estadosApi[estado];
  }

  private normalizarPrioridad(prioridad: string): PrioridadActividad {
    if (this.normalizar(prioridad) === 'alta') return 'Alta';
    if (this.normalizar(prioridad) === 'baja') return 'Baja';
    return 'Media';
  }

  private normalizarFechaInput(fecha: string): string {
    return fecha.includes('T') ? fecha.slice(0, 10) : fecha;
  }

  private formatearFechaVista(fecha: string): string {
    const fechaInput = this.normalizarFechaInput(fecha);
    if (!fechaInput) return this.formatearFechaCreacion(new Date());
    const [anio, mes, dia] = fechaInput.split('-');
    return anio && mes && dia ? `${dia}/${mes}/${anio}` : fechaInput;
  }

  private fechaIsoActual(): string {
    return new Date().toISOString().slice(0, 10);
  }

  cerrarNotificacion(): void {
    this.notificacion = null;
    this.limpiarNotificacionProgramada();
  }

  private buscarEmpresaPorId(empresaId: string): EmpresaProyecto | undefined {
    return this.empresas.find((empresa) => empresa.id === empresaId);
  }

  private crearEmpresaForm(): EmpresaForm {
    return {
      nombre: '',
      descripcion: '',
    };
  }

  private crearProyectoForm(): ProyectoForm {
    return {
      titulo: '',
      descripcion: '',
      estado: 'Pendiente',
      fechaLimite: '',
      enlaces: [{ etiqueta: '', url: '' }],
    };
  }

  private crearActividadForm(estado: EstadoActividad): ActividadForm {
    return {
      titulo: '',
      descripcion: '',
      estado,
      responsable: this.nombreUsuarioActual,
      prioridad: 'Media',
      fechaLimite: '',
      enlaces: [{ nombre: '', url: '' }],
    };
  }

  private clonarEnlaces(enlaces: ActividadEnlace[]): ActividadEnlace[] {
    if (!enlaces.length) return [{ nombre: '', url: '' }];
    return enlaces.map((enlace) => ({ ...enlace }));
  }

  private clonarEnlacesProyecto(enlaces: ProyectoEnlace[]): ProyectoEnlace[] {
    if (!enlaces.length) return [{ etiqueta: '', url: '' }];
    return enlaces.map((enlace) => ({ ...enlace }));
  }

  private mostrarNotificacion(tipo: TipoNotificacion, mensaje: string): void {
    this.notificacion = { tipo, mensaje };
    this.limpiarNotificacionProgramada();
    this.notificationTimeoutId = window.setTimeout(() => {
      this.notificacion = null;
      this.notificationTimeoutId = undefined;
    }, 3500);
  }

  private limpiarNotificacionProgramada(): void {
    if (this.notificationTimeoutId) {
      window.clearTimeout(this.notificationTimeoutId);
      this.notificationTimeoutId = undefined;
    }
  }

  private normalizar(valor: string): string {
    return valor
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  private formatearFechaCreacion(fecha: Date): string {
    const dia = `${fecha.getDate()}`.padStart(2, '0');
    const mes = `${fecha.getMonth() + 1}`.padStart(2, '0');
    const anio = fecha.getFullYear();
    return `${dia}/${mes}/${anio}`;
  }
}
