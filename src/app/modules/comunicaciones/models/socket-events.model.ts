/**
 * Tipos seguros para eventos de Socket.io
 * Reemplazan los `any[]` en los handlers de socket
 */

// ===== USER & PRESENCE EVENTS =====
export interface UserEvent {
  userId: number;
  nombre?: string;
  email?: string;
}

export interface ChannelCreatedEvent {
  canalId?: number;
  nombre?: string;
  creadorId?: number;
}

// ===== MESSAGE EVENTS =====
export interface BaseMessageData {
  id?: number;
  canalId?: number;
  remitenteId?: number;
  tipo?: 'text' | 'file' | 'image' | 'system';
  contenido?: string;
  texto?: string;
  archivoUrl?: string | null;
  fotoUrl?: string | null;
  createdAt?: string;
  timestamp?: string;
}

export interface RecentMessagesEvent {
  canalId?: number;
  messages?: BaseMessageData[];
  [key: string]: unknown;
}

export interface NewMessageEvent extends BaseMessageData {
  canalId: number;
}

// ===== WEBRTC EVENTS =====
export interface CallOfferEvent {
  fromUserId: number;
  offer: RTCSessionDescriptionInit;
  callType: 'voice' | 'video';
  callerName?: string;
  callId?: string;
}

export interface CallAnswerEvent {
  answer: RTCSessionDescriptionInit;
  callId?: string;
  toUserId?: number;
}

export interface IceCandidateEvent {
  candidate: RTCIceCandidateInit;
  callId?: string;
  toUserId?: number;
}

export interface EndCallEvent {
  callId?: string;
  fromUserId?: number;
  toUserId?: number;
  reason?: string;
}

// ===== User Channels Event =====
export interface UserChannelsEvent {
  channels?: any[];
  canales?: any[];
  [key: string]: unknown;
}
