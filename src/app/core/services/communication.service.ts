import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { jwtDecode } from 'jwt-decode'; 


@Injectable({
  providedIn: 'root'
})
export class CommunicationService {
  private socket: Socket | null = null;
  private jwtToken: string = '';

  constructor() { }

  connect(jwtToken: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Validar si ya estamos conectados para evitar crear múltiples sockets
      if (this.socket && this.socket.connected) {
        console.log('Socket ya estaba conectado');
        return resolve();
      }

      this.jwtToken = jwtToken;

      this.socket = io('http://localhost:3005/comunicaciones', {
        auth: {
          token: jwtToken,
        },
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
      });

      this.socket.on('connect', () => {
        console.log('Conectado a WebSocket');
        resolve();
      });

      this.socket.on('connect_error', (error: any) => {
        console.error('Error de conexión:', error);
        reject(error);
      });

      this.socket.on('unauthorized', (data: any) => {
        console.error('No autorizado:', data?.message);
        reject(new Error('Unauthorized'));
      });
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  getCurrentUserId(): number {
    const token = localStorage.getItem('calma_token') || localStorage.getItem('token') || this.jwtToken;
    if (!token) return 0;
    try {
      const decoded: any = jwtDecode(token);
      return decoded.sub || decoded.userId || decoded.id || decoded.usuarioId || 0; // Ajustar según payload JWT
    } catch (error) {
      console.warn('Error decodificando JWT:', error);
      return 0;
    }
  }
  

  // EVENTOS QUE EL FRONT-END DEBE EMITIR

  // A) Crear Canal
  // ✅ FIRE-AND-FORGET: No esperar respuesta
  createChannel(data: any): void {
    if (!this.socket) {
      console.error('❌ No hay conexión Socket');
      return;
    }
    console.log('📤 Creando canal:', data);
    this.socket.emit('createChannel', data);
    // Backend enviará userChannels cuando esté listo
  }

  // B) Unirse a un Canal
  // ✅ FIRE-AND-FORGET: No esperar respuesta
  joinChannel(data: { canalId: number, usuarioId: number }): void {
    if (!this.socket) {
      console.error('❌ No hay conexión Socket');
      return;
    }
    console.log('📤 Uniéndose al canal:', data);
    this.socket?.emit('joinChannel', data);
    // Backend responderá con recentMessages
  }

  // C) Enviar Mensaje
  // ✅ FIRE-AND-FORGET: No esperar respuesta (actualizar UI localmente)
  sendMessage(data: { canalId: number, remitenteId: number, contenido: string, tipo: string, archivoUrl: string | null }): void {
    if (!this.socket) {
      console.error('❌ No hay conexión Socket');
      return;
    }
    console.log('📤 Emitiendo mensaje:', data);
    this.socket.emit('sendMessage', data);
    // UI debe actualizarse localmente de inmediato
  }

  // D) Obtener Canales del Usuario
  getUserChannels(data: { usuarioId: number }): void {
    this.socket?.emit('getUserChannels', data);
  }

  // E) Obtener Info del Canal
  getChannelInfoEmit(data: { canalId: number }): void {
    this.socket?.emit('channelInfo', data);
  }

  // F) Actualizar Canal
  updateChannelEmit(data: any): void {
    this.socket?.emit('updateChannel', data);
  }

  // G) Obtener Mensajes Recientes
  getRecentMessages(data: { canalId: number, limit?: number }): void {
    this.socket?.emit('getRecentMessages', data);
  }

  // WebRTC / llamadas
  sendCallOffer(data: { targetUserId: number, fromUserId: number, fromName: string, callType: 'voice' | 'video', offer: any, callId: string }): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        return reject('No hay conexión Socket');
      }
      const timer = setTimeout(() => {
        resolve({ error: 'Timeout de señalización callOffer' });
      }, 5000);
      this.socket.emit('callOffer', data, (response: any) => {
        clearTimeout(timer);
        resolve(response);
      });
    });
  }

  sendCallAnswer(data: { targetUserId: number, fromUserId: number, answer: any, callId: string }): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        return reject('No hay conexión Socket');
      }
      const timer = setTimeout(() => {
        resolve({ error: 'Timeout de señalización callAnswer' });
      }, 5000);
      this.socket.emit('callAnswer', data, (response: any) => {
        clearTimeout(timer);
        resolve(response);
      });
    });
  }

  sendIceCandidate(data: { targetUserId: number, fromUserId: number, candidate: any, callId: string }): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        return reject('No hay conexión Socket');
      }
      this.socket.emit('iceCandidate', data, (response: any) => {
        resolve(response);
      });
    });
  }

  endCall(data: { targetUserId: number, fromUserId: number, callId?: string }): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        return reject('No hay conexión Socket');
      }
      this.socket.emit('endCall', data, (response: any) => {
        resolve(response);
      });
    });
  }

  // H) Editar Mensaje
  editMessage(data: { canalId: number, mensajeId: number, remitenteId: number, contenido: string }): void {
    this.socket?.emit('editMessage', data);
  }

  // I) Borrar Mensaje
  deleteMessage(data: { canalId: number, mensajeId: number, remitenteId: number }): void {
    this.socket?.emit('deleteMessage', data);
  }

  // J) Añadir Reacción
  addReactionEmit(data: { mensajeId: number, usuarioId: number, emoji: string }): Promise<any> {
    return new Promise((resolve) => {
      this.socket?.emit('addReaction', data, (response: any) => {
        resolve(response);
      });
    });
  }

  // K) Remover Reacción
  removeReactionEmit(data: { mensajeId: number, usuarioId: number, emoji: string }): void {
    this.socket?.emit('removeReaction', data);
  }

  // L) Obtener Reacciones del Mensaje
  getReactionsEmit(data: { mensajeId: number }): void {
    this.socket?.emit('getReactions', data);
  }

  // M) Marcar Mensaje como Leído
  readMessage(data: { canalId: number, mensajeId: number, usuarioId: number }): void {
    this.socket?.emit('readMessage', data);
  }

  // N) Añadir Participante
  addParticipant(data: { canalId: number, usuarioId: number, actorId: number }): void {
    this.socket?.emit('addParticipant', data);
  }

  // O) Remover Participante
  removeParticipant(data: { canalId: number, usuarioId: number, actorId: number }): void {
    this.socket?.emit('removeParticipant', data);
  }

  // P) Salir del Canal
  // ✅ FIRE-AND-FORGET: No esperar respuesta (websockets deben ser instantáneos)
  leaveChannel(data: { canalId: number, usuarioId: number }): void {
    if (!this.socket) {
      console.error('❌ No hay conexión Socket');
      return;
    }

    console.log('📤 Emitiendo leaveChannel:', data);
    this.socket.emit('leaveChannel', data);
    // No esperar callback - actualizar UI localmente de inmediato
  }

  // Q) Hacer Administrador
  makeAdmin(data: { canalId: number, usuarioId: number, actorId: number }): void {
    this.socket?.emit('makeAdmin', data);
  }

  // R) Quitar Administrador
  removeAdmin(data: { canalId: number, usuarioId: number, actorId: number }): void {
    this.socket?.emit('removeAdmin', data);
  }

  // API REST (para archivos)
  async uploadFile(canalId: number, file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(
      `http://localhost:3005/api/comunicaciones/channels/${canalId}/files`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.jwtToken}`
        },
        body: formData
      }
    );
    return response.json();
  }

  // Eliminar Canal completo usando REST
  async deleteChannelRest(canalId: number): Promise<any> {
    const response = await fetch(
      `http://localhost:3005/api/comunicaciones/channels/${canalId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.jwtToken}`
        }
      }
    );
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result?.message || result?.error || `Error ${response.status}`);
    }
    return result;
  }

  // Emitir eliminación de canal por socket (opcional)
  deleteChannelEmit(data: { canalId: number, usuarioId: number }): Promise<any> {
    return new Promise((resolve) => {
      this.socket?.emit('deleteChannel', data, (response: any) => {
        resolve(response);
      });
    });
  }

  // Obtener Info del Canal (REST)
  async getChannelInfoRest(canalId: number): Promise<any> {
    const response = await fetch(
      `http://localhost:3005/api/comunicaciones/channels/${canalId}/info`,
      {
        headers: {
          'Authorization': `Bearer ${this.jwtToken}`
        }
      }
    );
    return response.json();
  }

  // Actualizar Canal (REST alternativo)
  async updateChannelRest(canalId: number, data: any): Promise<any> {
    const response = await fetch(
      `http://localhost:3005/api/comunicaciones/channels/${canalId}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${this.jwtToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      }
    );
    return response.json();
  }

  // Añadir Reacción (REST alternativo)
  async addReactionRest(mensajeId: number, usuarioId: number, emoji: string): Promise<any> {
    const response = await fetch(
      `http://localhost:3005/api/comunicaciones/messages/${mensajeId}/reactions`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.jwtToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ usuarioId, emoji })
      }
    );
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || result.error || 'Error subiendo archivo al servidor');
    }
    return result;
  }
}
