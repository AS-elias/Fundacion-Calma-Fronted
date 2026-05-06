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
        this.cargando = false;
      },
      error: (err: any) => {
        console.error('Error cargando usuarios', err);
        this.error = 'No se pudieron cargar los usuarios. Revisa la conexión con el servidor.';
        this.cargando = false;
      }
    });
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
}
