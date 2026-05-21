import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../../../auth/services/auth.service';
import { RegistroService } from './services/registro.service';

@Component({
  selector: 'app-registro-usuario',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './registro-usuario.component.html',
  styleUrls: ['./registro-usuario.component.scss']
})
export class RegistroUsuarioComponent implements OnInit {
  registroForm: FormGroup;
  cargando = false;
  mensaje: { tipo: 'exito' | 'error', texto: string } | null = null;
  todasLasAreas: any[] = [];
  subareasDisponibles: any[] = [];
  minDate: string = '';
  maxDate: string = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private registroService: RegistroService,
    private router: Router
  ) {
    this.registroForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(2), Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)]],
      apellido: ['', [Validators.required, Validators.minLength(2), Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)]],
      email: ['', [Validators.required, Validators.email]],
      rol: ['usuario', Validators.required],
      area_id: [null, Validators.required], // Por defecto requerido para usuario/director
      subarea_id: [null],
      puesto: [''],
      fecha_ingreso: [new Date().toISOString().split('T')[0], Validators.required],
      duracion_meses: [null],
      fecha_fin_contrato: ['']
    });

    this.registroForm.get('duracion_meses')?.valueChanges.subscribe(() => this.calcularFechaFin());
    this.registroForm.get('fecha_ingreso')?.valueChanges.subscribe(() => this.calcularFechaFin());

    this.registroForm.get('rol')?.valueChanges.subscribe(rol => {
      const areaControl = this.registroForm.get('area_id');
      const subareaControl = this.registroForm.get('subarea_id');
      const puestoControl = this.registroForm.get('puesto');

      if (rol === 'admin') {
        areaControl?.clearValidators();
        areaControl?.setValue(null);
        subareaControl?.clearValidators();
        subareaControl?.setValue(null);
        puestoControl?.setValue('');
      } else if (rol === 'director') {
        areaControl?.setValidators(Validators.required);
        subareaControl?.clearValidators();
        subareaControl?.setValue(null);
        puestoControl?.setValue('');
      } else {
        // usuario (practicante)
        areaControl?.setValidators(Validators.required);
        subareaControl?.setValidators(Validators.required);
      }

      areaControl?.updateValueAndValidity();
      subareaControl?.updateValueAndValidity();
      puestoControl?.updateValueAndValidity();
    });

    this.registroForm.get('area_id')?.valueChanges.subscribe(areaId => {
      this.registroForm.get('subarea_id')?.setValue(null);
      if (areaId) {
        const areaSeleccionada = this.todasLasAreas.find(a => a.id === Number(areaId));
        this.subareasDisponibles = areaSeleccionada?.subareas || [];
      } else {
        this.subareasDisponibles = [];
      }
    });
  }

  ngOnInit(): void {
    const hoy = new Date();
    this.minDate = hoy.toISOString().split('T')[0];
    const maxDate = new Date();
    maxDate.setFullYear(maxDate.getFullYear() + 10);
    this.maxDate = maxDate.toISOString().split('T')[0];

    // Protección adicional: si por alguna razón entra alguien que no es admin, lo expulsamos
    if (!this.authService.isAdmin()) {
      this.router.navigate(['/dashboard']);
      return;
    }
    this.cargarAreas();
  }

  cargarAreas(): void {
    this.registroService.getAreas().subscribe(areas => {
      this.todasLasAreas = areas;
      // Re-trigger value change just in case area_id is already set
      const areaId = this.registroForm.get('area_id')?.value;
      if (areaId) {
        const areaSeleccionada = this.todasLasAreas.find(a => a.id === Number(areaId));
        this.subareasDisponibles = areaSeleccionada?.subareas || [];
      }
    });
  }

  onInputLetras(event: Event, controlName: string): void {
    const input = event.target as HTMLInputElement;
    const valorOriginal = input.value;
    // Solo permitimos letras, acentos y espacios
    const valorLimpio = valorOriginal.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '');
    
    if (valorOriginal !== valorLimpio) {
      input.value = valorLimpio;
      this.registroForm.get(controlName)?.setValue(valorLimpio, { emitEvent: false });
    }

    if (controlName === 'nombre' || controlName === 'apellido') {
      this.generarCorreo();
    }
  }

  generarCorreo(): void {
    const nombre = this.registroForm.get('nombre')?.value?.trim().toLowerCase() || '';
    const apellido = this.registroForm.get('apellido')?.value?.trim().toLowerCase() || '';

    if (nombre || apellido) {
      // Removemos acentos para el correo
      const quitarAcentos = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      
      const primerNombre = quitarAcentos(nombre).split(' ')[0] || '';
      const primerApellido = quitarAcentos(apellido).split(' ')[0] || '';
      
      let correo = '';
      if (primerNombre.length >= 2) {
        correo += primerNombre.substring(0, 2);
      } else if (primerNombre.length === 1) {
        correo += primerNombre;
      }

      if (correo && primerApellido) {
        correo += '.' + primerApellido;
      } else if (primerApellido) {
        correo += primerApellido;
      }

      if (correo) {
        correo += '.fcalma@gmail.com';
        this.registroForm.get('email')?.setValue(correo);
      } else {
        this.registroForm.get('email')?.setValue('');
      }
    } else {
      this.registroForm.get('email')?.setValue('');
    }
  }

  calcularFechaFin(): void {
    const meses = this.registroForm.get('duracion_meses')?.value;
    const ingresoStr = this.registroForm.get('fecha_ingreso')?.value;

    if (meses && ingresoStr) {
      // Usar Date pero corrigiendo la zona horaria asumiendo que es YYYY-MM-DD local
      const partes = ingresoStr.split('-');
      if (partes.length === 3) {
        const año = parseInt(partes[0], 10);
        const mes = parseInt(partes[1], 10) - 1; // 0-indexed
        const dia = parseInt(partes[2], 10);
        const fecha = new Date(año, mes, dia);
        fecha.setMonth(fecha.getMonth() + Number(meses));
        
        // Formatear de vuelta a YYYY-MM-DD
        const outAño = fecha.getFullYear();
        const outMes = String(fecha.getMonth() + 1).padStart(2, '0');
        const outDia = String(fecha.getDate()).padStart(2, '0');
        
        this.registroForm.get('fecha_fin_contrato')?.setValue(`${outAño}-${outMes}-${outDia}`, { emitEvent: false });
      }
    }
  }

  onSubmit(): void {
    if (this.registroForm.invalid) {
      this.registroForm.markAllAsTouched();
      return;
    }

    this.cargando = true;
    this.mensaje = null;

    const formulario = { ...this.registroForm.value };
    const areaId = formulario.area_id;
    const subareaId = formulario.subarea_id;

    const rolIdMap: Record<string, number> = {
      admin: 24,
      director: 25,
      usuario: 26,
      practicante: 26 // soporte para variantes históricas/antiguas
    };

    const roleNameMap: Record<string, string> = {
      admin: 'administrador',
      director: 'director',
      // El backend actual no tiene rol "usuario" activo. Para usuarios estándar usamos "practicante".
      usuario: 'practicante',
      practicante: 'practicante'
    };

    const rolFinal = roleNameMap[formulario.rol] ?? formulario.rol?.toLowerCase() ?? 'practicante';

    const userData = {
      nombre: formulario.nombre?.trim(),
      apellido: formulario.apellido?.trim(),
      nombre_completo: formulario.nombre?.trim(),
      apellido_completo: formulario.apellido?.trim(),
      email: formulario.email?.trim().toLowerCase(),
      // El backend requiere un rol válido en la tabla de roles.
      rol: rolFinal,
      rol_id: rolIdMap[formulario.rol] ?? 26,
      puesto: formulario.puesto?.trim() || '',
      fecha_ingreso: formulario.fecha_ingreso || '',
      duracion_meses: formulario.duracion_meses ? Number(formulario.duracion_meses) : null,
      fecha_fin_contrato: formulario.fecha_fin_contrato || '',
      estado: 'ACTIVO'
    } as any;

    if (formulario.rol !== 'admin') {
      if (formulario.area_id) {
        userData.area_id = Number(formulario.area_id);
      }
      if (formulario.subarea_id) {
        userData.subarea_id = Number(formulario.subarea_id);
      }
    }

    console.log('➡️ Enviando registro de usuario (payload base):', JSON.stringify(userData, null, 2));

    this.registroService.register(userData).subscribe({
      next: (response: any) => {
        const nuevoUsuarioId = response.usuario?.id;
        const rolSeleccionado = userData.rol;
        
        if (nuevoUsuarioId && rolSeleccionado !== 'admin' && areaId) {
          this.registroService.asignarAreaUsuario(nuevoUsuarioId, areaId, subareaId).subscribe({
            next: () => this.finalizarExito(),
            error: (err) => {
              this.cargando = false;
              this.mensaje = {
                tipo: 'error',
                texto: 'Usuario creado correctamente, pero hubo un error al asignarle el área. Ve a Editar Usuario para corregirlo.'
              };
              console.error('Error asignando área:', err);
            }
          });
        } else {
          this.finalizarExito();
        }
      },
      error: (err: any) => {
        this.cargando = false;
        let msjError = 'Ocurrió un error inesperado al crear el usuario.';

        if (err.status === 400 && err.error) {
          const serverMsg = err.error.message || err.error.error || err.error || ''; 
          console.error('Detalle 400 del servidor:', err.error);
          if (typeof serverMsg === 'string' && serverMsg.length > 0) {
            msjError = `Error de validación: ${serverMsg}`;
          }
        }

        if (err.status === 409) msjError = 'Este correo electrónico ya está registrado.';
        if (err.status === 401 || err.status === 403) msjError = 'Acceso denegado: No tienes permisos de administrador.';

        this.mensaje = { tipo: 'error', texto: msjError };
        console.error('Error en registro:', err, 'payload:', JSON.stringify(userData, null, 2));
        console.error('Detalle 400 del servidor (raw):', JSON.stringify(err.error, null, 2));
      }
    });
  }

  finalizarExito(): void {
    this.cargando = false;
    this.mensaje = {
      tipo: 'exito',
      texto: 'Usuario creado exitosamente con sus accesos. Se ha enviado un correo con instrucciones.'
    };

    // Limpiar el formulario para no mantener datos antiguos
    this.registroForm.reset({ rol: 'usuario', puesto: '', fecha_fin_contrato: '', nombre: '', apellido: '', email: '', area_id: null, subarea_id: null });

    // Redirigir a la lista de usuarios para que el usuario pueda confirmar visualmente.
    this.router.navigate(['/dashboard/admin-dashboard/usuarios'], {
      queryParams: { mensaje: 'Usuario creado correctamente.' }
    });
  }
}
