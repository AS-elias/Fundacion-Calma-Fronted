import { Component, ChangeDetectionStrategy, inject, OnInit, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../../../modules/auth/services/auth.service';

// Interfaces del backend
export interface PermisoArea {
  puede_publicar: boolean;
  puede_editar: boolean;
  permitir_subareas: boolean;
}

export interface Area {
  id: number;
  nombre: string;
  padre_id: number | null;
  es_externa: boolean;
  permisos: PermisoArea;
  subareas: Area[];
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
  changeDetection: ChangeDetectionStrategy.Default, // cambiado para detectar cambios async
})
export class SidebarComponent implements OnInit {
  private router = inject(Router);
  private authService = inject(AuthService);
  private http = inject(HttpClient);

  private apiUrl = 'http://localhost:3005/api/comunidad';

  // Link al dashboard según rol
  get dashboardLink(): string {
    if (this.authService.isAdmin() || this.authService.isDirector()) return '/dashboard/admin-dashboard';
    return '/dashboard/usuario-dashboard';
  }
  areas = signal<Area[]>([]);
  cargandoAreas = signal(true);

  // Control de submenús abiertos (por ID de área)
  areaAbierta: number | null = null;

  // Propiedad para el template
  isAdminUser = false;

  ngOnInit(): void {
    this.isAdminUser = this.authService.isAdmin();
    this.cargarAreas();
  }

  /** Carga las áreas permitidas para este usuario desde el backend */
  cargarAreas(): void {
    const token = this.authService.getToken();
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });

    // Admin ve todo con ?todas=true, el resto solo lo suyo
    const esAdmin = this.authService.isAdmin();
    const url = esAdmin
      ? `${this.apiUrl}/areas?todas=true`
      : `${this.apiUrl}/areas`;

    this.http.get<Area[]>(url, { headers }).subscribe({
      next: (data) => {
        this.areas.set(data);
        this.cargandoAreas.set(false);
        console.log(`✅ Sidebar: ${data.length} área(s) cargada(s) para este usuario`);
      },
      error: (err) => {
        this.cargandoAreas.set(false);
        console.error('❌ Sidebar: Error al cargar áreas', err);
      }
    });
  }

  /** Abre/cierra el submenú de un área */
  toggleArea(id: number): void {
    this.areaAbierta = this.areaAbierta === id ? null : id;
  }

  /** Devuelve la ruta correcta para vincular con las rutas de app.routes.ts */
  getAreaLink(area: Area | any): string[] {
    if (!area || !area.nombre) return ['/dashboard/director-dashboard'];
    
    const name = area.nombre.toLowerCase();
    
    // Mapeo dinámico a las áreas de /dashboard/director-dashboard/...
    if (name.includes('estrategia')) return ['/dashboard/director-dashboard/estrategia-comercial'];
    if (name.includes('análisis') || name.includes('analisis') || name.includes('datos')) return ['/dashboard/director-dashboard/analisis-datos'];
    if (name.includes('desarrollo') || name.includes('operación')) return ['/dashboard/director-dashboard/desarrollo-comercial'];
    if (name.includes('clínica') || name.includes('salud')) return ['/dashboard/director-dashboard/clinica']; // Por si acaso
    
    // Rutear genéricamente si el nombre no hace match
    return ['/dashboard/director-dashboard/', area.id.toString()];
  }

  /** Devuelve un icono PrimeIcons específico basándose en el nombre del área/subárea */
  getAreaIcon(area: Area | any): string {
    if (!area || !area.nombre) return 'pi pi-folder';
    
    const name = area.nombre.toLowerCase();
    
    if (name.includes('estrategia')) return 'pi pi-compass';
    if (name.includes('análisis') || name.includes('analisis') || name.includes('datos')) return 'pi pi-chart-line';
    if (name.includes('desarrollo') || name.includes('operación')) return 'pi pi-cog';
    if (name.includes('tecnología') || name.includes('sistemas')) return 'pi pi-desktop';
    if (name.includes('comunicación') || name.includes('marketing')) return 'pi pi-megaphone';
    if (name.includes('clínica') || name.includes('salud')) return 'pi pi-heart';
    
    return 'pi pi-briefcase'; // Icono por defecto
  }

  getAreaLabel(area: Area | any): string {
    if (!area?.nombre) return 'Área';

    const name = area.nombre.toLowerCase();
    const subareas = Array.isArray(area.subareas) ? area.subareas : [];
    const subareaNames: string[] = subareas.map((sub: Area | any) => (sub?.nombre || '').toLowerCase());
    const tieneEstrategia = subareaNames.some((sub: string) => sub.includes('estrategia'));
    const tieneDesarrollo = subareaNames.some((sub: string) => sub.includes('desarrollo'));

    if ((name.includes('comercial') && tieneEstrategia && tieneDesarrollo) || (name.includes('estrategia') && name.includes('desarrollo'))) {
      return 'Estrategia y Desarrollo Comercial';
    }

    if (name.includes('estrategia')) {
      return 'Estrategia Comercial';
    }

    if (name.includes('desarrollo')) {
      return 'Desarrollo Comercial';
    }

    return area.nombre;
  }

  cerrarSesion(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
