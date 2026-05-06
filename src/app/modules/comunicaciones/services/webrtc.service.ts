import { Injectable, signal } from '@angular/core';
import { CommunicationService } from '../../../core/services/communication.service';

export interface CallState {
  callId: string;
  targetUserId: number;
  fromUserId: number;
  callType: 'voice' | 'video';
  startTime?: Date;
}

export interface RemoteUser {
  id: number;
  nombre: string;
}

@Injectable({
  providedIn: 'root'
})
export class WebRtcService {
  
  // Señales para gestionar estado de llamadas
  currentCall = signal<CallState | null>(null);
  remoteUser = signal<RemoteUser | null>(null);
  callState = signal<'idle' | 'calling' | 'connected' | 'incoming'>('idle');
  isCallActive = signal<boolean>(false);
  isCallIncoming = signal<boolean>(false);
  
  // Estado de streams
  localStream: MediaStream | null = null;
  remoteStream: MediaStream | null = null;
  peerConnection: RTCPeerConnection | null = null;
  
  // Referencias a elementos de video (para mostrar streams)
  localVideoElement: HTMLVideoElement | null = null;
  remoteVideoElement: HTMLVideoElement | null = null;
  
  // Datos de llamada entrante
  incomingCallFromId: number | null = null;
  incomingCallFromName: string = '';
  incomingCallOffer: any = null;
  callType: 'voice' | 'video' | null = null;

  constructor(private communicationService: CommunicationService) {}

  /**
   * Registra las referencias a elementos de video para mostrar streams
   */
  setVideoElements(localVideoElement: HTMLVideoElement, remoteVideoElement: HTMLVideoElement): void {
    this.localVideoElement = localVideoElement;
    this.remoteVideoElement = remoteVideoElement;
    console.log('✅ Referencias de video registradas');
  }

  /**
   * Prepara los medios locales (audio/video) para una llamada
   * IMPORTANTE: Detiene el stream anterior antes de solicitar uno nuevo
   */
  async prepareLocalMedia(type: 'voice' | 'video'): Promise<void> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('El navegador no soporta WebRTC');
    }

    // ⚠️ CRITICAL FIX: Si ya hay un stream local, detenerlo antes de solicitar uno nuevo
    if (this.localStream) {
      console.log('⚠️ Stream local previo encontrado, limpiando...');
      this.localStream.getTracks().forEach(track => {
        console.log('  ❌ Deteniendo track anterior:', track.kind);
        track.stop();
      });
      this.localStream = null;
    }

    const constraints: MediaStreamConstraints = type === 'video'
      ? { audio: true, video: { width: { ideal: 1280 }, height: { ideal: 720 } } }
      : { audio: true, video: false };

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('✅ Stream local adquirido:', {
        audio: this.localStream.getAudioTracks().length,
        video: this.localStream.getVideoTracks().length
      });

      // ⚠️ CRITICAL FIX: Asignar stream al elemento de video si existe
      if (this.localVideoElement && type === 'video') {
        this.localVideoElement.srcObject = this.localStream;
        console.log('✅ Stream local asignado al elemento video');
      }
    } catch (error) {
      console.error('❌ Error adquiriendo medios:', error);
      throw error;
    }

    if (!this.peerConnection) {
      const targetUserId = this.currentCall()?.targetUserId || 0;
      await this.createPeerConnection(targetUserId);
    }

    if (this.peerConnection && this.localStream) {
      this.localStream.getTracks().forEach(track => {
        this.peerConnection?.addTrack(track, this.localStream as MediaStream);
      });
    }
  }

  /**
   * Crea la conexión peer para WebRTC
   */
  private async createPeerConnection(targetUserId: number): Promise<void> {
    if (this.peerConnection) {
      return;
    }

    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    this.peerConnection.onicecandidate = event => {
      if (event.candidate && this.currentCall()) {
        this.communicationService.sendIceCandidate({
          targetUserId,
          fromUserId: this.currentCall()?.fromUserId || 0,
          candidate: event.candidate,
          callId: this.currentCall()?.callId || ''
        }).catch(err => console.warn('Error enviando ICE candidate:', err));
      }
    };

    this.peerConnection.ontrack = event => {
      console.log('✅ Track remoto recibido:', event.track.kind);
      this.remoteStream = event.streams[0];
      
      // ⚠️ CRITICAL FIX: Asignar stream remoto al elemento de video si existe
      if (this.remoteVideoElement && this.remoteStream) {
        this.remoteVideoElement.srcObject = this.remoteStream;
        console.log('✅ Stream remoto asignado al elemento video');
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      console.log('PeerConnection state cambió a:', this.peerConnection?.connectionState);
      if (this.peerConnection?.connectionState === 'connected') {
        this.callState.set('connected');
        console.log('✅ Llamada WebRTC conectada exitosamente');
      } else if (
        this.peerConnection?.connectionState === 'disconnected' ||
        this.peerConnection?.connectionState === 'failed' ||
        this.peerConnection?.connectionState === 'closed'
      ) {
        console.log('❌ Llamada WebRTC desconectada o fallida');
        this.terminateCall();
      }
    };
  }

  /**
   * Inicia una nueva llamada saliente
   */
  async startCall(targetUserId: number, targetName: string, currentUserId: number, type: 'voice' | 'video', userName: string): Promise<void> {
    console.log('Iniciando llamada con usuario:', targetUserId);

    // Limpiar estado anterior
    this.cleanupPreviousCall();

    this.callType = type;
    this.isCallActive.set(true);
    this.isCallIncoming.set(false);
    this.callState.set('calling');

    // Actualizar currentCall y remoteUser
    this.currentCall.set({
      callId: `call_${Date.now()}_${currentUserId}_${targetUserId}`,
      targetUserId,
      fromUserId: currentUserId,
      callType: type,
      startTime: new Date()
    });
    this.remoteUser.set({ id: targetUserId, nombre: targetName });

    await this.prepareLocalMedia(type);

    if (!this.peerConnection) {
      throw new Error('No se pudo crear PeerConnection');
    }

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    await this.communicationService.sendCallOffer({
      targetUserId,
      fromUserId: currentUserId,
      fromName: userName,
      callType: type,
      offer,
      callId: this.currentCall()?.callId || ''
    }).catch(err => console.warn('Error enviando callOffer:', err));
  }

  /**
   * Responde a una llamada entrante
   */
  async answerIncomingCall(): Promise<void> {
    if (!this.incomingCallOffer) {
      throw new Error('No hay oferta para responder');
    }

    if (!this.peerConnection) {
      const callTargetUserId = this.currentCall()?.targetUserId || 0;
      await this.createPeerConnection(callTargetUserId);
    }

    if (!this.peerConnection) {
      throw new Error('No se pudo crear PeerConnection');
    }

    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(this.incomingCallOffer));
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer as RTCSessionDescriptionInit);

    await this.communicationService.sendCallAnswer({
      targetUserId: this.incomingCallFromId || 0,
      fromUserId: this.currentCall()?.fromUserId || 0,
      answer,
      callId: this.currentCall()?.callId || ''
    }).catch(err => console.warn('Error enviando callAnswer:', err));
  }

  /**
   * Procesa una oferta de llamada entrante
   */
  setIncomingCall(data: any, currentUserId: number): void {
    if (!data || !data.fromUserId || !data.callType || !data.offer) return;

    // Si hay una llamada activa diferente, limpiarla
    if (this.currentCall() && this.currentCall()?.callId !== data.callId) {
      console.log('Nueva llamada detectada, limpiando estado anterior');
      this.cleanupPreviousCall();
    }

    this.currentCall.set({
      callId: data.callId,
      targetUserId: currentUserId,
      fromUserId: data.fromUserId,
      callType: data.callType
    });
    this.remoteUser.set({ id: data.fromUserId, nombre: data.fromName || 'Usuario' });
    this.callState.set('incoming');

    this.incomingCallFromId = Number(data.fromUserId);
    this.incomingCallFromName = data.fromName || 'Usuario';
    this.callType = data.callType;
    this.isCallIncoming.set(true);
    this.incomingCallOffer = data.offer;
  }

  /**
   * Procesa una respuesta a una llamada saliente
   */
  async handleCallAnswer(data: any): Promise<void> {
    if (!data || !this.peerConnection) return;
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
    this.callState.set('connected');
  }

  /**
   * Agrega un ICE candidate
   */
  async addIceCandidate(data: any): Promise<void> {
    if (!data || !this.peerConnection || !data.candidate) return;
    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    } catch (error) {
      console.warn('Error al agregar ICE candidate:', error);
    }
  }

  /**
   * Termina la llamada actual
   * IMPORTANTE: Detiene todos los tracks y cierra conexiones correctamente
   */
  terminateCall(): void {
    console.log('Terminando llamada');
    
    // ⚠️ CRITICAL FIX: Detener TODOS los tracks antes de anular el stream
    if (this.localStream) {
      console.log('🔴 Deteniendo stream local:', this.localStream.getTracks().length, 'tracks');
      this.localStream.getTracks().forEach(track => {
        console.log(`  ❌ Deteniendo ${track.kind} track: ${track.getSettings().width}x${track.getSettings().height}`);
        track.stop();
      });
      this.localStream = null;
    }

    if (this.remoteStream) {
      console.log('🔴 Deteniendo stream remoto:', this.remoteStream.getTracks().length, 'tracks');
      this.remoteStream.getTracks().forEach(track => {
        console.log(`  ❌ Deteniendo ${track.kind} track remoto`);
        track.stop();
      });
      this.remoteStream = null;
    }

    // ⚠️ CRITICAL FIX: Solo cerrar peerConnection si existe
    if (this.peerConnection) {
      console.log('🔴 Cerrando PeerConnection, estado:', this.peerConnection.connectionState);
      
      // Remover todos los event listeners
      this.peerConnection.onicecandidate = null;
      this.peerConnection.ontrack = null;
      this.peerConnection.onconnectionstatechange = null;
      this.peerConnection.onicegatheringstatechange = null;
      this.peerConnection.onsignalingstatechange = null;
      
      // Cerrar la conexión
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.cleanupCallState();
  }

  /**
   * Limpia el estado de la llamada anterior
   */
  private cleanupPreviousCall(): void {
    this.terminateCall();
  }

  /**
   * Limpia solo el estado de la llamada sin cerrar conexiones
   */
  private cleanupCallState(): void {
    this.currentCall.set(null);
    this.remoteUser.set(null);
    this.callState.set('idle');
    this.isCallActive.set(false);
    this.isCallIncoming.set(false);
    this.callType = null;
    this.incomingCallFromId = null;
    this.incomingCallFromName = '';
    this.incomingCallOffer = null;
  }

  /**
   * Obtiene el stream remoto (para mostrar en video del usuario remoto)
   */
  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  /**
   * Obtiene el stream local (para mostrar en video del usuario local)
   */
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }
}
