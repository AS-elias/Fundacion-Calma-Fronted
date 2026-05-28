import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class PermisosAreaService {
  // Mapa de Area ID a permisos { puede_editar, puede_publicar, nombre }
  private permisosMap = new Map<number, { puede_editar: boolean; puede_publicar: boolean; nombre: string }>();

  /**
   * Inicializa o actualiza el mapa de permisos usando el árbol de áreas.
   */
  cargarPermisos(areas: any[]): void {
    this.permisosMap.clear();
    this.procesarAreas(areas);
  }

  private procesarAreas(areas: any[]): void {
    if (!areas) return;
    for (const area of areas) {
      if (area.id && area.permisos) {
        this.permisosMap.set(area.id, {
          puede_editar: !!area.permisos.puede_editar,
          puede_publicar: !!area.permisos.puede_publicar,
          nombre: area.nombre || ''
        });
      }
      if (area.subareas && area.subareas.length > 0) {
        this.procesarAreas(area.subareas);
      }
    }
  }

  /**
   * Verifica si el usuario tiene permiso para editar en el área dada.
   */
  puedeEditar(areaId: number): boolean {
    const permisos = this.permisosMap.get(areaId);
    return permisos ? permisos.puede_editar : false;
  }

  /**
   * Verifica si el usuario tiene permiso para publicar en el área dada.
   */
  puedePublicar(areaId: number): boolean {
    const permisos = this.permisosMap.get(areaId);
    return permisos ? permisos.puede_publicar : false;
  }

  /**
   * Obtiene todos los IDs de áreas donde el usuario tiene permiso de edición.
   */
  getAreasEditables(): number[] {
    const editables: number[] = [];
    this.permisosMap.forEach((permiso, id) => {
      if (permiso.puede_editar) {
        editables.push(id);
      }
    });
    return editables;
  }

  /**
   * Verifica si el usuario puede editar en base a un fragmento del nombre del área.
   */
  puedeEditarPorNombre(fragmento: string): boolean {
    const fragmentoLower = fragmento.toLowerCase();
    for (const [id, permiso] of this.permisosMap.entries()) {
      if (permiso.nombre.toLowerCase().includes(fragmentoLower)) {
        if (permiso.puede_editar) return true;
      }
    }
    return false;
  }
}
