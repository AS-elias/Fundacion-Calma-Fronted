import { Injectable } from '@angular/core';

export interface Bloque {
  id: number;
  titulo: string;
  icono: string;
  documentos: any[];
}

@Injectable({
  providedIn: 'root'
})
export class RepositorioService {

  private bloques: Bloque[] = [
    {
      id: 1,
      titulo: 'MOF - Manual de Organización y Funciones',
      icono: '📁',
      documentos: []
    },
    {
      id: 2,
      titulo: 'Redes Sociales de la Fundación',
      icono: '🌐',
      documentos: [
        { nombre: 'Instagram', url: 'https://www.instagram.com/fundacioncalma', icono: 'fa-instagram' },
        { nombre: 'Facebook', url: 'https://www.facebook.com/fundacioncalma.org/', icono: 'fa-facebook-f' },
        { nombre: 'TikTok', url: 'https://www.tiktok.com/@fundacioncalma', icono: 'fa-tiktok' },
        { nombre: 'LinkedIn', url: 'https://www.linkedin.com/company/calma-fundación/', icono: 'fa-linkedin-in' }
      ]
    },
    {
      id: 3,
      titulo: 'Recursos Generales',
      icono: '📄',
      documentos: []
    },
    {
      id: 4,
      titulo: 'Políticas y Procedimientos',
      icono: '📑',
      documentos: []
    },
    {
      id: 5,
      titulo: 'Reportes Estratégicos',
      icono: '📊',
      documentos: []
    },
    {
      id: 6,
      titulo: 'Materiales de Capacitación',
      icono: '📚',
      documentos: []
    }
  ];

  getBloques(): Bloque[] {
    return this.bloques;
  }

  agregarDocumento(bloqueId: number, documento: string) {
    const bloque = this.bloques.find(b => b.id === bloqueId);
    if (bloque && documento.trim()) {
      bloque.documentos.push(documento);
    }
  }
}