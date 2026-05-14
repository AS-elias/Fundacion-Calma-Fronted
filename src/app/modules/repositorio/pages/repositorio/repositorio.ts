import { Component, OnInit } from '@angular/core';
import { RepositorioService, Bloque } from '../../services/repositorio.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-repositorio',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './repositorio.html',
  styleUrls: ['./repositorio.scss']
})
export class Repositorio implements OnInit {

  bloques: Bloque[] = [];
  bloqueSeleccionado: Bloque | null = null;

  nuevoDocumento = '';
  nuevoNombre = '';
  nuevoLink = '';

  mostrarConfirmacion = false;
  itemAEliminar: { tipo: 'red' | 'doc', index: number } | null = null;

  constructor(private repoService: RepositorioService) {}

  ngOnInit() {
    this.bloques = this.repoService.getBloques();
  }

  seleccionarBloque(bloque: Bloque) {
    this.bloqueSeleccionado = bloque;
  }

  cerrarModal() {
    this.bloqueSeleccionado = null;
  }

  esRedesSociales(): boolean {
    return this.bloqueSeleccionado?.titulo.includes('Redes') ?? false;
  }

  archivoSeleccionado: File | null = null;

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.archivoSeleccionado = file;
    }
  }

  agregarDocumento() {
    if (this.bloqueSeleccionado && this.archivoSeleccionado) {

      const url = URL.createObjectURL(this.archivoSeleccionado);

      this.bloqueSeleccionado.documentos.push({
        nombre: this.archivoSeleccionado.name,
        url: url
      });

      this.archivoSeleccionado = null;
    }
  }

  agregarRedSocial() {
    if (this.bloqueSeleccionado && this.nuevoLink) {

      const url = this.nuevoLink.toLowerCase();
      let icono = 'fa-globe';

      if (url.includes('facebook')) icono = 'fa-facebook-f';
      if (url.includes('instagram')) icono = 'fa-instagram';
      if (url.includes('tiktok')) icono = 'fa-tiktok';
      if (url.includes('linkedin')) icono = 'fa-linkedin-in';

      this.bloqueSeleccionado.documentos.push({
        nombre: this.nuevoNombre || 'Fundación Calma',
        url: this.nuevoLink,
        icono
      });

      this.nuevoNombre = '';
      this.nuevoLink = '';
    }
  }

  abrirConfirmacion(tipo: 'red' | 'doc', index: number) {
    this.itemAEliminar = { tipo, index };
    this.mostrarConfirmacion = true;
  }

  cancelarEliminar() {
    this.mostrarConfirmacion = false;
    this.itemAEliminar = null;
  }

  confirmarEliminar() {
    if (this.itemAEliminar && this.bloqueSeleccionado) {
      if (this.itemAEliminar.tipo === 'red') {
        this.bloqueSeleccionado.documentos.splice(this.itemAEliminar.index, 1);
      } else if (this.itemAEliminar.tipo === 'doc') {
        this.bloqueSeleccionado.documentos.splice(this.itemAEliminar.index, 1);
      }
    }
    this.cancelarEliminar();
  }
}