import { Component, OnInit, ElementRef, ViewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OnDestroy } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ConveniosService, ConvenioDto, ConvenioHistorialDto } from './convenios.service';
import { ActividadesService, ActividadDto, EstadoActividad } from './actividades.service';
import { AuthService } from '../../auth/services/auth.service';
import { ComunidadService, Area as ComunidadArea } from '../../comunidad/services/comunidad.service';

@Component({
  selector: 'app-desarrollo-comercial',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './desarrollo-comercial.html',
  styleUrl: './desarrollo-comercial.scss',
})
export class DesarrolloComercial implements OnInit, OnDestroy {
  readonly EstadoActividad = EstadoActividad;
  vistaActual: 'convenios' | 'actividades' = 'convenios';
  estadoSeleccionado: Estado = 'pendiente';
  filtroActividad: FiltroActividad = 'todos';
  busqueda = '';
  mostrandoFormularioActividad = false;
  actividadEnEdicion: ActividadForm = this.crearActividadForm();
  actividadSeleccionada: Actividad | null = null;
  actividadEditandoId: string | null = null;
  @ViewChild('logoInput') logoInputRef?: ElementRef<HTMLInputElement>;

  conveniosOriginal: Convenio[] = [];
  actividadesOriginal: Actividad[] = [];
  page = 1;
  readonly conveniosPageSize = 12;
  readonly actividadesPageSize = 5;
  convenioSeleccionado: Convenio | null = null;
  convenioPorEliminar: Convenio | null = null;
  nuevoComentario = '';
  usuarioActual = 'Deivi Flores';
  editMode = false;
  esNuevo = false;
  intentoGuardar = false;
  private logoObjectUrl?: string;
  private snapshotEdicion: Convenio | null = null;
  private areaActivaId?: number;
  private areaActivaRequest?: Promise<number | undefined>;
  private readonly storageKey = 'convenios-data';
  private readonly storageSelectedKey = 'convenio-seleccionado-id';
  notificacion: NotificacionToast | null = null;
  private notificationTimeoutId?: number;
  readonly estadosActividad = [
    { value: EstadoActividad.PENDIENTE, label: 'Pendiente', className: 'pendiente' },
    { value: EstadoActividad.EN_PROCESO, label: 'En proceso', className: 'proceso' },
    { value: EstadoActividad.PARALIZADO, label: 'Paralizado', className: 'paralizado' },
    { value: EstadoActividad.COMPLETADO, label: 'Completado', className: 'firmado' },
  ] as const;
  estadosDisponibles: Estado[] = [
    'pendiente',
    'proceso',
    'convenio',
    'reunion',
    'firmado',
    'cancelado',
  ];
  filtroConexion: ConexionFiltro = 'todos';
  tiposInstitucion: string[] = [
    'Ministerio',
    'Gobierno regional',
    'Municipalidad',
    'Empresa privada',
    'ONG',
    'UGEL',
    'Persona',
    'Organismo público',
    'Asociación civil',
    'Venue',
  ];
  tiposConexion: string[] = ['Convenio', 'Alianza'];
  constructor(
    private conveniosService: ConveniosService,
    private actividadesService: ActividadesService,
    private authService: AuthService,
    private comunidadService: ComunidadService,
  ) {}

  ngOnInit(): void {
    void this.resolverAreaActiva();
    this.cargarConvenios();
    this.cargarActividades();
  }

  ngOnDestroy(): void {
    this.limpiarNotificacionProgramada();
  }

  get conveniosFiltrados(): Convenio[] {
    const term = this.busqueda.trim().toLowerCase();
    return this.conveniosOriginal.filter(
      (c) =>
        c.estado === this.estadoSeleccionado &&
        (term ? c.nombre.toLowerCase().includes(term) : true) &&
        (this.filtroConexion === 'todos'
          ? true
          : (c.conexion ?? '').toLowerCase() === this.filtroConexion.toLowerCase()),
    );
  }

  get actividadesFiltradas(): Actividad[] {
    const term = this.busqueda.trim().toLowerCase();
    return this.actividadesOriginal.filter(
      (actividad) =>
        (this.filtroActividad === 'todos' ? true : actividad.estado === this.filtroActividad) &&
        (term
          ? actividad.titulo.toLowerCase().includes(term) ||
            actividad.descripcion.toLowerCase().includes(term)
          : true),
    );
  }

  get totalPaginas(): number {
    const total =
      this.vistaActual === 'convenios'
        ? this.conveniosFiltrados.length
        : this.actividadesFiltradas.length;
    return Math.max(1, Math.ceil(total / this.pageSizeActual));
  }

  get paginas(): number[] {
    return Array.from({ length: this.totalPaginas }, (_, i) => i + 1);
  }

  get conveniosPaginados(): Convenio[] {
    const start = (this.page - 1) * this.pageSizeActual;
    return this.conveniosFiltrados.slice(start, start + this.pageSizeActual);
  }

  get actividadesPaginadas(): Actividad[] {
    const start = (this.page - 1) * this.pageSizeActual;
    return this.actividadesFiltradas.slice(start, start + this.pageSizeActual);
  }

  get pageSizeActual(): number {
    return this.vistaActual === 'convenios' ? this.conveniosPageSize : this.actividadesPageSize;
  }

  cambiarVista(vista: 'convenios' | 'actividades') {
    this.vistaActual = vista;
    if (vista === 'actividades') {
      this.filtroActividad = 'todos';
      this.convenioSeleccionado = null;
      this.cargarActividades(this.busqueda, this.filtroActividad);
    } else {
      this.mostrandoFormularioActividad = false;
      this.actividadSeleccionada = null;
    }
    this.setPage(1);
  }

  setPage(p: number) {
    this.page = Math.min(Math.max(1, p), this.totalPaginas);
  }

  nextPage() {
    this.setPage(this.page + 1);
  }

  prevPage() {
    this.setPage(this.page - 1);
  }

  setFiltro(estado: Estado) {
    this.estadoSeleccionado = estado;
    if (this.vistaActual === 'convenios') {
      this.cargarConvenios(this.busqueda, this.estadoSeleccionado);
    }
    this.setPage(1);
  }

  setConexionFiltro(valor: ConexionFiltro) {
    this.filtroConexion = valor;
    this.setPage(1);
  }

  setFiltroActividad(valor: FiltroActividad) {
    this.filtroActividad = valor;
    if (this.vistaActual === 'actividades') {
      this.cargarActividades(this.busqueda, this.filtroActividad);
    }
    this.setPage(1);
  }

  onBuscar() {
    this.setPage(1);
    if (this.vistaActual === 'convenios') {
      this.cargarConvenios(this.busqueda, this.estadoSeleccionado);
      return;
    }

    this.cargarActividades(this.busqueda, this.filtroActividad);
  }

  ejecutarAccionPrincipal() {
    if (this.vistaActual === 'convenios') {
      this.crearNuevoConvenio();
      return;
    }

    this.abrirFormularioActividad();
  }

  abrirFormularioActividad() {
    this.actividadSeleccionada = null;
    this.actividadEditandoId = null;
    this.mostrandoFormularioActividad = true;
    this.actividadEnEdicion = this.crearActividadForm();
  }

  cancelarFormularioActividad() {
    this.mostrandoFormularioActividad = false;
    this.actividadEditandoId = null;
    this.actividadEnEdicion = this.crearActividadForm();
  }

  agregarEnlaceActividad() {
    this.actividadEnEdicion = {
      ...this.actividadEnEdicion,
      enlaces: [...this.actividadEnEdicion.enlaces, { nombre: '', url: '' }],
    };
  }

  async guardarActividad() {
    if (
      !this.actividadEnEdicion.titulo.trim() ||
      !this.actividadEnEdicion.descripcion.trim() ||
      !this.actividadEnEdicion.fechaLimite
    ) {
      this.mostrarNotificacion('error', 'Completa los campos obligatorios de la actividad.');
      return;
    }

    const enlacesConContenido = this.actividadEnEdicion.enlaces.filter(
      (enlace) => enlace.nombre.trim() || enlace.url.trim(),
    );

    if (enlacesConContenido.some((enlace) => !this.urlActividadValida(enlace.url))) {
      this.mostrarNotificacion(
        'error',
        'Cada enlace debe tener una URL válida con protocolo http o https.',
      );
      return;
    }

    const areaId = this.obtenerAreaId() ?? (await this.resolverAreaActiva());
    if (!areaId) {
      this.mostrarNotificacion(
        'error',
        'No se pudo identificar el área actual para crear la actividad.',
      );
      return;
    }

    const payload = this.toActividadDto(this.actividadEnEdicion, areaId);
    console.log('Payload actividad', payload);

    if (this.actividadEditandoId) {
      this.actividadesService.updateActividad(this.actividadEditandoId, payload).subscribe({
        next: (response) => {
          this.mostrandoFormularioActividad = false;
          this.actividadEditandoId = null;
          this.actividadEnEdicion = this.crearActividadForm();
          this.cargarActividades(this.busqueda, this.filtroActividad);
          this.mostrarNotificacion(
            'success',
            response?.mensaje ?? response?.message ?? 'Actividad actualizada exitosamente.',
          );
        },
        error: (error: unknown) => {
          console.error('No se pudo actualizar la actividad', error);
          this.mostrarNotificacion(
            'error',
            this.mensajeErrorBackend('No se pudo actualizar la actividad', error),
          );
        },
      });
      return;
    }

    this.actividadesService.createActividad(payload).subscribe({
      next: (response) => {
        this.mostrandoFormularioActividad = false;
        this.actividadEnEdicion = this.crearActividadForm();
        this.setPage(1);
        this.cargarActividades(this.busqueda, this.filtroActividad);
        this.mostrarNotificacion(
          'success',
          response?.mensaje ?? response?.message ?? 'Actividad creada exitosamente.',
        );
      },
      error: (error: unknown) => {
        console.error('No se pudo crear la actividad', error);
        this.mostrarNotificacion(
          'error',
          this.mensajeErrorBackend('No se pudo crear la actividad', error),
        );
      },
    });
  }

  abrirDetalleActividad(actividad: Actividad) {
    this.mostrandoFormularioActividad = false;
    this.actividadSeleccionada = {
      ...actividad,
      enlaces: actividad.enlaces ? actividad.enlaces.map((enlace) => ({ ...enlace })) : [],
    };
  }

  cerrarDetalleActividad() {
    this.actividadSeleccionada = null;
  }

  editarActividad(actividad: Actividad, event?: Event) {
    event?.stopPropagation();
    this.actividadSeleccionada = null;
    this.actividadEditandoId = actividad.id;
    this.actividadEnEdicion = this.mapActividadAFormulario(actividad);
    this.mostrandoFormularioActividad = true;
  }

  private crearActividadForm(): ActividadForm {
    return {
      titulo: '',
      descripcion: '',
      estado: EstadoActividad.PENDIENTE,
      fechaLimite: '',
      enlaces: [{ nombre: '', url: '' }],
    };
  }

  private formatearFechaActividad(fechaIso: string): string {
    const [year, month, day] = fechaIso.split('-');
    return `${day}/${month}/${year}`;
  }

  private fechaActividadParaInput(fecha: string): string {
    const valor = fecha.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor;

    const match = valor.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return '';

    const [, dd, mm, yyyy] = match;
    return `${yyyy}-${mm}-${dd}`;
  }

  private formatearFechaActividadIso(fecha: Date): string {
    const pad = (valor: number) => valor.toString().padStart(2, '0');
    return `${pad(fecha.getDate())}/${pad(fecha.getMonth() + 1)}/${fecha.getFullYear()}`;
  }

  private normalizarFechaActividad(fecha?: string | Date | null): string {
    if (!fecha) return '';

    const valor = String(fecha).trim();
    if (!valor) return '';
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(valor)) return valor;

    const isoMatch = valor.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      const [, yyyy, mm, dd] = isoMatch;
      return `${dd}/${mm}/${yyyy}`;
    }

    const parsed = new Date(valor);
    if (!Number.isNaN(parsed.getTime())) {
      return this.formatearFechaActividad(parsed.toISOString().slice(0, 10));
    }

    return valor;
  }

  private mapActividadAFormulario(actividad: Actividad): ActividadForm {
    return {
      titulo: actividad.titulo,
      descripcion: actividad.descripcion,
      estado: actividad.estado,
      fechaLimite: this.fechaActividadParaInput(actividad.fechaLimite),
      enlaces:
        actividad.enlaces && actividad.enlaces.length
          ? actividad.enlaces.map((enlace) => ({ ...enlace }))
          : [{ nombre: '', url: '' }],
    };
  }

  private cargarActividades(busqueda?: string, estado?: FiltroActividad) {
    const estadoQuery = estado && estado !== 'todos' ? estado : undefined;

    this.actividadesService.getActividades(busqueda, estadoQuery).subscribe((data) => {
      this.actividadesOriginal = [...data]
        .sort((a, b) => this.compararActividadesRecientes(a, b))
        .map((actividad) => this.mapActividadFromDto(actividad));
      this.setPage(Math.min(this.page, this.totalPaginas));
    });
  }

  private compararActividadesRecientes(a: ActividadDto, b: ActividadDto): number {
    const fechaA = this.obtenerTimestampActividad(a);
    const fechaB = this.obtenerTimestampActividad(b);

    if (fechaA !== fechaB) return fechaB - fechaA;

    const idA = Number(a.id ?? 0);
    const idB = Number(b.id ?? 0);
    return idB - idA;
  }

  private obtenerTimestampActividad(actividad: ActividadDto): number {
    const fechaRaw = actividad.createdAt ?? actividad.fechaCreacion ?? actividad.fechaLimite;
    if (!fechaRaw) return 0;

    const valor = String(fechaRaw).trim();
    const fecha = new Date(valor);
    if (!Number.isNaN(fecha.getTime())) return fecha.getTime();

    const match = valor.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return 0;

    const [, dd, mm, yyyy] = match;
    return new Date(Number(yyyy), Number(mm) - 1, Number(dd)).getTime();
  }

  private mapActividadFromDto(dto: ActividadDto): Actividad {
    return {
      id: String(dto.id ?? ''),
      titulo: (dto.titulo ?? '').trim(),
      descripcion: (dto.descripcion ?? '').trim(),
      fechaCreacion: this.normalizarFechaActividad(dto.fechaCreacion ?? dto.createdAt),
      fechaLimite: this.normalizarFechaActividad(dto.fechaLimite),
      estado: this.mapActividadEstado(dto.estado),
      enlaces: (dto.enlaces ?? [])
        .map((enlace) => ({
          nombre: (enlace.nombreDocumento ?? enlace.nombre ?? '').trim(),
          url: (enlace.url ?? '').trim(),
        }))
        .filter((enlace) => enlace.nombre || enlace.url),
    };
  }

  private toActividadDto(form: ActividadForm, areaId = this.obtenerAreaId()): ActividadDto {
    const creadorId = this.obtenerCreadorId();

    return {
      ...(areaId ? { areaId } : {}),
      ...(creadorId > 0 ? { creadorId } : {}),
      titulo: form.titulo.trim(),
      descripcion: form.descripcion.trim(),
      estado: form.estado,
      fechaLimite: this.fechaActividadParaInput(form.fechaLimite),
      enlaces: form.enlaces
        .filter((enlace) => enlace.nombre.trim() || enlace.url.trim())
        .map((enlace) => ({
          nombreDocumento: enlace.nombre.trim(),
          url: enlace.url.trim(),
        })),
    };
  }

  private mapActividadEstado(estado?: string | null): ActividadEstado {
    const valor = (estado ?? '').trim().toUpperCase();
    if (valor === EstadoActividad.PENDIENTE) return EstadoActividad.PENDIENTE;
    if (valor === EstadoActividad.EN_PROCESO || valor === 'EN_PROCESO') {
      return EstadoActividad.EN_PROCESO;
    }
    if (valor === EstadoActividad.PARALIZADO || valor.includes('PARALIZ')) {
      return EstadoActividad.PARALIZADO;
    }
    if (
      valor === EstadoActividad.COMPLETADO ||
      valor.includes('COMPLET') ||
      valor.includes('FIRM')
    ) {
      return EstadoActividad.COMPLETADO;
    }
    return EstadoActividad.PENDIENTE;
  }

  private urlActividadValida(url: string): boolean {
    const valor = url.trim();
    if (!valor) return true;

    try {
      const parsed = new URL(valor);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  labelActividadEstado(estado: ActividadEstado): string {
    switch (estado) {
      case EstadoActividad.PENDIENTE:
        return 'PENDIENTE';
      case EstadoActividad.EN_PROCESO:
        return 'EN PROCESO';
      case EstadoActividad.PARALIZADO:
        return 'PARALIZADO';
      case EstadoActividad.COMPLETADO:
        return 'COMPLETADO';
    }
  }

  actividadEstadoClase(estado: ActividadEstado): ActividadEstadoClase {
    switch (estado) {
      case EstadoActividad.PENDIENTE:
        return 'pendiente';
      case EstadoActividad.EN_PROCESO:
        return 'proceso';
      case EstadoActividad.PARALIZADO:
        return 'paralizado';
      case EstadoActividad.COMPLETADO:
        return 'firmado';
    }
  }

  crearNuevoConvenio() {
    const provisionalId = `nuevo-${Date.now()}`;
    const base: Convenio = {
      id: provisionalId,
      nombre: '',
      fecha: '',
      siglas: '',
      color: this.colorFromSeed(),
      estado: 'pendiente',
      ruc: '',
      rubro: '',
      contacto: '',
      telefono: '',
      tipo: this.tiposInstitucion[0],
      conexion: this.tiposConexion[0],
      comentarios: [],
      historial: [],
      archivoAdjunto: undefined,
    };
    this.convenioSeleccionado = this.normalizarConvenio(base);
    this.editMode = true;
    this.esNuevo = true;
    this.intentoGuardar = false;
    this.nuevoComentario = '';
    this.snapshotEdicion = this.clonarConvenio(this.convenioSeleccionado);
    this.persistirSeleccion(this.idConvenio(this.convenioSeleccionado));
  }

  abrirDetalle(convenio: Convenio) {
    this.convenioSeleccionado = {
      ...convenio,
      comentarios: convenio.comentarios ? convenio.comentarios.map((c) => ({ ...c })) : [],
      historial: convenio.historial ? [...convenio.historial] : [],
      archivoAdjunto: convenio.archivoAdjunto ? { ...convenio.archivoAdjunto } : undefined,
    };
    this.nuevoComentario = '';
    this.editMode = false;
    this.esNuevo = false;
    this.intentoGuardar = false;
    this.snapshotEdicion = this.clonarConvenio(this.convenioSeleccionado);
    this.persistirSeleccion(this.idConvenio(convenio));
    this.hidratarArchivoAdjunto(this.idConvenio(convenio));
    this.hidratarComentarios(this.idConvenio(convenio));
    this.hidratarHistorial(this.idConvenio(convenio));
  }

  cerrarDetalle() {
    this.liberarArchivo(this.convenioSeleccionado);
    this.convenioSeleccionado = null;
    this.nuevoComentario = '';
    this.editMode = false;
    this.esNuevo = false;
    this.intentoGuardar = false;
    this.snapshotEdicion = null;
    this.liberarLogo();
    localStorage.removeItem(this.storageSelectedKey);
  }

  onArchivoSeleccionado(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files[0];
    if (!file || !this.convenioSeleccionado) return;

    const esPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!esPdf) {
      alert('Solo se permite subir archivos PDF.');
      input.value = '';
      return;
    }

    const convenioId = this.idConvenio(this.convenioSeleccionado);
    const urlArchivo = URL.createObjectURL(file);
    const adjunto = { nombre: file.name, url: urlArchivo, file };
    const reemplazabaArchivo = !!this.convenioSeleccionado.archivoAdjunto?.nombre;

    this.liberarArchivo(this.convenioSeleccionado);
    this.convenioSeleccionado = {
      ...this.convenioSeleccionado,
      archivoAdjunto: adjunto,
    };

    if (!/^\d+$/.test(convenioId)) {
      this.registrarEventoHistorialLocal(
        convenioId,
        `${reemplazabaArchivo ? 'Archivo PDF actualizado' : 'Archivo PDF adjuntado'}: ${file.name}`,
      );
    }

    if (/^\d+$/.test(convenioId)) {
      this.subirArchivoAdjunto(convenioId, adjunto, reemplazabaArchivo);
    }

    input.value = '';
  }

  verArchivo() {
    if (this.convenioSeleccionado?.archivoAdjunto?.url) {
      window.open(this.convenioSeleccionado.archivoAdjunto.url, '_blank');
    }
  }

  eliminarArchivo() {
    if (!this.convenioSeleccionado) return;
    const archivo = this.convenioSeleccionado.archivoAdjunto;
    const nombreArchivo = archivo?.nombre;
    const limpiarLocal = () => {
      this.liberarArchivo(this.convenioSeleccionado);
      this.convenioSeleccionado = { ...this.convenioSeleccionado!, archivoAdjunto: undefined };
      this.conveniosOriginal = this.conveniosOriginal.map((c) =>
        this.idConvenio(c) === this.idConvenio(this.convenioSeleccionado!)
          ? ({ ...this.convenioSeleccionado! } as Convenio)
          : c,
      );
      this.persistirConvenios();
      if (nombreArchivo) {
        this.registrarEventoHistorialLocal(
          this.idConvenio(this.convenioSeleccionado!),
          `Archivo PDF eliminado: ${nombreArchivo}`,
        );
      }
    };

    if (!archivo?.id) {
      const convenioId = this.idConvenio(this.convenioSeleccionado);
      if (!/^\d+$/.test(convenioId)) {
        limpiarLocal();
        return;
      }

      this.conveniosService.getArchivosByConvenio(convenioId).subscribe((archivos) => {
        const archivoBd = archivos[0];
        if (!archivoBd?.id) {
          limpiarLocal();
          return;
        }

        this.conveniosService.deleteArchivo(archivoBd.id).subscribe({
          next: () => limpiarLocal(),
          error: (error: unknown) => {
            console.error('No se pudo eliminar el archivo', error);
            alert(this.mensajeErrorBackend('No se pudo eliminar el archivo en la BD', error));
          },
        });
      });
      return;
    }

    this.conveniosService.deleteArchivo(archivo.id).subscribe({
      next: () => limpiarLocal(),
      error: (error: unknown) => {
        console.error('No se pudo eliminar el archivo', error);
        alert(this.mensajeErrorBackend('No se pudo eliminar el archivo en la BD', error));
      },
    });
  }

  private eliminarConvenioLocal(convenio: Convenio) {
    const id = this.idConvenio(convenio);
    this.liberarArchivo(convenio);
    this.conveniosOriginal = this.conveniosOriginal.filter((c) => this.idConvenio(c) !== id);

    if (this.convenioSeleccionado && this.idConvenio(this.convenioSeleccionado) === id) {
      this.convenioSeleccionado = null;
      this.nuevoComentario = '';
      this.editMode = false;
      this.esNuevo = false;
      localStorage.removeItem(this.storageSelectedKey);
    }

    this.setPage(Math.min(this.page, this.totalPaginas));
    this.persistirConvenios();
  }

  pedirConfirmarEliminacion(convenio: Convenio, event?: Event) {
    if (event) event.stopPropagation();
    this.convenioPorEliminar = convenio;
  }

  cancelarEliminacion() {
    this.convenioPorEliminar = null;
  }

  confirmarEliminacion() {
    if (!this.convenioPorEliminar) return;
    const convenio = this.convenioPorEliminar;
    const id = this.idConvenio(convenio);

    if (!/^\d+$/.test(id)) {
      this.eliminarConvenioLocal(convenio);
      this.convenioPorEliminar = null;
      return;
    }

    this.conveniosService.deleteConvenio(id).subscribe({
      next: () => {
        this.eliminarConvenioLocal(convenio);
        this.convenioPorEliminar = null;
      },
      error: (error: unknown) => {
        console.error('No se pudo eliminar el convenio', error);
        alert(this.mensajeErrorBackend('No se pudo eliminar el convenio en la BD', error));
      },
    });
  }

  eliminarLogo() {
    if (!this.convenioSeleccionado) return;
    const teniaLogo = !!this.convenioSeleccionado.logo;
    if (!teniaLogo) return;
    this.liberarLogo();
    const limpio = { ...this.convenioSeleccionado, logo: undefined };
    this.convenioSeleccionado = limpio;
    this.conveniosOriginal = this.conveniosOriginal.map((c) =>
      this.idConvenio(c) === this.idConvenio(limpio) ? ({ ...limpio } as Convenio) : c,
    );
    this.persistirConvenios();
    this.registrarEventoHistorialLocal(this.idConvenio(limpio), 'Logo eliminado');
  }

  agregarComentario() {
    if (!this.convenioSeleccionado || !this.nuevoComentario.trim()) return;
    const comentario = this.nuevoComentario.trim();
    const id = this.idConvenio(this.convenioSeleccionado);

    this.conveniosService.addComentario(id, comentario).subscribe({
      next: (resp) => {
        const textoComentario = resp ? this.formatearComentario(resp) : comentario;
        this.convenioSeleccionado = {
          ...this.convenioSeleccionado!,
          comentarios: [
            ...(this.convenioSeleccionado?.comentarios || []),
            { id: resp?.id, texto: textoComentario },
          ],
        };

        this.conveniosOriginal = this.conveniosOriginal.map((c) =>
          this.idConvenio(c) === id ? ({ ...this.convenioSeleccionado! } as Convenio) : c,
        );

        this.nuevoComentario = '';
        this.persistirConvenios();
        this.hidratarHistorial(id);
      },
      error: (error: unknown) => {
        console.error('No se pudo guardar el comentario', error);
        alert(this.mensajeErrorBackend('No se pudo guardar el comentario en la BD', error));
      },
    });
  }

  agregarComentarioConEnter(event: Event) {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.shiftKey) return;
    event.preventDefault();
    this.agregarComentario();
  }

  habilitarEdicion() {
    this.editMode = true;
    this.intentoGuardar = false;
    this.snapshotEdicion = this.clonarConvenio(this.convenioSeleccionado);
  }

  abrirLogo() {
    this.logoInputRef?.nativeElement.click();
  }

  guardarEdicion() {
    if (!this.convenioSeleccionado) return;
    this.intentoGuardar = true;
    if (!this.formularioConvenioValido()) {
      alert('⚠️ Completa todos los campos obligatorios');
      return;
    }
    const payload = this.toDto(this.convenioSeleccionado);

    if (this.esNuevo) {
      const provisionalId = this.idConvenio(this.convenioSeleccionado);
      this.conveniosService.createConvenio(payload).subscribe({
        next: (resp) => {
          const nuevo = resp?.convenio
            ? this.normalizarConvenio(this.mapFromDto(resp.convenio))
            : this.normalizarConvenio(payload as Convenio);

          if (this.convenioSeleccionado?.archivoAdjunto?.nombre) {
            nuevo.archivoAdjunto = { ...this.convenioSeleccionado.archivoAdjunto };
          }
          nuevo.historial = this.combinarHistorial([
            ...(nuevo.historial || []),
            ...(this.convenioSeleccionado?.historial || []),
          ]);

          this.conveniosOriginal = [...this.conveniosOriginal, nuevo];
          this.esNuevo = false;
          this.editMode = false;
          this.intentoGuardar = false;
          this.convenioSeleccionado = nuevo;
          this.snapshotEdicion = this.clonarConvenio(nuevo);
          this.persistirConvenios();

          const nuevoId = this.idConvenio(nuevo);
          this.migrarHistorialLocal(provisionalId, nuevoId);
          if (/^\d+$/.test(nuevoId)) {
            this.hidratarHistorial(nuevoId);
          }
          if (/^\d+$/.test(nuevoId) && nuevo.archivoAdjunto?.file) {
            this.subirArchivoAdjunto(nuevoId, nuevo.archivoAdjunto, false);
          }

          this.mostrarNotificacion(
            'success',
            resp?.mensaje ?? resp?.message ?? 'Se registró exitosamente.',
          );
        },
        error: (error) => {
          console.error('❌ No se pudo conectar con el servidor', error);
          this.mostrarNotificacion('error', 'Registro fallido. Inténtalo nuevamente.');
        },
      });

      return;
    }

    this.conveniosService.updateConvenio(payload).subscribe({
      next: (resp) => {
        const comentariosPrevios = this.convenioSeleccionado?.comentarios
          ? this.convenioSeleccionado.comentarios.map((comentario) => ({ ...comentario }))
          : [];
        const historialPrevio = this.convenioSeleccionado?.historial
          ? [...this.convenioSeleccionado.historial]
          : [];
        const actualizado = resp?.convenio
          ? this.normalizarConvenio(this.mapFromDto(resp.convenio))
          : this.normalizarConvenio(payload as Convenio);
        const cambios = this.obtenerCamposActualizados(this.snapshotEdicion, actualizado);
        actualizado.comentarios = comentariosPrevios;
        actualizado.historial = this.combinarHistorial([
          ...(actualizado.historial || []),
          ...historialPrevio,
        ]);
        if (this.convenioSeleccionado?.archivoAdjunto?.nombre) {
          actualizado.archivoAdjunto = { ...this.convenioSeleccionado.archivoAdjunto };
        }
        this.conveniosOriginal = this.conveniosOriginal.map((c) =>
          this.idConvenio(c) === this.idConvenio(actualizado)
            ? ({ ...actualizado } as Convenio)
            : c,
        );
        this.editMode = false;
        this.intentoGuardar = false;
        this.convenioSeleccionado = actualizado;
        this.snapshotEdicion = this.clonarConvenio(actualizado);
        this.persistirConvenios();
        const actualizadoId = this.idConvenio(actualizado);
        if (cambios.length && !/^\d+$/.test(actualizadoId)) {
          this.registrarEventoHistorialLocal(
            actualizadoId,
            `Información actualizada: ${cambios.join(', ')}`,
          );
        }
        this.hidratarComentarios(actualizadoId);
        this.hidratarHistorial(actualizadoId);
        this.mostrarNotificacion(
          'success',
          resp?.mensaje ?? resp?.message ?? 'Se guardó los cambios exitosamente.',
        );
      },
      error: (error) => {
        console.error('No se pudo actualizar el convenio', error);
        this.mostrarNotificacion('error', 'No se pudo guardar los cambios. Inténtalo nuevamente.');
      },
    });
  }

  formularioConvenioValido(): boolean {
    if (!this.convenioSeleccionado) return false;

    const nombre = this.convenioSeleccionado.nombre.trim();
    const ruc = (this.convenioSeleccionado.ruc ?? '').replace(/\D/g, '');
    const fecha = (this.convenioSeleccionado.fecha ?? '').trim();
    const rubro = (this.convenioSeleccionado.rubro ?? '').trim();
    const contacto = (this.convenioSeleccionado.contacto ?? '').trim();
    const telefono = (this.convenioSeleccionado.telefono ?? '').replace(/\D/g, '');
    const tipo = (this.convenioSeleccionado.tipo ?? '').trim();
    const conexion = (this.convenioSeleccionado.conexion ?? '').trim();
    const estado = (this.convenioSeleccionado.estado ?? '').trim();

    return (
      !!nombre &&
      ruc.length === 11 &&
      !!fecha &&
      !!rubro &&
      !!contacto &&
      telefono.length === 9 &&
      !!tipo &&
      !!conexion &&
      !!estado
    );
  }

  campoInvalido(
    campo:
      | 'nombre'
      | 'ruc'
      | 'estado'
      | 'fecha'
      | 'tipo'
      | 'rubro'
      | 'conexion'
      | 'contacto'
      | 'telefono',
  ): boolean {
    if (!this.intentoGuardar || !this.convenioSeleccionado) return false;

    switch (campo) {
      case 'nombre':
        return !this.convenioSeleccionado.nombre.trim();
      case 'ruc':
        return (this.convenioSeleccionado.ruc ?? '').replace(/\D/g, '').length !== 11;
      case 'estado':
        return !(this.convenioSeleccionado.estado ?? '').trim();
      case 'fecha':
        return !(this.convenioSeleccionado.fecha ?? '').trim();
      case 'tipo':
        return !(this.convenioSeleccionado.tipo ?? '').trim();
      case 'rubro':
        return !(this.convenioSeleccionado.rubro ?? '').trim();
      case 'conexion':
        return !(this.convenioSeleccionado.conexion ?? '').trim();
      case 'contacto':
        return !(this.convenioSeleccionado.contacto ?? '').trim();
      case 'telefono':
        return (this.convenioSeleccionado.telefono ?? '').replace(/\D/g, '').length !== 9;
    }
  }

  onLogoSeleccionado(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files[0];
    if (!file || !this.convenioSeleccionado) return;
    const mime = file.type.toLowerCase();
    const nombre = file.name.toLowerCase();
    const esImg =
      mime === 'image/png' ||
      mime === 'image/jpeg' ||
      nombre.endsWith('.png') ||
      nombre.endsWith('.jpg') ||
      nombre.endsWith('.jpeg');
    if (!esImg) {
      alert('Solo se permiten imágenes PNG o JPG para el logo.');
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const convenioId = this.idConvenio(this.convenioSeleccionado!);
      const teniaLogo = !!this.convenioSeleccionado?.logo;

      this.liberarLogo();
      this.logoObjectUrl = dataUrl;

      const nombreSeguro = this.convenioSeleccionado ? this.convenioSeleccionado.nombre || '' : '';
      this.convenioSeleccionado = {
        ...this.convenioSeleccionado!,
        nombre: nombreSeguro,
        logo: dataUrl,
      };
      this.conveniosOriginal = this.conveniosOriginal.map((c) =>
        this.idConvenio(c) === this.idConvenio(this.convenioSeleccionado!)
          ? ({ ...this.convenioSeleccionado! } as Convenio)
          : c,
      );
      this.persistirConvenios();
      this.registrarEventoHistorialLocal(
        convenioId,
        `${teniaLogo ? 'Logo actualizado' : 'Logo agregado'}: ${file.name}`,
      );
    };
    reader.readAsDataURL(file);

    input.value = '';
  }

  private cargarConvenios(busqueda?: string, estado?: string) {
    this.conveniosService.getConvenios(busqueda, estado).subscribe((data) => {
      const persistidos = this.cargarPersistidos() ?? [];
      const historialPersistido = new Map(
        persistidos.map((convenio) => [this.idConvenio(convenio), convenio.historial || []]),
      );
      if (data && data.length) {
        this.conveniosOriginal = data.map((d) => {
          const convenio = this.mapFromDto(d);
          const historialLocal = historialPersistido.get(this.idConvenio(convenio)) || [];
          return {
            ...convenio,
            historial: this.combinarHistorial([...(convenio.historial || []), ...historialLocal]),
          };
        });
        this.persistirConvenios();
      } else {
        this.conveniosOriginal = [];
        this.persistirConvenios();
      }
      this.restaurarSeleccionPersistida();
      this.setPage(1);
    });
  }

  private mapFromDto(dto: ConvenioDto): Convenio {
    const base = {
      id: dto.id ? String(dto.id) : undefined,
      nombre: dto.entidadNombre ?? dto.nombre ?? '',
      fecha: this.normalizarFechaDto(dto.fechaExpiracion ?? dto.fecha),
      siglas: dto.siglas ?? this.siglasFromNombre(dto.entidadNombre ?? dto.nombre ?? ''),
      color: dto.color ?? this.colorFromSeed(),
      logo: dto.logoUrl ?? dto.logo,
      estado: dto.estado ?? 'pendiente',
      ruc: dto.ruc,
      rubro: dto.rubro,
      contacto: dto.contactoNombre ?? dto.contacto,
      telefono: dto.telefonoContacto ?? dto.telefono,
      tipo: dto.tipo,
      conexion: dto.conexion,
      comentarios: (dto.comentarios || []).map((comentario) => ({ texto: comentario })),
      historial: dto.historial,
    };
    return this.normalizarConvenio(base);
  }

  private normalizarConvenio(
    convenio: Partial<Convenio> & { nombre: string; estado: Estado | string; fecha?: string },
  ): Convenio {
    const estadoCanon = this.mapEstado(convenio.estado);
    const rucLimpio = (convenio.ruc ?? '00000000000').replace(/\D/g, '').slice(0, 11);
    const telefonoLimpio = (convenio.telefono ?? '999999999').replace(/\D/g, '').slice(0, 9);
    const colorSeguro = convenio.color ?? this.colorFromSeed();
    return {
      id: convenio.id ?? this.slug(convenio.nombre),
      ...convenio,
      siglas: convenio.siglas ?? this.siglasFromNombre(convenio.nombre),
      color: colorSeguro,
      ruc: rucLimpio,
      fecha: convenio.fecha ?? '2026-03-25',
      rubro: convenio.rubro ?? 'alimentaria',
      contacto: convenio.contacto ?? 'Deivi Flores',
      telefono: telefonoLimpio,
      tipo: convenio.tipo ?? this.tiposInstitucion[0],
      conexion: convenio.conexion ?? this.tiposConexion[0],
      estado: estadoCanon,
      estadoLabel: this.labelEstado(estadoCanon),
    };
  }

  private toDto(convenio: Convenio): ConvenioDto {
    const limpio = this.normalizarConvenio(convenio);
    const areaId = this.obtenerAreaId();
    const creadorId = this.obtenerCreadorId();

    return {
      id: limpio.id,
      ...(areaId ? { areaId } : {}),
      ...(creadorId > 0 ? { creadorId } : {}),
      entidadNombre: limpio.nombre,
      siglas: limpio.siglas,
      color: limpio.color,
      logoUrl: limpio.logo,
      estado: this.labelEstado(this.mapEstado(limpio.estado)),
      fechaExpiracion: this.toIsoDate(limpio.fecha),
      ruc: limpio.ruc,
      rubro: limpio.rubro,
      contactoNombre: limpio.contacto,
      telefonoContacto: limpio.telefono,
      tipo: limpio.tipo,
      conexion: limpio.conexion,
      comentarios: (limpio.comentarios || []).map((comentario) => comentario.texto),
    };
  }

  private mapEstado(estado: string): Estado {
    const e = estado.trim().toLowerCase();
    if (e.includes('cancel')) return 'cancelado';
    if (e.includes('firm')) return 'firmado';
    if (e.includes('reun')) return 'reunion';
    if (e.includes('convenio')) return 'convenio';
    if (e.includes('proce')) return 'proceso';
    return 'pendiente';
  }

  labelEstado(estado: Estado): string {
    switch (estado) {
      case 'pendiente':
        return 'PENDIENTE';
      case 'proceso':
        return 'EN PROCESO';
      case 'convenio':
        return 'PROCESO DE CONVENIO';
      case 'reunion':
        return 'REUNIÓN AGENDADA';
      case 'firmado':
        return 'CONVENIO FIRMADO';
      case 'cancelado':
        return 'CANCELADO';
    }
  }

  private siglasFromNombre(nombre: string): string {
    return nombre
      .split(' ')
      .filter(Boolean)
      .slice(0, 3)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('');
  }

  private colorFromSeed(): string {
    const colores = [
      '#0b62b2',
      '#ffb703',
      '#6a1b9a',
      '#212121',
      '#009688',
      '#f57c00',
      '#1abc9c',
      '#34495e',
    ];
    const base = colores[Math.floor(Math.random() * colores.length)];
    return `linear-gradient(135deg, ${base}, ${base})`;
  }

  private formatearFecha(date: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  private formatearEventoHistorial(evento: ConvenioHistorialDto): string {
    const descripcion = this.limpiarEncabezadoHistorial(
      evento.descripcion ?? evento.accion ?? 'Sin descripción',
    );
    const fechaRaw = evento.fechaCreacion ?? evento.createdAt ?? evento.fecha;
    if (!fechaRaw) return descripcion;

    const fecha = new Date(fechaRaw);
    if (Number.isNaN(fecha.getTime())) return descripcion;

    return `${descripcion} · ${this.formatearFecha(fecha)}`;
  }

  private limpiarEncabezadoHistorial(descripcion: string): string {
    const texto = descripcion.trim();

    return texto
      .replace(/^Convenio actualizado:\s*.+?\.\s*/i, '')
      .replace(/^Convenio actualizado:\s*.+?\s*\n/i, '')
      .trim();
  }

  private registrarEventoHistorialLocal(convenioId: string, descripcion: string) {
    const evento = `${descripcion.trim()} · ${this.formatearFecha(new Date())}`;
    const historialActual = this.obtenerHistorialConvenio(convenioId);
    this.asignarHistorialConvenio(
      convenioId,
      this.combinarHistorial([evento, ...historialActual]),
    );
  }

  private obtenerHistorialConvenio(convenioId: string): string[] {
    if (this.convenioSeleccionado && this.idConvenio(this.convenioSeleccionado) === convenioId) {
      return [...(this.convenioSeleccionado.historial || [])];
    }

    const convenio = this.conveniosOriginal.find((item) => this.idConvenio(item) === convenioId);
    return [...(convenio?.historial || [])];
  }

  private asignarHistorialConvenio(convenioId: string, historial: string[]) {
    this.conveniosOriginal = this.conveniosOriginal.map((c) =>
      this.idConvenio(c) === convenioId ? ({ ...c, historial: [...historial] } as Convenio) : c,
    );

    if (this.convenioSeleccionado && this.idConvenio(this.convenioSeleccionado) === convenioId) {
      this.convenioSeleccionado = {
        ...this.convenioSeleccionado,
        historial: [...historial],
      };
    }

    this.persistirConvenios();
  }

  private combinarHistorial(historial: string[]): string[] {
    const unicos = Array.from(new Set(historial.filter((evento) => evento?.trim())));
    return unicos.sort((a, b) => this.extraerTimestampHistorial(b) - this.extraerTimestampHistorial(a));
  }

  private extraerTimestampHistorial(evento: string): number {
    const match = evento.match(/(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/);
    if (!match) return 0;

    const [, dd, mm, yyyy, hh, min] = match;
    return new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min)).getTime();
  }

  private obtenerCamposActualizados(anterior: Convenio | null, actual: Convenio): string[] {
    if (!anterior) return [];

    const campos: Array<{ etiqueta: string; antes: string; despues: string }> = [
      {
        etiqueta: 'Nombre de institución',
        antes: anterior.nombre ?? '',
        despues: actual.nombre ?? '',
      },
      { etiqueta: 'RUC', antes: anterior.ruc ?? '', despues: actual.ruc ?? '' },
      {
        etiqueta: 'Estado',
        antes: this.labelEstado(this.mapEstado(anterior.estado)),
        despues: this.labelEstado(this.mapEstado(actual.estado)),
      },
      { etiqueta: 'Fecha de expiración', antes: anterior.fecha ?? '', despues: actual.fecha ?? '' },
      { etiqueta: 'Tipo', antes: anterior.tipo ?? '', despues: actual.tipo ?? '' },
      { etiqueta: 'Rubro', antes: anterior.rubro ?? '', despues: actual.rubro ?? '' },
      { etiqueta: 'Conexión', antes: anterior.conexion ?? '', despues: actual.conexion ?? '' },
      { etiqueta: 'Contacto', antes: anterior.contacto ?? '', despues: actual.contacto ?? '' },
      {
        etiqueta: 'Número de teléfono',
        antes: anterior.telefono ?? '',
        despues: actual.telefono ?? '',
      },
    ];

    return campos
      .filter((campo) => (campo.antes || '').trim() !== (campo.despues || '').trim())
      .map((campo) => campo.etiqueta);
  }

  private clonarConvenio(convenio: Convenio | null): Convenio | null {
    if (!convenio) return null;
    return {
      ...convenio,
      comentarios: convenio.comentarios ? convenio.comentarios.map((c) => ({ ...c })) : [],
      historial: convenio.historial ? [...convenio.historial] : [],
      archivoAdjunto: convenio.archivoAdjunto ? { ...convenio.archivoAdjunto } : undefined,
    };
  }

  private migrarHistorialLocal(origenId: string, destinoId: string) {
    if (!origenId || !destinoId || origenId === destinoId) return;

    const historialMigrado = this.combinarHistorial([
      ...this.obtenerHistorialConvenio(destinoId),
      ...this.obtenerHistorialConvenio(origenId),
    ]);

    this.conveniosOriginal = this.conveniosOriginal.map((c) =>
      this.idConvenio(c) === destinoId ? ({ ...c, historial: [...historialMigrado] } as Convenio) : c,
    );

    if (this.convenioSeleccionado && this.idConvenio(this.convenioSeleccionado) === destinoId) {
      this.convenioSeleccionado = {
        ...this.convenioSeleccionado,
        historial: [...historialMigrado],
      };
    }

    this.persistirConvenios();
  }

  private normalizarFechaDto(fecha?: string): string {
    if (!fecha) return '2026-03-25';
    const valor = fecha.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(valor)) return valor.slice(0, 10);
    return valor;
  }

  private toIsoDate(fecha: string): string {
    const valor = fecha.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor;

    const match = valor.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (match) {
      const [, dd, mm, yyyy] = match;
      return `${yyyy}-${mm}-${dd}`;
    }

    return valor;
  }

  private obtenerCreadorId(): number {
    const usuario = this.authService.getCurrentUser();
    return Number(usuario?.id ?? 0);
  }

  private async resolverAreaActiva(): Promise<number | undefined> {
    if (this.areaActivaId) return this.areaActivaId;
    if (this.areaActivaRequest) return this.areaActivaRequest;

    this.areaActivaRequest = firstValueFrom(this.comunidadService.getAreas(this.authService.isAdmin()))
      .then((areas) => {
        const areaId = this.obtenerAreaIdDesdeAreas(areas);
        if (areaId) {
          this.areaActivaId = areaId;
          console.log('Area activa resuelta para Desarrollo Comercial:', areaId);
        }
        return areaId;
      })
      .catch((error: unknown) => {
        console.error('No se pudo resolver el area activa de Desarrollo Comercial', error);
        return undefined;
      })
      .finally(() => {
        this.areaActivaRequest = undefined;
      });

    return this.areaActivaRequest;
  }

  private obtenerAreaIdDesdeAreas(areas: ComunidadArea[]): number | undefined {
    const candidatas = this.aplanarAreas(areas)
      .map((area) => ({ area, puntaje: this.puntuarAreaActual(area) }))
      .filter((item) => item.puntaje > 0)
      .sort((a, b) => b.puntaje - a.puntaje);

    return candidatas[0]?.area.id;
  }

  private aplanarAreas(areas: ComunidadArea[]): ComunidadArea[] {
    return areas.flatMap((area) => [area, ...this.aplanarAreas(area.subareas ?? [])]);
  }

  private puntuarAreaActual(area: ComunidadArea): number {
    const nombre = this.normalizarTexto(area.nombre);
    let puntaje = 0;

    if (nombre.includes('desarrollo comercial')) puntaje += 100;
    else if (nombre.includes('desarrollo')) puntaje += 80;
    else if (nombre.includes('operacion') || nombre.includes('operacion comercial')) puntaje += 60;

    if (area.padre_id !== null) puntaje += 20;
    return puntaje;
  }

  private normalizarTexto(valor: string): string {
    return (valor ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  private obtenerAreaId(): number | undefined {
    if (this.areaActivaId) return this.areaActivaId;

    const usuario = this.authService.getCurrentUser() as {
      area_id?: number | string | null;
      areaId?: number | string | null;
      area?: { id?: number | string | null; area_id?: number | string | null } | null;
      areas?: Array<
        number | string | { id?: number | string | null; area_id?: number | string | null }
      > | null;
    } | null;

    const candidatos: unknown[] = [
      usuario?.area_id,
      usuario?.areaId,
      usuario?.area?.id,
      usuario?.area?.area_id,
      usuario?.areas?.[0],
      typeof usuario?.areas?.[0] === 'object' ? usuario?.areas?.[0]?.id : undefined,
      typeof usuario?.areas?.[0] === 'object' ? usuario?.areas?.[0]?.area_id : undefined,
    ];

    for (const candidato of candidatos) {
      const areaId = this.normalizarEnteroPositivo(candidato);
      if (areaId) return areaId;
    }

    return undefined;
  }

  private normalizarEnteroPositivo(valor: unknown): number | undefined {
    const numero = Number(valor);
    return Number.isInteger(numero) && numero > 0 ? numero : undefined;
  }

  private mensajeErrorBackend(base: string, error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) return base;
    const detalle =
      typeof error.error === 'string'
        ? error.error
        : error.error?.message || error.message || error.statusText;
    const status = error.status ? ` [${error.status}]` : '';
    return `${base}${status}${detalle ? `: ${detalle}` : ''}`;
  }

  private subirArchivoAdjunto(
    convenioId: string,
    adjunto: { nombre: string; url?: string; file?: File },
    reemplazabaArchivo = false,
  ) {
    if (!adjunto.file) return;

    this.conveniosService.addArchivo(convenioId, adjunto.file).subscribe({
      next: (resp) => {
        if (!resp || !this.convenioSeleccionado) {
          alert('No se pudo guardar el archivo en la BD');
          return;
        }

        this.convenioSeleccionado = {
          ...this.convenioSeleccionado,
          archivoAdjunto: {
            id: resp.id,
            nombre: resp.nombreArchivo,
            url: resp.urlArchivo,
          },
        };
        this.conveniosOriginal = this.conveniosOriginal.map((c) =>
          this.idConvenio(c) === convenioId ? ({ ...this.convenioSeleccionado! } as Convenio) : c,
        );
        this.persistirConvenios();
        this.registrarEventoHistorialLocal(
          convenioId,
          `${reemplazabaArchivo ? 'Archivo PDF actualizado' : 'Archivo PDF adjuntado'}: ${resp.nombreArchivo}`,
        );
        this.hidratarHistorial(convenioId);
      },
      error: (error: unknown) => {
        console.error('No se pudo guardar el archivo', error);
        alert(this.mensajeErrorBackend('No se pudo guardar el archivo en la BD', error));
      },
    });
  }

  private hidratarArchivoAdjunto(convenioId: string) {
    if (!this.convenioSeleccionado || !/^\d+$/.test(convenioId)) return;

    this.conveniosService.getArchivosByConvenio(convenioId).subscribe((archivos) => {
      const archivo = archivos[0];
      if (
        !archivo ||
        !this.convenioSeleccionado ||
        this.idConvenio(this.convenioSeleccionado) !== convenioId
      )
        return;

      this.convenioSeleccionado = {
        ...this.convenioSeleccionado,
        archivoAdjunto: {
          id: archivo.id,
          nombre: archivo.nombreArchivo,
          url: archivo.urlArchivo,
        },
      };

      this.conveniosOriginal = this.conveniosOriginal.map((c) =>
        this.idConvenio(c) === convenioId ? ({ ...this.convenioSeleccionado! } as Convenio) : c,
      );
      this.persistirConvenios();
    });
  }

  private hidratarComentarios(convenioId: string) {
    if (!this.convenioSeleccionado || !/^\d+$/.test(convenioId)) return;

    this.conveniosService.getComentariosByConvenio(convenioId).subscribe((comentarios) => {
      if (!this.convenioSeleccionado || this.idConvenio(this.convenioSeleccionado) !== convenioId)
        return;

      this.convenioSeleccionado = {
        ...this.convenioSeleccionado,
        comentarios: comentarios.map((comentario) => ({
          id: comentario.id,
          texto: this.formatearComentario(comentario),
        })),
      };

      this.conveniosOriginal = this.conveniosOriginal.map((c) =>
        this.idConvenio(c) === convenioId ? ({ ...this.convenioSeleccionado! } as Convenio) : c,
      );
      this.persistirConvenios();
    });
  }

  private formatearComentario(comentario: {
    comentario: string;
    usuarioNombre?: string | null;
    fechaCreacion?: string;
    createdAt?: string;
    fecha?: string;
  }): string {
    const partes: string[] = [];
    const usuario = comentario.usuarioNombre?.trim();
    const fechaRaw = comentario.fechaCreacion ?? comentario.createdAt ?? comentario.fecha;

    if (usuario) {
      partes.push(usuario);
    }

    if (fechaRaw) {
      const fecha = new Date(fechaRaw);
      partes.push(Number.isNaN(fecha.getTime()) ? fechaRaw : this.formatearFecha(fecha));
    }

    partes.push(comentario.comentario);

    return partes.join(' · ');
  }

  private hidratarHistorial(convenioId: string) {
    if (!this.convenioSeleccionado || !/^\d+$/.test(convenioId)) return;

    this.conveniosService.getHistorialByConvenio(convenioId).subscribe((historial) => {
      if (!this.convenioSeleccionado || this.idConvenio(this.convenioSeleccionado) !== convenioId)
        return;

      const historialCombinado = this.combinarHistorial([
        ...historial.map((evento) => this.formatearEventoHistorial(evento)),
        ...this.obtenerHistorialConvenio(convenioId),
      ]);
      this.asignarHistorialConvenio(convenioId, historialCombinado);
    });
  }

  private slug(nombre: string): string {
    return nombre
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  private idConvenio(c: Convenio): string {
    return c.id ?? this.slug(c.nombre);
  }

  private liberarArchivo(convenio: Convenio | null) {
    if (convenio?.archivoAdjunto?.url?.startsWith('blob:')) {
      URL.revokeObjectURL(convenio.archivoAdjunto.url);
    }
  }

  private liberarLogo() {
    if (this.logoObjectUrl) {
      URL.revokeObjectURL(this.logoObjectUrl);
      this.logoObjectUrl = undefined;
    }
  }

  private persistirConvenios() {
    try {
      const serializable = this.conveniosOriginal.map((c) => ({
        ...c,
        archivoAdjunto: c.archivoAdjunto ? { nombre: c.archivoAdjunto.nombre } : undefined,
      }));
      localStorage.setItem(this.storageKey, JSON.stringify(serializable));
    } catch (e) {
      console.error('No se pudo guardar convenios en localStorage', e);
    }
  }

  private cargarPersistidos(): Convenio[] | null {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return null;
      const data = JSON.parse(raw) as Convenio[];
      return Array.isArray(data) ? data : null;
    } catch (e) {
      console.error('No se pudo leer convenios desde localStorage', e);
      return null;
    }
  }

  private persistirSeleccion(id: string) {
    try {
      localStorage.setItem(this.storageSelectedKey, id);
    } catch (e) {
      console.error('No se pudo guardar la selección de convenio', e);
    }
  }

  private restaurarSeleccionPersistida() {
    try {
      const id = localStorage.getItem(this.storageSelectedKey);
      if (!id) return;
      const encontrado = this.conveniosOriginal.find((c) => this.idConvenio(c) === id);
      if (encontrado) {
        this.abrirDetalle(encontrado);
      }
    } catch (e) {
      console.error('No se pudo restaurar la selección de convenio', e);
    }
  }

  cerrarNotificacion() {
    this.notificacion = null;
    this.limpiarNotificacionProgramada();
  }

  private mostrarNotificacion(tipo: TipoNotificacion, mensaje: string) {
    this.notificacion = { tipo, mensaje };
    this.limpiarNotificacionProgramada();
    this.notificationTimeoutId = window.setTimeout(() => {
      this.notificacion = null;
      this.notificationTimeoutId = undefined;
    }, 3500);
  }

  private limpiarNotificacionProgramada() {
    if (this.notificationTimeoutId) {
      window.clearTimeout(this.notificationTimeoutId);
      this.notificationTimeoutId = undefined;
    }
  }
}
type Estado = 'pendiente' | 'proceso' | 'convenio' | 'reunion' | 'firmado' | 'cancelado';
type ConexionFiltro = 'todos' | 'Convenio' | 'Alianza';
type ComentarioItem = { id?: number; texto: string };

type Convenio = {
  id?: string;
  nombre: string;
  fecha: string;
  siglas: string;
  color: string;
  logo?: string;
  estado: Estado | string;
  estadoLabel?: string;
  ruc?: string;
  rubro?: string;
  contacto?: string;
  telefono?: string;
  tipo?: string;
  conexion?: string;
  historial?: string[];
  comentarios?: ComentarioItem[];
  archivoAdjunto?: { id?: number; nombre: string; url?: string; file?: File };
};

type ActividadEstado = EstadoActividad;
type FiltroActividad = 'todos' | ActividadEstado;
type ActividadEstadoClase = 'pendiente' | 'proceso' | 'paralizado' | 'firmado';

type Actividad = {
  id: string;
  titulo: string;
  descripcion: string;
  fechaCreacion?: string;
  fechaLimite: string;
  estado: ActividadEstado;
  enlaces?: ActividadEnlace[];
};

type ActividadEnlace = {
  nombre: string;
  url: string;
};

type TipoNotificacion = 'success' | 'error';

type NotificacionToast = {
  tipo: TipoNotificacion;
  mensaje: string;
};

type ActividadForm = {
  titulo: string;
  descripcion: string;
  estado: ActividadEstado;
  fechaLimite: string;
  enlaces: ActividadEnlace[];
};
