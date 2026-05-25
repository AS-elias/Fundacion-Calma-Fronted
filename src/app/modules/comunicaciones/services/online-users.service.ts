import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class OnlineUsersService {
  
  // Señal para rastrear usuarios conectados
  connectedUsers = signal<Set<number>>(new Set());

  constructor() {}

  /**
   * Agrega un usuario a la lista de conectados
   */
  addOnlineUser(userId: number): void {
    const users = new Set(this.connectedUsers());
    users.add(userId);
    this.connectedUsers.set(users);
    console.log('Usuario en línea:', userId);
  }

  /**
   * Remueve un usuario de la lista de conectados
   */
  removeOnlineUser(userId: number): void {
    const users = new Set(this.connectedUsers());
    users.delete(userId);
    this.connectedUsers.set(users);
    console.log('Usuario fuera de línea:', userId);
  }

  /**
   * Verifica si un usuario está en línea
   */
  isUserOnline(userId: number): boolean {
    return this.connectedUsers().has(userId);
  }

  /**
   * Obtiene la lista de usuarios en línea
   */
  getOnlineUsers(): number[] {
    return Array.from(this.connectedUsers());
  }

  /**
   * Actualiza el estado en línea de un usuario en los contactos
   */
  updateUserStatusInContactos(contactos: any[], userId: number, isOnline: boolean): any[] {
    return contactos.map(contacto => {
      // Clonar el contacto para asegurar que Angular detecte el cambio de referencia
      const nuevoContacto = { ...contacto };
      
      if (nuevoContacto.participantes && Array.isArray(nuevoContacto.participantes)) {
        nuevoContacto.participantes = nuevoContacto.participantes.map((p: any) => {
          const pId = Number(p.id) || Number(p.usuarioId);
          if (pId === Number(userId)) {
            return { ...p, enLinea: isOnline };
          }
          return p;
        });

        // Revisar si modificamos al participante
        const participante = nuevoContacto.participantes.find((p: any) => 
          (Number(p.id) || Number(p.usuarioId)) === Number(userId)
        );

        if (participante) {
          // Si es un chat directo (no es grupo), el estado del contacto refleja al del otro participante
          if (!nuevoContacto.esGrupo) {
            nuevoContacto.enLinea = isOnline;
          }
        }
      }
      return nuevoContacto;
    });
  }

  /**
   * Limpia la lista de usuarios en línea
   */
  clear(): void {
    this.connectedUsers.set(new Set());
  }
}
