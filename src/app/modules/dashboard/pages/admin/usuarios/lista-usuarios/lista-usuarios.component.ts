import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../../../auth/services/auth.service';
import { UsuarioService } from './services/usuario.service';

@Component({
  selector: 'app-lista-usuarios',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './lista-usuarios.component.html',
  styleUrls: ['./lista-usuarios.component.scss']
})
export class ListaUsuariosComponent implements OnInit {
  usuarios: any[] = [];
  cargando = true;
  error = '';
  mensajeExito = '';

  paginaActual = 1;
  usuariosPorPagina = 10;

  constructor(
    private authService: AuthService,
    private usuarioService: UsuarioService,
    private router: Router,
    private route: ActivatedRoute
  ) { }

  ngOnInit(): void {
    if (!this.authService.isAdmin()) {
      this.router.navigate(['/dashboard']);
      return;
    }

    // Leer el mensaje de éxito si viene de editar
    this.route.queryParams.subscribe(params => {
      if (params['mensaje']) {
        this.mensajeExito = params['mensaje'];
        // Ocultar después de 4 segundos
        setTimeout(() => this.mensajeExito = '', 4000);
      }
    });

    this.cargarUsuarios();
  }

  cargarUsuarios(): void {
    this.cargando = true;
    this.usuarioService.getUsers().subscribe({
      next: (data: any) => {
        this.usuarios = data;
        this.paginaActual = 1;
        this.cargando = false;
      },
      error: (err: any) => {
        console.error('Error cargando usuarios', err);
        this.error = 'No se pudieron cargar los usuarios. Revisa la conexión con el servidor.';
        this.cargando = false;
      }
    });
  }

  isContratoVencido(u: any): boolean {
    if (!u.fecha_fin_contrato) {
      return false;
    }
    const fin = new Date(u.fecha_fin_contrato);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return fin < hoy;
  }

  isUsuarioActivo(u: any): boolean {
    return u.estado === 'ACTIVO' && !this.isContratoVencido(u);
  }

  get usuariosOrdenados(): any[] {
    return [...this.usuarios].sort((a, b) => {
      const aActivo = this.isUsuarioActivo(a);
      const bActivo = this.isUsuarioActivo(b);

      if (aActivo && !bActivo) {
        return -1;
      }
      if (!aActivo && bActivo) {
        return 1;
      }

      // Más nuevos primero
      return b.id - a.id;
    });
  }

  get usuariosPaginados(): any[] {
    const inicio = (this.paginaActual - 1) * this.usuariosPorPagina;
    const fin = inicio + this.usuariosPorPagina;
    return this.usuariosOrdenados.slice(inicio, fin);
  }

  get totalPaginas(): number {
    return Math.ceil(this.usuariosOrdenados.length / this.usuariosPorPagina);
  }

  get paginasArray(): number[] {
    const total = this.totalPaginas;
    const paginas: number[] = [];
    for (let i = 1; i <= total; i++) {
      paginas.push(i);
    }
    return paginas;
  }

  cambiarPagina(pagina: number): void {
    if (pagina >= 1 && pagina <= this.totalPaginas) {
      this.paginaActual = pagina;
    }
  }

  toggleEstado(usuario: any): void {
    const esActivo = usuario.estado === 'ACTIVO';
    const nuevoEstado = esActivo ? 'INACTIVO' : 'ACTIVO';
    const confirmacion = confirm(`¿Estás seguro de que deseas ${esActivo ? 'desactivar' : 'activar'} a ${usuario.nombre_completo}?`);
    
    if (confirmacion) {
      this.usuarioService.toggleUserStatus(usuario.id, nuevoEstado).subscribe({
        next: () => {
          usuario.estado = nuevoEstado; // Actualizamos la vista localmente
        },
        error: (err: any) => {
          console.error('Error al cambiar el estado del usuario', err);
          alert('No se pudo cambiar el estado. Inténtalo de nuevo.');
        }
      });
    }
  }

  editarUsuario(usuario: any): void {
    this.router.navigate(['/dashboard/admin-dashboard/usuarios/editar', usuario.id]);
  }

  irARegistro(): void {
    this.router.navigate(['/dashboard/admin-dashboard/usuarios/registro']);
  }

  getRolDisplay(rol: any): string {
    if (typeof rol === 'string') {
      return rol;
    }
    return rol?.nombre || 'Sin rol';
  }
}
