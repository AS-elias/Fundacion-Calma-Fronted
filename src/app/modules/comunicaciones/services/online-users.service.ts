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
  updateUserStatusInContactos(contactos: any[], userId: number, isOnline: boolean): void {
    contactos.forEach(contacto => {
      if (contacto.participantes && Array.isArray(contacto.participantes)) {
        const participante = contacto.participantes.find((p: any) =>
          Number(p.id) === Number(userId) ||
          Number(p.usuarioId) === Number(userId)
        );
        if (participante) {
          participante.enLinea = isOnline;

          // Si es un chat directo (no es grupo), el estado del contacto refleja al del otro participante
          if (!contacto.esGrupo) {
            contacto.enLinea = isOnline;
          }
        }
      }
    });
  }

  /**
   * Limpia la lista de usuarios en línea
   */
  clear(): void {
    this.connectedUsers.set(new Set());
  }
}
