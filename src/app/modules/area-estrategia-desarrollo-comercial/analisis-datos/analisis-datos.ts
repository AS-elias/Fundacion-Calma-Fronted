import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin, of, switchMap } from 'rxjs';
import { AnalisisDatosService } from './analisis-datos.service';

type CategoriaPanel = 'estrategico' | 'comercial' | 'espacios' | 'comunicacion';
type PanelClave =
  | 'mapeo-educativo'
  | 'empresas-potenciales'
  | 'venues'
  | 'difusion-participacion';
type TipoColegioFiltro = 'todos' | 'particular' | 'publica';
type EstadoEmpresaFiltro = 'todos' | 'convenio' | 'alianza';
type EstadoVenueFiltro = 'todos' | 'pendiente' | 'contactado';
type EstadoDifusionFiltro = 'todos' | 'pendiente' | 'contactado';

type PanelDato = {
  clave: PanelClave;
  categoria: CategoriaPanel;
  etiqueta: string;
  titulo: string;
  descripcion: string;
  icono: string;
};

type EstadoTarea = 'pendiente' | 'en-proceso' | 'paralizado' | 'completado';

type TareaDato = {
  id: string;
  titulo: string;
  descripcion: string;
  estado: EstadoTarea;
  etiquetaEstado: string;
  fechaCreacion: string;
  fechaLimite?: string;
  enlaces?: TareaEnlace[];
};

type TareaEnlace = {
  id?: string | number;
  nombre: string;
  url: string;
};

type TareaForm = {
  titulo: string;
  descripcion: string;
  estado: EstadoTarea;
  fechaLimite: string;
  enlaces: TareaEnlace[];
};

type ColegioDato = {
  id: string;
  codigoModular: string;
  nombre: string;
  correo: string;
  telefono: string;
  nivel: string;
  director: string;
  tipo: 'Particular' | 'Pública';
  ugel: string;
  departamento: string;
  distrito: string;
  zona: string;
  cantidadAlumnos: number;
  direccion: string;
};

type ColegioBorrador = ColegioDato;

type EstadoEmpresa = 'Convenio' | 'Alianza';

type EmpresaDato = {
  id: string;
  ruc: string;
  nombre: string;
  correo: string;
  telefonoFijo: string;
  celular: string;
  departamento: string;
  distrito: string;
  direccion: string;
  sector: string;
  estado: EstadoEmpresa;
  descripcion: string;
};

type EmpresaBorrador = EmpresaDato;

type VenueDato = {
  id: string;
  nombre: string;
  departamento: string;
  distrito: string;
  direccion: string;
  celular: string;
  correo: string;
  capacidadPersonas: number;
  estado: 'Pendiente' | 'Contactado';
  sitioWeb: string;
  detalles: string;
};

type VenueBorrador = VenueDato;

type DifusionDato = {
  id: string;
  nombre: string;
  tipo: string;
  plataforma: string;
  lugar: string;
  contacto: string;
  celular: string;
  correo: string;
  fecha: string;
  estado: 'Pendiente' | 'Contactado';
  observaciones: string;
};

type DifusionBorrador = DifusionDato;

type TipoNotificacion = 'success' | 'error';

type NotificacionToast = {
  tipo: TipoNotificacion;
  mensaje: string;
};

@Component({
  selector: 'app-analisis-datos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './analisis-datos.html',
  styleUrls: ['./analisis-datos.scss'],
})
export class AnalisisDatos implements OnInit {
  panelActivo: PanelClave | null = null;
  mostrandoFormularioTarea = false;
  tareaSeleccionada: TareaDato | null = null;
  tareaEditando: TareaDato | null = null;
  colegioPorEliminar: ColegioDato | null = null;
  colegioBorrador: ColegioBorrador | null = null;
  colegioBorradorEsNuevo = false;
  empresaPorEliminar: EmpresaDato | null = null;
  empresaBorrador: EmpresaBorrador | null = null;
  empresaBorradorEsNuevo = false;
  venuePorEliminar: VenueDato | null = null;
  venueBorrador: VenueBorrador | null = null;
  venueBorradorEsNuevo = false;
  difusionPorEliminar: DifusionDato | null = null;
  difusionBorrador: DifusionBorrador | null = null;
  difusionBorradorEsNuevo = false;
  notificacion: NotificacionToast | null = null;
  private notificationTimeoutId?: number;
  busquedaColegio = '';
  busquedaEmpresa = '';
  busquedaVenue = '';
  busquedaDifusion = '';
  tipoColegioFiltro: TipoColegioFiltro = 'todos';
  estadoEmpresaFiltro: EstadoEmpresaFiltro = 'todos';
  tipoVenueFiltro: EstadoVenueFiltro = 'todos';
  estadoDifusionFiltro: EstadoDifusionFiltro = 'todos';
  nuevaTarea: TareaForm = this.crearTareaForm();

  readonly paneles: PanelDato[] = [
    {
      clave: 'mapeo-educativo',
      categoria: 'estrategico',
      etiqueta: 'Estratégico',
      titulo: 'Mapeo Educativo',
      descripcion: 'Identificación de colegios con alta violencia escolar para alianzas',
      icono: 'pi pi-building-columns',
    },
    {
      clave: 'empresas-potenciales',
      categoria: 'comercial',
      etiqueta: 'Comercial',
      titulo: 'Empresas potenciales - 2026',
      descripcion: 'Prospección de convenios y alianzas empresariales',
      icono: 'pi pi-briefcase',
    },
    {
      clave: 'venues',
      categoria: 'espacios',
      etiqueta: 'Espacios',
      titulo: 'Venues',
      descripcion: 'Identificación de espacios para eventos y actividades',
      icono: 'pi pi-calendar',
    },
    {
      clave: 'difusion-participacion',
      categoria: 'comunicacion',
      etiqueta: 'Comunicación',
      titulo: 'Difusión y participación',
      descripcion: 'Gestión de difusión y participación en medios y eventos',
      icono: 'pi pi-megaphone',
    },
  ];

  tareasEnProceso: TareaDato[] = [
    {
      id: 'tarea-proceso-1',
      titulo: 'Recopilación de datos',
      descripcion: 'Colegios de UGEL 04',
      estado: 'pendiente',
      etiquetaEstado: 'Pendiente',
      fechaCreacion: '25/03/2026',
      fechaLimite: '2026-03-25',
      enlaces: [
        { nombre: 'Abrir Documento', url: 'https://docs.google.com/' },
        { nombre: 'Abrir Documento', url: 'https://docs.google.com/' },
      ],
    },
  ];

  tareasConcluidas: TareaDato[] = [
    {
      id: 'tarea-concluida-1',
      titulo: 'Recopilación de datos',
      descripcion: 'Colegios de UGEL 04',
      estado: 'completado',
      etiquetaEstado: 'Completado',
      fechaCreacion: '25/03/2026',
      fechaLimite: '2026-03-25',
      enlaces: [{ nombre: 'Abrir Documento', url: 'https://docs.google.com/' }],
    },
  ];

  colegios: ColegioDato[] = [
    {
      id: 'colegio-1',
      codigoModular: '0324608',
      nombre: 'San Vicente de Paul',
      correo: 'secretaria@csvp.edu.pe',
      telefono: '999999999',
      nivel: 'Primaria',
      director: 'Chavez Luis Roger Ulises',
      tipo: 'Particular',
      ugel: 'UGEL 01',
      departamento: 'Lima',
      distrito: 'Surquillo',
      zona: 'Urbana',
      cantidadAlumnos: 291,
      direccion: 'Mz H lote 8',
    },
    {
      id: 'colegio-2',
      codigoModular: '0324609',
      nombre: 'San Vicente de Paul',
      correo: 'secretaria@csvp.edu.pe',
      telefono: '999999999',
      nivel: 'Primaria',
      director: 'Chavez Luis Roger Ulises',
      tipo: 'Particular',
      ugel: 'UGEL 01',
      departamento: 'Lima',
      distrito: 'Surquillo',
      zona: 'Urbana',
      cantidadAlumnos: 291,
      direccion: 'Mz H lote 8',
    },
  ];

  empresas: EmpresaDato[] = [
    {
      id: 'empresa-1',
      ruc: '20602844219',
      nombre: 'Inversiones Distribuciones SAC',
      correo: 'operaciones@fulegsa.com.pe',
      telefonoFijo: '01025897',
      celular: '999999999',
      departamento: 'Lima',
      distrito: 'Surquillo',
      direccion: 'Mz H lote 8',
      sector: 'Educacion privada',
      estado: 'Convenio',
      descripcion: 'Esta empresa trabaja con la fundacion romero.',
    },
    {
      id: 'empresa-2',
      ruc: '20602844229',
      nombre: 'Inversiones Distribuciones EIRL',
      correo: 'operaciones@fulegsa.com.pe',
      telefonoFijo: '01025897',
      celular: '999999999',
      departamento: 'Lima',
      distrito: 'Surquillo',
      direccion: 'Mz H lote 8',
      sector: 'Educacion privada',
      estado: 'Alianza',
      descripcion: 'Esta empresa trabajo con la fundacion romero.',
    },
  ];

  venues: VenueDato[] = [
    {
      id: 'venue-1',
      nombre: 'Villa Lucumo',
      departamento: 'Lima',
      distrito: 'Surquillo',
      direccion: 'Pachacamac, Lima',
      celular: '972162178',
      correo: 'villa.lucumo@gmail.com',
      capacidadPersonas: 200,
      estado: 'Contactado',
      sitioWeb: 'https://www.facebook.com/p/Villa-L%C3%BAcumo',
      detalles: 'Este venue trabajo en la fundacion romero',
    },
    {
      id: 'venue-2',
      nombre: 'Villa Lucumo',
      departamento: 'Lima',
      distrito: 'Surquillo',
      direccion: 'Pachacamac, Lima',
      celular: '972162178',
      correo: 'villa.lucumo@gmail.com',
      capacidadPersonas: 200,
      estado: 'Contactado',
      sitioWeb: 'https://www.facebook.com/p/Villa-L%C3%BAcumo',
      detalles: 'Este venue trabajo en la fundacion romero',
    },
  ];

  difusiones: DifusionDato[] = [
    {
      id: 'difusion-1',
      nombre: 'Radio Exitosa',
      tipo: 'Radio',
      plataforma: 'YouTube',
      lugar: 'Lurin, Lima',
      contacto: 'Maria',
      celular: '972162178',
      correo: 'Maria.v.@gmail.com',
      fecha: '12/12/2026',
      estado: 'Contactado',
      observaciones: 'Este medio de comunicacion ya trabajo antes con una fundacion',
    },
    {
      id: 'difusion-2',
      nombre: 'Radio Exitosa',
      tipo: 'Radio',
      plataforma: 'YouTube',
      lugar: 'Lurin, Lima',
      contacto: 'Maria',
      celular: '972162178',
      correo: 'Maria.v.@gmail.com',
      fecha: '12/12/2026',
      estado: 'Contactado',
      observaciones: 'Este medio de comunicacion ya trabajo antes con una fundacion',
    },
  ];

  constructor(private analisisService: AnalisisDatosService) {}

  ngOnInit(): void {
    this.cargarDatosBackend();
  }

  get mostrandoRegistroColegios(): boolean {
    return this.panelActivo === 'mapeo-educativo';
  }

  get mostrandoRegistroEmpresas(): boolean {
    return this.panelActivo === 'empresas-potenciales';
  }

  get mostrandoRegistroVenues(): boolean {
    return this.panelActivo === 'venues';
  }

  get mostrandoRegistroDifusion(): boolean {
    return this.panelActivo === 'difusion-participacion';
  }

  get colegiosFiltrados(): ColegioDato[] {
    const termino = this.busquedaColegio.trim().toLowerCase();

    return this.colegios.filter((colegio) => {
      const coincideBusqueda = termino
        ? [
            colegio.codigoModular,
            colegio.nombre,
            colegio.correo,
            colegio.director,
            colegio.distrito,
            colegio.departamento,
          ].some((valor) => valor.toLowerCase().includes(termino))
        : true;

      const coincideTipo =
        this.tipoColegioFiltro === 'todos'
          ? true
          : this.normalizarTextoPlano(colegio.tipo) === this.tipoColegioFiltro;

      return coincideBusqueda && coincideTipo;
    });
  }

  get empresasFiltradas(): EmpresaDato[] {
    const termino = this.busquedaEmpresa.trim().toLowerCase();

    return this.empresas.filter((empresa) => {
      const coincideBusqueda = termino
        ? [
            empresa.ruc,
            empresa.nombre,
            empresa.correo,
            empresa.telefonoFijo,
            empresa.celular,
            empresa.departamento,
            empresa.distrito,
            empresa.sector,
            empresa.descripcion,
          ].some((valor) => valor.toLowerCase().includes(termino))
        : true;

      const coincideEstado =
        this.estadoEmpresaFiltro === 'todos'
          ? true
          : empresa.estado.toLowerCase() === this.estadoEmpresaFiltro;

      return coincideBusqueda && coincideEstado;
    });
  }

  get venuesFiltrados(): VenueDato[] {
    const termino = this.busquedaVenue.trim().toLowerCase();

    return this.venues.filter((venue) => {
      const coincideBusqueda = termino
        ? [
            venue.nombre,
            venue.departamento,
            venue.distrito,
            venue.direccion,
            venue.celular,
            venue.correo,
            venue.sitioWeb,
            venue.detalles,
            venue.estado,
            String(venue.capacidadPersonas),
          ].some((valor) => valor.toLowerCase().includes(termino))
        : true;

      const coincideEstado =
        this.tipoVenueFiltro === 'todos'
          ? true
          : venue.estado.toLowerCase() === this.tipoVenueFiltro;

      return coincideBusqueda && coincideEstado;
    });
  }

  get difusionesFiltradas(): DifusionDato[] {
    const termino = this.busquedaDifusion.trim().toLowerCase();

    return this.difusiones.filter((difusion) => {
      const coincideBusqueda = termino
        ? [
            difusion.nombre,
            difusion.tipo,
            difusion.plataforma,
            difusion.lugar,
            difusion.contacto,
            difusion.celular,
            difusion.correo,
            difusion.fecha,
            difusion.estado,
            difusion.observaciones,
          ].some((valor) => valor.toLowerCase().includes(termino))
        : true;

      const coincideEstado =
        this.estadoDifusionFiltro === 'todos'
          ? true
          : difusion.estado.toLowerCase() === this.estadoDifusionFiltro;

      return coincideBusqueda && coincideEstado;
    });
  }

  abrirPanel(panel: PanelDato): void {
    if (
      panel.clave !== 'mapeo-educativo' &&
      panel.clave !== 'empresas-potenciales' &&
      panel.clave !== 'venues' &&
      panel.clave !== 'difusion-participacion'
    ) {
      return;
    }

    this.panelActivo = panel.clave;
  }

  cerrarRegistroColegios(): void {
    this.cancelarEdicionColegio();
    this.panelActivo = null;
  }

  cerrarRegistroEmpresas(): void {
    this.cancelarEdicionEmpresa();
    this.cancelarEliminacionEmpresa();
    this.panelActivo = null;
  }

  cerrarRegistroVenues(): void {
    this.cancelarEdicionVenue();
    this.cancelarEliminacionVenue();
    this.panelActivo = null;
  }

  cerrarRegistroDifusion(): void {
    this.cancelarEdicionDifusion();
    this.cancelarEliminacionDifusion();
    this.panelActivo = null;
  }

  agregarColegio(): void {
    if (this.colegioBorrador) {
      return;
    }

    this.colegioBorradorEsNuevo = true;
    this.colegioBorrador = this.crearColegioVacio();
  }

  editarColegio(colegio: ColegioDato): void {
    if (this.colegioBorrador) {
      return;
    }

    this.colegioBorradorEsNuevo = false;
    this.colegioBorrador = { ...colegio };
  }

  guardarColegio(): void {
    if (!this.colegioBorrador) {
      return;
    }

    const esNuevo = this.colegioBorradorEsNuevo;
    const colegioGuardado = {
      ...this.colegioBorrador,
      codigoModular: this.colegioBorrador.codigoModular.trim(),
      nombre: this.colegioBorrador.nombre.trim(),
      correo: this.colegioBorrador.correo.trim(),
      telefono: this.colegioBorrador.telefono.trim(),
      nivel: this.colegioBorrador.nivel.trim(),
      director: this.colegioBorrador.director.trim(),
      tipo: this.normalizarTipoColegio(this.colegioBorrador.tipo),
      ugel: this.colegioBorrador.ugel.trim(),
      departamento: this.colegioBorrador.departamento.trim(),
      distrito: this.colegioBorrador.distrito.trim(),
      zona: this.colegioBorrador.zona.trim(),
      direccion: this.colegioBorrador.direccion.trim(),
    };
    const payload = this.toColegioPayload(colegioGuardado);
    const request = esNuevo
      ? this.analisisService.createColegio(payload)
      : this.analisisService.updateColegio(colegioGuardado.id, payload);

    request.subscribe({
      next: () => {
        this.cancelarEdicionColegio();
        this.cargarColegios();
        this.mostrarNotificacion(
          'success',
          esNuevo ? 'Se guardo exitosamente.' : 'Se guardo los cambios exitosamente.',
        );
      },
      error: () => this.mostrarNotificacion('error', 'No se pudo guardar el colegio.'),
    });
  }

  cancelarEdicionColegio(): void {
    this.colegioBorrador = null;
    this.colegioBorradorEsNuevo = false;
  }

  solicitarEliminarColegio(colegio: ColegioDato): void {
    this.colegioPorEliminar = colegio;
  }

  cancelarEliminacionColegio(): void {
    this.colegioPorEliminar = null;
  }

  confirmarEliminacionColegio(): void {
    if (!this.colegioPorEliminar) {
      return;
    }

    const colegio = this.colegioPorEliminar;
    this.analisisService.deleteColegio(colegio.id).subscribe({
      next: () => {
        this.colegioPorEliminar = null;
        this.cargarColegios();
        this.mostrarNotificacion('success', 'Colegio eliminado exitosamente.');
      },
      error: () => this.mostrarNotificacion('error', 'No se pudo eliminar el colegio.'),
    });
  }

  estaEditandoColegio(colegio: ColegioDato): boolean {
    return this.colegioBorrador?.id === colegio.id;
  }

  agregarEmpresa(): void {
    if (this.empresaBorrador) {
      return;
    }

    this.empresaBorradorEsNuevo = true;
    this.empresaBorrador = this.crearEmpresaVacia();
  }

  editarEmpresa(empresa: EmpresaDato): void {
    if (this.empresaBorrador) {
      return;
    }

    this.empresaBorradorEsNuevo = false;
    this.empresaBorrador = { ...empresa };
  }

  guardarEmpresa(): void {
    if (!this.empresaBorrador) {
      return;
    }

    const esNuevo = this.empresaBorradorEsNuevo;
    const empresaGuardada = {
      ...this.empresaBorrador,
      ruc: this.empresaBorrador.ruc.trim(),
      nombre: this.empresaBorrador.nombre.trim(),
      correo: this.empresaBorrador.correo.trim(),
      telefonoFijo: this.empresaBorrador.telefonoFijo.trim(),
      celular: this.empresaBorrador.celular.trim(),
      departamento: this.empresaBorrador.departamento.trim(),
      distrito: this.empresaBorrador.distrito.trim(),
      direccion: this.empresaBorrador.direccion.trim(),
      sector: this.empresaBorrador.sector.trim(),
      estado: this.empresaBorrador.estado,
      descripcion: this.empresaBorrador.descripcion.trim(),
    };

    const payload = this.toEmpresaPayload(empresaGuardada);
    const request = esNuevo
      ? this.analisisService.createEmpresa(payload)
      : this.analisisService.updateEmpresa(empresaGuardada.id, payload);

    request.subscribe({
      next: () => {
        this.cancelarEdicionEmpresa();
        this.cargarEmpresas();
        this.mostrarNotificacion(
          'success',
          esNuevo ? 'Se guardo exitosamente.' : 'Se guardo los cambios exitosamente.',
        );
      },
      error: () => this.mostrarNotificacion('error', 'No se pudo guardar la empresa.'),
    });
  }

  cancelarEdicionEmpresa(): void {
    this.empresaBorrador = null;
    this.empresaBorradorEsNuevo = false;
  }

  solicitarEliminarEmpresa(empresa: EmpresaDato): void {
    this.empresaPorEliminar = empresa;
  }

  cancelarEliminacionEmpresa(): void {
    this.empresaPorEliminar = null;
  }

  confirmarEliminacionEmpresa(): void {
    if (!this.empresaPorEliminar) {
      return;
    }

    this.analisisService.deleteEmpresa(this.empresaPorEliminar.id).subscribe({
      next: () => {
        this.empresaPorEliminar = null;
        this.cargarEmpresas();
        this.mostrarNotificacion('success', 'Empresa eliminada exitosamente.');
      },
      error: () => this.mostrarNotificacion('error', 'No se pudo eliminar la empresa.'),
    });
  }

  estaEditandoEmpresa(empresa: EmpresaDato): boolean {
    return this.empresaBorrador?.id === empresa.id;
  }

  agregarVenue(): void {
    if (this.venueBorrador) {
      return;
    }

    this.venueBorradorEsNuevo = true;
    this.venueBorrador = this.crearVenueVacio();
  }

  editarVenue(venue: VenueDato): void {
    if (this.venueBorrador) {
      return;
    }

    this.venueBorradorEsNuevo = false;
    this.venueBorrador = { ...venue };
  }

  guardarVenue(): void {
    if (!this.venueBorrador) {
      return;
    }

    const esNuevo = this.venueBorradorEsNuevo;
    const venueGuardado = {
      ...this.venueBorrador,
      nombre: this.venueBorrador.nombre.trim(),
      departamento: this.venueBorrador.departamento.trim(),
      distrito: this.venueBorrador.distrito.trim(),
      direccion: this.venueBorrador.direccion.trim(),
      celular: this.venueBorrador.celular.trim(),
      correo: this.venueBorrador.correo.trim(),
      capacidadPersonas: this.venueBorrador.capacidadPersonas,
      estado: this.venueBorrador.estado,
      sitioWeb: this.venueBorrador.sitioWeb.trim(),
      detalles: this.venueBorrador.detalles.trim(),
    };

    const payload = this.toVenuePayload(venueGuardado);
    const request = esNuevo
      ? this.analisisService.createVenue(payload)
      : this.analisisService.updateVenue(venueGuardado.id, payload);

    request.subscribe({
      next: () => {
        this.cancelarEdicionVenue();
        if (esNuevo) {
          this.busquedaVenue = '';
          this.tipoVenueFiltro = 'todos';
        }
        this.cargarVenues();
        this.mostrarNotificacion(
          'success',
          esNuevo ? 'Se guardo exitosamente.' : 'Se guardo los cambios exitosamente.',
        );
      },
      error: () => this.mostrarNotificacion('error', 'No se pudo guardar el venue.'),
    });
  }

  cancelarEdicionVenue(): void {
    this.venueBorrador = null;
    this.venueBorradorEsNuevo = false;
  }

  solicitarEliminarVenue(venue: VenueDato): void {
    this.venuePorEliminar = venue;
  }

  cancelarEliminacionVenue(): void {
    this.venuePorEliminar = null;
  }

  confirmarEliminacionVenue(): void {
    if (!this.venuePorEliminar) {
      return;
    }

    this.analisisService.deleteVenue(this.venuePorEliminar.id).subscribe({
      next: () => {
        this.venuePorEliminar = null;
        this.cargarVenues();
        this.mostrarNotificacion('success', 'Venue eliminado exitosamente.');
      },
      error: () => this.mostrarNotificacion('error', 'No se pudo eliminar el venue.'),
    });
  }

  estaEditandoVenue(venue: VenueDato): boolean {
    return this.venueBorrador?.id === venue.id;
  }

  agregarDifusion(): void {
    if (this.difusionBorrador) {
      return;
    }

    this.difusionBorradorEsNuevo = true;
    this.difusionBorrador = this.crearDifusionVacia();
  }

  editarDifusion(difusion: DifusionDato): void {
    if (this.difusionBorrador) {
      return;
    }

    this.difusionBorradorEsNuevo = false;
    this.difusionBorrador = { ...difusion };
  }

  guardarDifusion(): void {
    if (!this.difusionBorrador) {
      return;
    }

    const esNuevo = this.difusionBorradorEsNuevo;
    const difusionGuardada = {
      ...this.difusionBorrador,
      nombre: this.difusionBorrador.nombre.trim(),
      tipo: this.difusionBorrador.tipo.trim(),
      plataforma: this.difusionBorrador.plataforma.trim(),
      lugar: this.difusionBorrador.lugar.trim(),
      contacto: this.difusionBorrador.contacto.trim(),
      celular: this.difusionBorrador.celular.trim(),
      correo: this.difusionBorrador.correo.trim(),
      fecha: this.difusionBorrador.fecha.trim(),
      estado: this.difusionBorrador.estado,
      observaciones: this.difusionBorrador.observaciones.trim(),
    };

    const payload = this.toDifusionPayload(difusionGuardada);
    const request = esNuevo
      ? this.analisisService.createDifusion(payload)
      : this.analisisService.updateDifusion(difusionGuardada.id, payload);

    request.subscribe({
      next: () => {
        this.cancelarEdicionDifusion();
        if (esNuevo) {
          this.busquedaDifusion = '';
          this.estadoDifusionFiltro = 'todos';
        }
        this.cargarDifusiones();
        this.mostrarNotificacion(
          'success',
          esNuevo ? 'Se guardo exitosamente.' : 'Se guardo los cambios exitosamente.',
        );
      },
      error: () => this.mostrarNotificacion('error', 'No se pudo guardar la difusión.'),
    });
  }

  cancelarEdicionDifusion(): void {
    this.difusionBorrador = null;
    this.difusionBorradorEsNuevo = false;
  }

  solicitarEliminarDifusion(difusion: DifusionDato): void {
    this.difusionPorEliminar = difusion;
  }

  cancelarEliminacionDifusion(): void {
    this.difusionPorEliminar = null;
  }

  confirmarEliminacionDifusion(): void {
    if (!this.difusionPorEliminar) {
      return;
    }

    this.analisisService.deleteDifusion(this.difusionPorEliminar.id).subscribe({
      next: () => {
        this.difusionPorEliminar = null;
        this.cargarDifusiones();
        this.mostrarNotificacion('success', 'Difusión eliminada exitosamente.');
      },
      error: () => this.mostrarNotificacion('error', 'No se pudo eliminar la difusión.'),
    });
  }

  estaEditandoDifusion(difusion: DifusionDato): boolean {
    return this.difusionBorrador?.id === difusion.id;
  }

  abrirFormularioTarea(): void {
    this.mostrandoFormularioTarea = true;
    this.tareaEditando = null;
    this.nuevaTarea = this.crearTareaForm();
  }

  cerrarFormularioTarea(): void {
    this.mostrandoFormularioTarea = false;
    this.tareaEditando = null;
    this.nuevaTarea = this.crearTareaForm();
  }

  seleccionarEstadoTarea(estado: EstadoTarea): void {
    this.nuevaTarea.estado = estado;
  }

  agregarEnlaceTarea(): void {
    this.nuevaTarea.enlaces = [...this.nuevaTarea.enlaces, { nombre: '', url: '' }];
  }

  crearTarea(): void {
    const titulo = this.nuevaTarea.titulo.trim();
    const descripcion = this.nuevaTarea.descripcion.trim();
    const esEdicion = !!this.tareaEditando;

    if (!titulo || !descripcion) {
      return;
    }

    const enlaces = this.nuevaTarea.enlaces.filter(
      (enlace) => enlace.nombre.trim() || enlace.url.trim(),
    );
    const tareaGuardada: TareaDato = {
      id: this.tareaEditando?.id ?? `tarea-${Date.now()}`,
      titulo,
      descripcion,
      estado: this.nuevaTarea.estado,
      etiquetaEstado: this.obtenerEtiquetaEstado(this.nuevaTarea.estado),
      fechaCreacion: this.tareaEditando?.fechaCreacion ?? this.formatearFechaActual(),
      fechaLimite: this.nuevaTarea.fechaLimite,
      enlaces,
    };
    const payload = this.toTareaPayload(tareaGuardada);
    const request = esEdicion
      ? this.analisisService.updateTarea(tareaGuardada.id, payload)
      : this.analisisService.createTarea(payload);

    request
      .pipe(
        switchMap((tareaRespuesta) => {
          const tareaId = tareaRespuesta?.id ?? (esEdicion ? tareaGuardada.id : undefined);
          if (!tareaId || !enlaces.length) return of([]);

          return this.analisisService.getTareaEnlaces(tareaId).pipe(
            switchMap((enlacesExistentes) => {
              const enlacesNormalizados = enlacesExistentes.map((enlace) =>
                this.fromTareaEnlaceApi(enlace),
              );
              const enlacesFaltantes = enlaces.filter(
                (enlace) =>
                  !enlacesNormalizados.some(
                    (existente) => existente.nombre === enlace.nombre && existente.url === enlace.url,
                  ),
              );

              if (!enlacesFaltantes.length) return of(enlacesExistentes);
              return forkJoin(
                enlacesFaltantes.map((enlace) =>
                  this.analisisService.createTareaEnlace({
                    tarea_id: tareaId,
                    nombre: enlace.nombre,
                    url: enlace.url,
                  }),
                ),
              );
            }),
          );
        }),
      )
      .subscribe({
        next: () => {
          this.cerrarFormularioTarea();
          this.cargarTareas();
          this.mostrarNotificacion(
            'success',
            esEdicion ? 'Se guardaron los cambios exitosamente.' : 'Se creó exitosamente.',
          );
        },
        error: () => this.mostrarNotificacion('error', 'No se pudo guardar la tarea.'),
      });
  }

  abrirDetalleTarea(tarea: TareaDato): void {
    this.tareaSeleccionada = tarea;
    this.analisisService.getTareaEnlaces(tarea.id).subscribe((enlaces) => {
      if (this.tareaSeleccionada?.id !== tarea.id) return;
      if (!enlaces.length) return;
      this.tareaSeleccionada.enlaces = enlaces.map((enlace) => this.fromTareaEnlaceApi(enlace));
    });
  }

  cerrarDetalleTarea(): void {
    this.tareaSeleccionada = null;
  }

  editarTareaSeleccionada(): void {
    if (!this.tareaSeleccionada) {
      return;
    }

    this.tareaEditando = this.tareaSeleccionada;
    this.nuevaTarea = {
      titulo: this.tareaSeleccionada.titulo,
      descripcion: this.tareaSeleccionada.descripcion,
      estado: this.tareaSeleccionada.estado,
      fechaLimite: this.tareaSeleccionada.fechaLimite ?? '',
      enlaces:
        this.tareaSeleccionada.enlaces?.length
          ? this.tareaSeleccionada.enlaces.map((enlace) => ({ ...enlace }))
          : [{ nombre: '', url: '' }],
    };
    this.tareaSeleccionada = null;
    this.mostrandoFormularioTarea = true;
  }

  claseEstadoTarea(estado: EstadoTarea): string {
    if (estado === 'completado') {
      return 'task-card__status--completado';
    }

    if (estado === 'paralizado') {
      return 'task-card__status--paralizado';
    }

    if (estado === 'en-proceso') {
      return 'task-card__status--proceso';
    }

    return 'task-card__status--pendiente';
  }

  exportarColegiosExcel(): void {
    this.descargarExcel(
      'colegios-analisis-datos',
      'Colegios',
      [
        'N°',
        'Código modular',
        'Nombre colegio',
        'Correo',
        'Teléfono',
        'Nivel',
        'Director',
        'Tipo',
        'UGEL',
        'Departamento',
        'Distrito',
        'Zona',
        'Cantidad alumnos',
        'Dirección IE',
      ],
      this.colegiosFiltrados.map((colegio, index) => [
        index + 1,
        colegio.codigoModular,
        colegio.nombre,
        colegio.correo,
        colegio.telefono,
        colegio.nivel,
        colegio.director,
        colegio.tipo,
        colegio.ugel,
        colegio.departamento,
        colegio.distrito,
        colegio.zona,
        colegio.cantidadAlumnos,
        colegio.direccion,
      ]),
    );
  }

  exportarEmpresasExcel(): void {
    this.descargarExcel(
      'empresas-analisis-datos',
      'Empresas',
      [
        'N°',
        'RUC',
        'Nombre empresa',
        'Correo',
        'Teléfono fijo',
        'Celular',
        'Departamento',
        'Distrito',
        'Dirección',
        'Sector',
        'Estado',
        'Descripción',
      ],
      this.empresasFiltradas.map((empresa, index) => [
        index + 1,
        empresa.ruc,
        empresa.nombre,
        empresa.correo,
        empresa.telefonoFijo,
        empresa.celular,
        empresa.departamento,
        empresa.distrito,
        empresa.direccion,
        empresa.sector,
        empresa.estado,
        empresa.descripcion,
      ]),
    );
  }

  exportarVenuesExcel(): void {
    this.descargarExcel(
      'venues-analisis-datos',
      'Venues',
      [
        'N°',
        'Nombre',
        'Departamento',
        'Distrito',
        'Dirección',
        'Celular',
        'Correo',
        'Capacidad personas',
        'Estado',
        'Sitio web',
        'Detalles',
      ],
      this.venuesFiltrados.map((venue, index) => [
        index + 1,
        venue.nombre,
        venue.departamento,
        venue.distrito,
        venue.direccion,
        venue.celular,
        venue.correo,
        venue.capacidadPersonas,
        venue.estado,
        venue.sitioWeb,
        venue.detalles,
      ]),
    );
  }

  exportarDifusionesExcel(): void {
    this.descargarExcel(
      'difusiones-analisis-datos',
      'Difusiones',
      [
        'N°',
        'Nombre',
        'Tipo',
        'Plataforma',
        'Lugar',
        'Contacto',
        'Celular',
        'Correo',
        'Fecha',
        'Estado',
        'Observaciones',
      ],
      this.difusionesFiltradas.map((difusion, index) => [
        index + 1,
        difusion.nombre,
        difusion.tipo,
        difusion.plataforma,
        difusion.lugar,
        difusion.contacto,
        difusion.celular,
        difusion.correo,
        difusion.fecha,
        difusion.estado,
        difusion.observaciones,
      ]),
    );
  }

  private cargarDatosBackend(): void {
    this.cargarColegios();
    this.cargarEmpresas();
    this.cargarVenues();
    this.cargarDifusiones();
    this.cargarTareas();
  }

  private cargarColegios(): void {
    this.analisisService.getColegios().subscribe((colegios) => {
      this.colegios = colegios.map((colegio) => this.fromColegioApi(colegio));
    });
  }

  private cargarEmpresas(): void {
    this.analisisService.getEmpresas().subscribe((empresas) => {
      this.empresas = empresas.map((empresa) => this.fromEmpresaApi(empresa));
    });
  }

  private cargarVenues(): void {
    this.analisisService.getVenues().subscribe((venues) => {
      this.venues = venues.map((venue) => this.fromVenueApi(venue));
    });
  }

  private cargarDifusiones(): void {
    this.analisisService.getDifusiones().subscribe((difusiones) => {
      this.difusiones = difusiones.map((difusion) => this.fromDifusionApi(difusion));
    });
  }

  private cargarTareas(): void {
    this.analisisService.getTareas().subscribe((tareas) => {
      const tareasNormalizadas = tareas.map((tarea) => this.fromTareaApi(tarea));
      this.tareasEnProceso = tareasNormalizadas.filter((tarea) => tarea.estado !== 'completado');
      this.tareasConcluidas = tareasNormalizadas.filter((tarea) => tarea.estado === 'completado');
    });
  }

  private fromColegioApi(colegio: any): ColegioDato {
    return {
      id: String(colegio.id ?? colegio.codigo_modular ?? `colegio-${Date.now()}`),
      codigoModular: String(colegio.codigo_modular ?? colegio.codigoModular ?? ''),
      nombre: String(colegio.nombre ?? ''),
      correo: String(colegio.correo ?? ''),
      telefono: String(colegio.telefono ?? ''),
      nivel: String(colegio.nivel ?? ''),
      director: String(colegio.director ?? ''),
      tipo: this.normalizarTipoColegio(String(colegio.tipo ?? 'Particular')),
      ugel: String(colegio.ugel ?? ''),
      departamento: String(colegio.departamento ?? ''),
      distrito: String(colegio.distrito ?? ''),
      zona: String(colegio.zona ?? ''),
      cantidadAlumnos: Number(colegio.cantidad_alumnos ?? colegio.cantidadAlumnos ?? 0),
      direccion: String(colegio.direccion ?? ''),
    };
  }

  private toColegioPayload(colegio: ColegioDato): any {
    return {
      codigo_modular: colegio.codigoModular,
      nombre: colegio.nombre,
      correo: colegio.correo,
      telefono: colegio.telefono,
      nivel: colegio.nivel,
      director: colegio.director,
      tipo: colegio.tipo,
      ugel: colegio.ugel,
      departamento: colegio.departamento,
      distrito: colegio.distrito,
      zona: colegio.zona,
      cantidad_alumnos: Number(colegio.cantidadAlumnos) || 0,
      direccion: colegio.direccion,
    };
  }

  private fromEmpresaApi(empresa: any): EmpresaDato {
    return {
      id: String(empresa.id ?? empresa.ruc ?? `empresa-${Date.now()}`),
      ruc: String(empresa.ruc ?? ''),
      nombre: String(empresa.nombre ?? ''),
      correo: String(empresa.correo ?? ''),
      telefonoFijo: String(empresa.telefono_fijo ?? empresa.telefonoFijo ?? ''),
      celular: String(empresa.celular ?? ''),
      departamento: String(empresa.departamento ?? ''),
      distrito: String(empresa.distrito ?? ''),
      direccion: String(empresa.direccion ?? ''),
      sector: String(empresa.sector ?? ''),
      estado: this.normalizarEstadoEmpresa(String(empresa.estado ?? 'Convenio')),
      descripcion: String(empresa.descripcion ?? ''),
    };
  }

  private toEmpresaPayload(empresa: EmpresaDato): any {
    return {
      ruc: empresa.ruc,
      nombre: empresa.nombre,
      correo: empresa.correo,
      telefono_fijo: empresa.telefonoFijo,
      celular: empresa.celular,
      departamento: empresa.departamento,
      distrito: empresa.distrito,
      direccion: empresa.direccion,
      sector: empresa.sector,
      estado: empresa.estado,
      descripcion: empresa.descripcion,
    };
  }

  private fromVenueApi(venue: any): VenueDato {
    return {
      id: String(venue.id ?? venue.correo ?? `venue-${Date.now()}`),
      nombre: String(venue.nombre ?? ''),
      departamento: String(venue.departamento ?? ''),
      distrito: String(venue.distrito ?? ''),
      direccion: String(venue.direccion ?? ''),
      celular: String(venue.celular ?? ''),
      correo: String(venue.correo ?? ''),
      capacidadPersonas: Number(venue.capacidad_personas ?? venue.capacidadPersonas ?? 0),
      estado: this.normalizarEstadoContacto(String(venue.estado ?? 'Pendiente')),
      sitioWeb: String(venue.sitio_web ?? venue.sitioWeb ?? ''),
      detalles: String(venue.detalles ?? ''),
    };
  }

  private toVenuePayload(venue: VenueDato): any {
    return {
      nombre: venue.nombre,
      departamento: venue.departamento,
      distrito: venue.distrito,
      direccion: venue.direccion,
      celular: venue.celular,
      correo: venue.correo,
      capacidad_personas: Number(venue.capacidadPersonas) || 0,
      estado: venue.estado,
      sitio_web: venue.sitioWeb,
      detalles: venue.detalles,
    };
  }

  private fromDifusionApi(difusion: any): DifusionDato {
    return {
      id: String(difusion.id ?? difusion.correo ?? `difusion-${Date.now()}`),
      nombre: String(difusion.nombre ?? ''),
      tipo: String(difusion.tipo ?? ''),
      plataforma: String(difusion.plataforma ?? ''),
      lugar: String(difusion.lugar ?? ''),
      contacto: String(difusion.contacto ?? ''),
      celular: String(difusion.celular ?? ''),
      correo: String(difusion.correo ?? ''),
      fecha: this.normalizarFechaInput(String(difusion.fecha ?? '')),
      estado: this.normalizarEstadoContacto(String(difusion.estado ?? 'Pendiente')),
      observaciones: String(difusion.observaciones ?? ''),
    };
  }

  private toDifusionPayload(difusion: DifusionDato): any {
    return {
      nombre: difusion.nombre,
      tipo: difusion.tipo,
      plataforma: difusion.plataforma,
      lugar: difusion.lugar,
      contacto: difusion.contacto,
      celular: difusion.celular,
      correo: difusion.correo,
      fecha: difusion.fecha,
      estado: difusion.estado,
      observaciones: difusion.observaciones,
    };
  }

  private fromTareaApi(tarea: any): TareaDato {
    const estado = this.fromEstadoTareaApi(String(tarea.estado ?? 'PENDIENTE'));
    return {
      id: String(tarea.id ?? `tarea-${Date.now()}`),
      titulo: String(tarea.titulo ?? ''),
      descripcion: String(tarea.descripcion ?? tarea.subtitulo ?? ''),
      estado,
      etiquetaEstado: this.obtenerEtiquetaEstado(estado),
      fechaCreacion: this.normalizarFechaVista(String(tarea.fecha_creacion ?? tarea.created_at ?? '')),
      fechaLimite: this.normalizarFechaInput(String(tarea.fecha_limite ?? tarea.fechaLimite ?? '')),
      enlaces: Array.isArray(tarea.enlaces)
        ? tarea.enlaces.map((enlace: any) => this.fromTareaEnlaceApi(enlace))
        : [],
    };
  }

  private fromTareaEnlaceApi(enlace: any): TareaEnlace {
    return {
      id: enlace.id,
      nombre: String(enlace.nombre ?? enlace.nombre_documento ?? enlace.nombreDocumento ?? ''),
      url: String(enlace.url ?? ''),
    };
  }

  private toTareaPayload(tarea: TareaDato): any {
    return {
      area_id: 24,
      categoria: this.obtenerCategoriaTarea(),
      titulo: tarea.titulo,
      subtitulo: tarea.descripcion,
      descripcion: tarea.descripcion,
      estado: this.toEstadoTareaApi(tarea.estado),
      fecha_limite: tarea.fechaLimite || null,
      creador_id: 22,
      enlaces: (tarea.enlaces ?? []).map((enlace) => ({
        nombre: enlace.nombre,
        url: enlace.url,
      })),
    };
  }

  private obtenerCategoriaTarea(): string {
    const panel = this.paneles.find((item) => item.clave === this.panelActivo);
    return panel?.titulo ?? 'Mapeo educativo';
  }

  private fromEstadoTareaApi(estado: string): EstadoTarea {
    const normalizado = this.normalizarTextoPlano(estado).replace(/_/g, ' ');
    if (normalizado === 'en proceso') return 'en-proceso';
    if (normalizado === 'completado') return 'completado';
    if (normalizado === 'paralizado') return 'paralizado';
    return 'pendiente';
  }

  private toEstadoTareaApi(estado: EstadoTarea): string {
    if (estado === 'en-proceso') return 'EN PROCESO';
    if (estado === 'completado') return 'COMPLETADO';
    if (estado === 'paralizado') return 'PARALIZADO';
    return 'PENDIENTE';
  }

  private normalizarEstadoEmpresa(estado: string): EstadoEmpresa {
    return this.normalizarTextoPlano(estado) === 'alianza' ? 'Alianza' : 'Convenio';
  }

  private normalizarEstadoContacto(estado: string): 'Pendiente' | 'Contactado' {
    return this.normalizarTextoPlano(estado) === 'contactado' ? 'Contactado' : 'Pendiente';
  }

  private normalizarFechaInput(fecha: string): string {
    return fecha.includes('T') ? fecha.slice(0, 10) : fecha;
  }

  private normalizarFechaVista(fecha: string): string {
    const fechaInput = this.normalizarFechaInput(fecha);
    if (!fechaInput) return this.formatearFechaActual();
    const [anio, mes, dia] = fechaInput.split('-');
    return anio && mes && dia ? `${dia}/${mes}/${anio}` : fechaInput;
  }

  private descargarExcel(
    nombreArchivo: string,
    nombreHoja: string,
    encabezados: string[],
    filas: Array<Array<string | number>>,
  ): void {
    const encabezadoHtml = encabezados
      .map((encabezado) => `<th>${this.escaparHtml(encabezado)}</th>`)
      .join('');
    const filasHtml = filas
      .map(
        (fila) =>
          `<tr>${fila.map((celda) => `<td>${this.escaparHtml(celda)}</td>`).join('')}</tr>`,
      )
      .join('');
    const contenido = `
      <html>
        <head>
          <meta charset="UTF-8" />
          <style>
            table {
              border-collapse: collapse;
              font-family: Arial, sans-serif;
              font-size: 12pt;
              width: 100%;
            }

            th {
              background: #fce4d6;
              color: #0f172a;
              border: 1px solid #9dc3e6;
              font-weight: 700;
              text-align: center;
              vertical-align: middle;
              padding: 2px 4px;
              white-space: nowrap;
            }

            td {
              border: 1px solid #9dc3e6;
              color: #000;
              padding: 2px 4px;
              vertical-align: middle;
              white-space: nowrap;
            }

            td:first-child {
              text-align: right;
            }
          </style>
        </head>
        <body>
          <table>
            <thead><tr>${encabezadoHtml}</tr></thead>
            <tbody>${filasHtml}</tbody>
          </table>
        </body>
      </html>
    `;
    const blob = new Blob([contenido], {
      type: 'application/vnd.ms-excel;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${nombreArchivo}.xls`;
    link.click();
    URL.revokeObjectURL(url);
  }

  private escaparHtml(valor: string | number): string {
    return String(valor ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private crearTareaForm(): TareaForm {
    return {
      titulo: '',
      descripcion: '',
      estado: 'pendiente',
      fechaLimite: '',
      enlaces: [{ nombre: '', url: '' }],
    };
  }

  private crearColegioVacio(): ColegioDato {
    return {
      id: `colegio-${Date.now()}`,
      codigoModular: '',
      nombre: '',
      correo: '',
      telefono: '',
      nivel: '',
      director: '',
      tipo: 'Particular',
      ugel: '',
      departamento: '',
      distrito: '',
      zona: '',
      cantidadAlumnos: 0,
      direccion: '',
    };
  }

  private crearEmpresaVacia(): EmpresaDato {
    return {
      id: `empresa-${Date.now()}`,
      ruc: '',
      nombre: '',
      correo: '',
      telefonoFijo: '',
      celular: '',
      departamento: '',
      distrito: '',
      direccion: '',
      sector: '',
      estado: 'Convenio',
      descripcion: '',
    };
  }

  private crearVenueVacio(): VenueDato {
    return {
      id: `venue-${Date.now()}`,
      nombre: '',
      departamento: '',
      distrito: '',
      direccion: '',
      celular: '',
      correo: '',
      capacidadPersonas: 0,
      estado: 'Pendiente',
      sitioWeb: '',
      detalles: '',
    };
  }

  private crearDifusionVacia(): DifusionDato {
    return {
      id: `difusion-${Date.now()}`,
      nombre: '',
      tipo: '',
      plataforma: '',
      lugar: '',
      contacto: '',
      celular: '',
      correo: '',
      fecha: '',
      estado: 'Pendiente',
      observaciones: '',
    };
  }

  private normalizarTipoColegio(valor: string): ColegioDato['tipo'] {
    return this.normalizarTextoPlano(valor) === 'publica'
      ? 'Pública'
      : 'Particular';
  }

  private normalizarTextoPlano(valor: string): string {
    return valor
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  cerrarNotificacion(): void {
    this.notificacion = null;
    this.limpiarNotificacionProgramada();
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

  private obtenerEtiquetaEstado(estado: EstadoTarea): string {
    if (estado === 'en-proceso') {
      return 'En proceso';
    }

    if (estado === 'completado') {
      return 'Completado';
    }

    if (estado === 'paralizado') {
      return 'Paralizado';
    }

    return 'Pendiente';
  }

  private actualizarTareaExistente(
    tarea: TareaDato,
    cambios: Omit<TareaDato, 'id' | 'fechaCreacion'>,
  ): void {
    const coleccionActual = this.tareasEnProceso.includes(tarea)
      ? this.tareasEnProceso
      : this.tareasConcluidas;
    const coleccionDestino =
      cambios.estado === 'completado' ? this.tareasConcluidas : this.tareasEnProceso;

    tarea.titulo = cambios.titulo;
    tarea.descripcion = cambios.descripcion;
    tarea.estado = cambios.estado;
    tarea.etiquetaEstado = cambios.etiquetaEstado;
    tarea.fechaLimite = cambios.fechaLimite;
    tarea.enlaces = cambios.enlaces;

    if (coleccionActual !== coleccionDestino) {
      const indice = coleccionActual.indexOf(tarea);
      if (indice >= 0) {
        coleccionActual.splice(indice, 1);
      }

      coleccionDestino.unshift(tarea);
    }
  }

  private formatearFechaActual(): string {
    const hoy = new Date();
    const dia = String(hoy.getDate()).padStart(2, '0');
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const anio = hoy.getFullYear();

    return `${dia}/${mes}/${anio}`;
  }
}
