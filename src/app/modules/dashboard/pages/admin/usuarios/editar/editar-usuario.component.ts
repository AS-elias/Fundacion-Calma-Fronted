import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { EditarService, AreaPermiso } from './services/editar.service';
import { AuthService } from '../../../../../auth/services/auth.service';

@Component({
  selector: 'app-editar-usuario',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './editar-usuario.component.html',
  styleUrls: ['./editar-usuario.component.scss']
})
export class EditarUsuarioComponent implements OnInit {
  editarForm: FormGroup;
  userId: number;
  cargando = true;
  enviando = false;
  errorCarga = '';
  mensaje: { tipo: 'exito' | 'error', texto: string } | null = null;

  todasLasAreas: any[] = [];
  areasSeleccionadas: number[] = [];
  minDate: string = '';
  maxDate: string = '';

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private editarService: EditarService,
    private authService: AuthService
  ) {
    this.userId = Number(this.route.snapshot.paramMap.get('id'));

    this.editarForm = this.fb.group({
      nombre_completo: ['', [Validators.required, Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)]],
      apellido_completo: ['', [Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)]],
      email: ['', [Validators.required, Validators.email]],
      rol_id: [null, Validators.required],
      puesto: ['', [Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)]],
      fecha_fin_contrato: [''],
      estado: ['ACTIVO']
    });
  }

  ngOnInit(): void {
    const hoy = new Date();
    this.minDate = hoy.toISOString().split('T')[0];
    const maxDate = new Date();
    maxDate.setFullYear(maxDate.getFullYear() + 10);
    this.maxDate = maxDate.toISOString().split('T')[0];

    if (!this.authService.isAdmin()) {
      this.router.navigate(['/dashboard']);
      return;
    }
    this.cargarTodo();
  }

  onInputLetras(event: Event, controlName: string): void {
    const input = event.target as HTMLInputElement;
    const valorOriginal = input.value;
    const valorLimpio = valorOriginal.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '');
    
    if (valorOriginal !== valorLimpio) {
      input.value = valorLimpio;
      this.editarForm.get(controlName)?.setValue(valorLimpio);
    }
  }

  cargarTodo(): void {
    this.cargando = true;
    this.errorCarga = '';

    forkJoin({
      usuario: this.editarService.getUsuario(this.userId),
      areas: this.editarService.getAreas(),
      permisos: this.editarService.getPermisosAreaUsuario(this.userId)
    }).subscribe({
      next: ({ usuario, areas, permisos }) => {
        this.todasLasAreas = areas;

        // 1. Cargar permisos nuevos
        if (Array.isArray(permisos) && permisos.length > 0) {
          this.areasSeleccionadas = permisos
            .map((p: any) => p.area_id)
            .filter(id => id != null);
        }
        // 2. RESCATE DE USUARIOS ANTIGUOS
        else {
          const areaAntigua = usuario.area_id || usuario.area?.id;
          if (areaAntigua) {
            this.areasSeleccionadas.push(areaAntigua);
          }
        }

        // 🔥 MAGIA VISUAL: Autocompletar padres e hijas para que el estilo no se rompa
        this.normalizarSeleccionDeAreas();

        this.poblarFormulario(usuario);
        this.cargando = false;
      },
      error: (err: any) => {
        console.error('Error al cargar datos:', err);
        this.errorCarga = 'No se pudo cargar la información del usuario.';
        this.cargando = false;
      }
    });
  }

  // Esta función aseguraba que padres e hijas estuvieran vinculadas rígidamente.
  // Ahora la hemos flexibilizado para que el usuario pueda elegir libremente lo que quiere.
  normalizarSeleccionDeAreas(): void {
    const seleccionadasUnicas = new Set(this.areasSeleccionadas);

    this.todasLasAreas.forEach(area => {
      // Regla básica de consistencia visual: 
      // Si alguna Sub-área está seleccionada, marcar automáticamente a su Área Padre
      // para que el usuario no pierda el acceso al grupo principal.
      if (area.subareas) {
        const tieneHijaSeleccionada = area.subareas.some((sub: any) => seleccionadasUnicas.has(sub.id));
        if (tieneHijaSeleccionada) {
          seleccionadasUnicas.add(area.id);
        }
      }
    });

    this.areasSeleccionadas = Array.from(seleccionadasUnicas);
  }

  poblarFormulario(user: any): void {
    const fechaContrato = user.fecha_fin_contrato ? user.fecha_fin_contrato.split('T')[0] : '';
    this.editarForm.patchValue({
      nombre_completo: user.nombre_completo ?? '',
      apellido_completo: user.apellido_completo ?? '',
      email: user.email ?? '',
      rol_id: user.rol_id ?? user.rol?.id ?? null,
      puesto: user.puesto ?? '',
      fecha_fin_contrato: fechaContrato,
      estado: user.estado ?? 'ACTIVO'
    });
  }

  get esAdmin(): boolean {
    return Number(this.editarForm.get('rol_id')?.value) === 24;
  }

  toggleArea(areaId: number): void {
    if (this.esAdmin) return; // El admin no puede desmarcar porque tiene todas por defecto

    const idx = this.areasSeleccionadas.indexOf(areaId);

    if (idx > -1) {
      // DESMARCAR
      this.areasSeleccionadas.splice(idx, 1);

      // Si desmarcó un Área Padre, OPCIONALMENTE desmarcar a sus hijas.
      // Pero si el usuario desmarca el padre, tiene sentido quitar todo el grupo.
      const areaPadre = this.todasLasAreas.find(a => a.id === areaId);
      if (areaPadre && areaPadre.subareas) {
        areaPadre.subareas.forEach((sub: any) => {
          const subIdx = this.areasSeleccionadas.indexOf(sub.id);
          if (subIdx > -1) this.areasSeleccionadas.splice(subIdx, 1);
        });
      }
      
      // Si se desmarcó una hija, verificar si quedan hijas marcadas. 
      // Si no queda ninguna, quizas quieras desmarcar el padre, 
      // PERO lo dejaremos intacto para permitir tener *solo* el padre marcado.
      
    } else {
      // MARCAR
      this.areasSeleccionadas.push(areaId);

      // Si marcó una Sub-área, asegurar que el Área Padre se marque también
      // porque el backend requiere el padre para acceder a la hija.
      this.todasLasAreas.forEach(area => {
        if (area.subareas && area.subareas.some((s: any) => s.id === areaId)) {
          if (!this.areasSeleccionadas.includes(area.id)) {
            this.areasSeleccionadas.push(area.id);
          }
        }
      });
      // Ya NO forzamos marcar todas las hijas si se marca el padre.
    }
  }

  isAreaSelected(areaId: number): boolean {
    if (this.esAdmin) return true;
    return this.areasSeleccionadas.includes(areaId);
  }

  countSubAreasSelected(area: any): number {
    if (!area.subareas?.length) return 0;
    if (this.esAdmin) return area.subareas.length;
    return area.subareas.filter((s: any) => this.isAreaSelected(s.id)).length;
  }

  onSubmit(): void {
    if (this.editarForm.invalid) {
      this.editarForm.markAllAsTouched();
      return;
    }

    this.enviando = true;
    this.mensaje = null;

    const formValues = this.editarForm.value;
    const datosUsuario: any = {
      nombre_completo: formValues.nombre_completo,
      apellido_completo: formValues.apellido_completo || '',
      puesto: formValues.puesto || '',
      rol_id: Number(formValues.rol_id),
      estado: formValues.estado,
      fecha_fin_contrato: formValues.fecha_fin_contrato ? formValues.fecha_fin_contrato : null
    };

    const permisos: AreaPermiso[] = this.areasSeleccionadas.map(id => ({
      area_id: id,
      puede_publicar: true,
      puede_editar: true,
      permitir_subareas: true
    }));

    forkJoin({
      usuario: this.editarService.actualizarUsuario(this.userId, datosUsuario),
      permisos: this.editarService.actualizarPermisosAreaUsuario(this.userId, permisos)
    }).subscribe({
      next: () => {
        this.enviando = false;
        this.router.navigate(['/dashboard/admin-dashboard/usuarios'], {
          queryParams: { mensaje: 'Cambios guardados correctamente' }
        });
      },
      error: (err: any) => {
        this.enviando = false;
        this.mensaje = { tipo: 'error', texto: 'No se pudieron guardar los cambios.' };
      }
    });
  }

  volver(): void {
    this.router.navigate(['/dashboard/admin-dashboard/usuarios']);
  }
}