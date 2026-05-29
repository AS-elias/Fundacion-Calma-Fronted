import { Injectable, signal, inject } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { jwtDecode } from 'jwt-decode'; 
import { Subject } from 'rxjs';
import { SecureStorageService } from './secure-storage.service';

export interface SistemaActualizadoEvent {
  modulo: string;
  accion?: string;
  [key: string]: any;
}

@Injectable({
  providedIn: 'root'
})
export class CommunicationService {
  private socket: Socket | null = null;
  private jwtToken: string = '';
  private secureStorage = inject(SecureStorageService);

  // 🔔 Vigilante Global para todo el sistema
  public sistemaActualizado$ = new Subject<SistemaActualizadoEvent>();

  // 🔔 Canal de estado de escritura "Escribiendo..."
  public typing$ = new Subject<{ canalId: number; usuarioId: number; isTyping: boolean }>();

  // 🔔 Contador global de mensajes sin leer por canal
  mensajesSinLeerGlobal = signal<Map<number, number>>(new Map());

  // Referencia nombrada del listener global para poder re-adjuntarlo después del socket.off del componente
  private readonly globalNewMessageHandler = (data: any) => {
    if (!data?.canalId) return;
    const remitenteId = Number(
      data.remitenteId ?? data.emisor_id ?? data.senderId ?? 0,
    );
    const myId = this.getCurrentUserId();
    if (remitenteId > 0 && remitenteId === myId) return;

    const canalId = Number(data.canalId);
    if (isNaN(canalId)) return;
    const mapa = new Map(this.mensajesSinLeerGlobal());
    mapa.set(canalId, (mapa.get(canalId) || 0) + 1);
    this.mensajesSinLeerGlobal.set(mapa);
  };


  constructor() { }

  connect(jwtToken: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Validar si ya estamos conectados para evitar crear múltiples sockets
      if (this.socket && this.socket.connected) {
        console.log('Socket ya estaba conectado');
        return resolve();
      }

      this.jwtToken = jwtToken;

      this.socket = io('https://fundacion-calma-backend.onrender.com/comunicaciones', {
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
        // Registrar el listener global con referencia nombrada
        this.socket?.off('newMessage', this.globalNewMessageHandler); // Evitar duplicados
        this.socket?.on('newMessage', this.globalNewMessageHandler);

        // Registrar el vigilante global de sistema_actualizado
        this.socket?.on('sistema_actualizado', (data: SistemaActualizadoEvent) => {
          this.sistemaActualizado$.next(data);
        });

        // Registrar evento typing
        this.socket?.on('typing', (data: { canalId: number; usuarioId: number; isTyping: boolean }) => {
          this.typing$.next(data);
        });

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
      this.socket.off('newMessage', this.globalNewMessageHandler);
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * Re-registra el listener global de newMessage.
   * Llamar esto después de cualquier socket.off('newMessage') del componente
   * para que el contador global no se pierda.
   */
  reattachGlobalListeners(): void {
    if (!this.socket) return;
    this.socket.off('newMessage', this.globalNewMessageHandler); // quitar primero para no duplicar
    this.socket.on('newMessage', this.globalNewMessageHandler);
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  getCurrentUserId(): number {
    const token = this.secureStorage.getItem('calma_token') || localStorage.getItem('token') || this.jwtToken;
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
  createChannel(data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        console.error('❌ No hay conexión Socket');
        return reject('No socket');
      }
      console.log('🚀 Creando canal:', data);
      
      this.socket.emit('createChannel', data, (response: any) => {
        if (response && response.success) {
          resolve(response.data);
        } else {
          reject(response?.error || 'Error al crear/obtener canal');
        }
      });
    });
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

  // C2) Enviar Estado Escribiendo
  sendTyping(canalId: number, isTyping: boolean): void {
    if (!this.socket) return;
    this.socket.emit('typing', { canalId, isTyping });
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

  /** Sincroniza el mapa global sin perder conteos en memoria (toma el máximo por canal) */
  syncUnreadFromChannels(channels: unknown[]): void {
    if (!Array.isArray(channels)) return;
    const mapa = new Map(this.mensajesSinLeerGlobal());
    channels.forEach((item: any) => {
      const id = Number(item?.canalId ?? item?.id ?? 0);
      const unread = Number(item?.unreadCount ?? item?.mensajesSinLeer ?? 0);
      if (id > 0 && unread > 0) {
        mapa.set(id, Math.max(mapa.get(id) || 0, unread));
      }
    });
    this.mensajesSinLeerGlobal.set(mapa);
  }

  /** Conecta el socket y carga contadores de no leídos para el sidebar */
  ensureUnreadBadgeSync(): void {
    const token =
      this.secureStorage.getItem('calma_token') ||
      localStorage.getItem('token') ||
      this.jwtToken;
    if (!token) return;

    const syncHandler = (data: unknown) => this.syncUnreadFromChannels(data as unknown[]);

    this.connect(token)
      .then(() => {
        const socket = this.getSocket();
        if (!socket) return;
        socket.off('userChannels', syncHandler);
        socket.on('userChannels', syncHandler);
        this.getUserChannels({ usuarioId: this.getCurrentUserId() });
      })
      .catch(() => {});
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
  async uploadFile(canalId: number, file: File, tipoRecibido?: string): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    if (tipoRecibido) {
      formData.append('tipo', tipoRecibido);
    }

    const response = await fetch(
      `https://fundacion-calma-backend.onrender.com/api/comunicaciones/channels/${canalId}/files`,
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
      `https://fundacion-calma-backend.onrender.com/api/comunicaciones/channels/${canalId}`,
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
      `https://fundacion-calma-backend.onrender.com/api/comunicaciones/channels/${canalId}/info`,
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
      `https://fundacion-calma-backend.onrender.com/api/comunicaciones/channels/${canalId}`,
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
      `https://fundacion-calma-backend.onrender.com/api/comunicaciones/messages/${mensajeId}/reactions`,
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
