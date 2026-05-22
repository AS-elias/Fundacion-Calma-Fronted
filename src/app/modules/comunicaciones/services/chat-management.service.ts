import { Injectable, signal } from '@angular/core';
import { Mensaje, ContactoChat } from '../models/chat.model';

@Injectable({
  providedIn: 'root'
})
export class ChatManagementService {
  
  // Señales para gestionar estado del chat
  contactos = signal<ContactoChat[]>([]);
  contactoActivo = signal<ContactoChat | undefined>(undefined);
  nuevoMensaje = signal<string>('');

  // Variables de búsqueda
  textoBusqueda = signal<string>('');
  mostrarModalNuevoChat = signal<boolean>(false);
  esModoGrupo = signal<boolean>(false);
  nombreGrupoNuevo = signal<string>('');
  usuariosSeleccionadosGrupo = signal<Set<number>>(new Set());

  // Variables del panel derecho
  mostrarInfoContacto = signal<boolean>(false);
  infoCanalActual: any = null;

  constructor() {}

  /**
   * Mapea un canal (del backend) a un contacto (del frontend)
   */
  mapChannelToContacto(canal: any): ContactoChat {
    // ✅ VALIDATION: Asegurar que el ID es un número válido
    const canalId = canal.canalId || canal.id || canal.channelId || canal.channel_id;
    const idNumero = Number(canalId);
    
    if (!idNumero || idNumero < 1) {
      console.error('❌ ERROR en mapChannelToContacto: Canal sin ID válido', canal);
    }
    
    console.log('🗂️ Mapeando canal:', { canalId: idNumero, nombre: canal.nombre });
    
    return {
      id: idNumero,
      nombre: canal.nombre || 'Sin nombre',
      iniciales: this.generarIniciales(canal.nombre || 'SN'),
      colorBg: this.generarColorDeterminista(idNumero),
      enLinea: false,
      mensajesSinLeer: canal.mensajesSinLeer || canal.unreadCount || canal.mensajesNoLeidos || canal.unreadMessages || 0,
      mensajes: [],
      esGrupo: canal.esGrupo || false,
      participantes: canal.participantes || [],
      avatarUrl: canal.avatarUrl || canal.imagenUrl || canal.foto || canal.avatarBase64 || undefined
    } as ContactoChat;
  }

  /**
   * Mapea un mensaje (del backend) a un mensaje (del frontend)
   * ⚠️ CRUCIAL: Detectar correctamente el remitente para evitar que mensajes propios aparezcan como de otros después de recargar
   */
  mapMessageToMensaje(msg: any, currentUserId: number, participantes: any[] = []): Mensaje {
    let remitenteId = null;
    
    // 1. Buscar en objetos anidados (Típico en historiales de base de datos)
    if (msg.remitente && msg.remitente.id !== undefined) remitenteId = msg.remitente.id;
    else if (msg.usuario && msg.usuario.id !== undefined) remitenteId = msg.usuario.id;
    else if (msg.sender && msg.sender.id !== undefined) remitenteId = msg.sender.id;
    else if (msg.user && msg.user.id !== undefined) remitenteId = msg.user.id;
    else if (msg.autor && msg.autor.id !== undefined) remitenteId = msg.autor.id;

    // 2. Buscar en campos directos
    if (remitenteId === null || remitenteId === undefined) {
      const possibleFields = [
        'remitenteId', 'remitente_id', 'usuario_id', 'usuarioId',
        'senderId', 'sender_id', 'userId', 'user_id',
        'autorId', 'autor_id', 'id_remitente', 'id_usuario'
      ];
      
      for (const field of possibleFields) {
        if (msg[field] !== undefined && msg[field] !== null) {
          remitenteId = msg[field];
          break;
        }
      }
    }
    
    // Si sigue nulo, intentamos buscar alguna llave que contenga 'id'
    if (remitenteId === null || remitenteId === undefined) {
        for (const [key, value] of Object.entries(msg)) {
            const k = key.toLowerCase();
            if (value && typeof value === 'object' && 'id' in (value as any)) {
                if (k.includes('remitente') || k.includes('usuario') || k.includes('sender') || k.includes('autor')) {
                    remitenteId = (value as any).id;
                    break;
                }
            }
            if ((typeof value === 'number' || typeof value === 'string') && 
                (k.includes('remitente') || k.includes('usuario') || k.includes('sender') || k.includes('autor'))) {
                if (k.includes('id')) {
                    remitenteId = value;
                    break;
                }
            }
        }
    }

    // Asegurarnos de que ambos sean números válidos para la comparación
    const remitenteNum = Number(remitenteId) || 0;
    const currentUserNum = Number(currentUserId) || 0;

    if (remitenteNum === 0) {
      console.warn('⚠️ CRÍTICO: No se pudo extraer el ID del remitente del mensaje. Verifica el formato que envía el backend.', msg);
    }
    
    // La validación final
    const esDeEste = (remitenteNum !== 0 && currentUserNum !== 0) && (remitenteNum === currentUserNum);
    
    console.log('🎯 DECISIÓN FINAL MAPEANDO:', {
      remitenteEncontrado: remitenteNum,
      miUsuarioActual: currentUserNum,
      esMio: esDeEste,
      texto: (msg.content || msg.texto || msg.contenido || '')
    });
    
    // Extraer el nombre del remitente
    let remitenteNombre = 'Usuario';
    if (msg.remitente && msg.remitente.nombreCompleto) remitenteNombre = msg.remitente.nombreCompleto;
    else if (msg.remitente && msg.remitente.nombre_completo) remitenteNombre = msg.remitente.nombre_completo;
    else if (msg.remitente && msg.remitente.nombre) remitenteNombre = msg.remitente.nombre;
    else if (msg.usuario && msg.usuario.nombreCompleto) remitenteNombre = msg.usuario.nombreCompleto;
    else if (msg.usuario && msg.usuario.nombre_completo) remitenteNombre = msg.usuario.nombre_completo;
    else if (msg.usuario && msg.usuario.nombre) remitenteNombre = msg.usuario.nombre;
    else if (msg.sender && msg.sender.nombre) remitenteNombre = msg.sender.nombre;
    else if (msg.autor && msg.autor.nombre) remitenteNombre = msg.autor.nombre;
    else if (msg.nombreRemitente) remitenteNombre = msg.nombreRemitente;
    else if (msg.nombreUsuario) remitenteNombre = msg.nombreUsuario;

    // 🔥 FALLBACK MAGICO: Si sigue diciendo 'Usuario', buscarlo en la lista de participantes del grupo
    if (remitenteNombre === 'Usuario' && remitenteId && participantes.length > 0) {
      const part = participantes.find((p: any) => Number(p.id) === Number(remitenteId) || Number(p.usuarioId) === Number(remitenteId));
      if (part) {
        const infoPart = part.usuario || part;
        remitenteNombre = infoPart.nombreCompleto || infoPart.nombre_completo || infoPart.nombre || 'Usuario';
      }
    }

    // Extraer Avatar del Remitente
    let remitenteAvatarUrl = undefined;
    if (msg.remitente && (msg.remitente.avatarUrl || msg.remitente.fotoUrl || msg.remitente.foto)) remitenteAvatarUrl = msg.remitente.avatarUrl || msg.remitente.fotoUrl || msg.remitente.foto;
    else if (msg.usuario && (msg.usuario.avatarUrl || msg.usuario.fotoUrl || msg.usuario.foto)) remitenteAvatarUrl = msg.usuario.avatarUrl || msg.usuario.fotoUrl || msg.usuario.foto;
    else if (msg.sender && (msg.sender.avatarUrl || msg.sender.fotoUrl || msg.sender.foto)) remitenteAvatarUrl = msg.sender.avatarUrl || msg.sender.fotoUrl || msg.sender.foto;
    else if (msg.autor && (msg.autor.avatarUrl || msg.autor.fotoUrl || msg.autor.foto)) remitenteAvatarUrl = msg.autor.avatarUrl || msg.autor.fotoUrl || msg.autor.foto;

    if (!remitenteAvatarUrl && remitenteId && participantes.length > 0) {
      const part = participantes.find((p: any) => Number(p.id) === Number(remitenteId) || Number(p.usuarioId) === Number(remitenteId));
      if (part) {
        const infoPart = part.usuario || part;
        remitenteAvatarUrl = infoPart.avatarUrl || infoPart.fotoUrl || infoPart.foto;
      }
    }

    // Formatear la hora a algo bonito como "14:30" o "02:30 PM"
    let horaFormateada = '';
    try {
      const rawDate = msg.createdAt || msg.fecha || msg.timestamp || new Date().toISOString();
      horaFormateada = new Date(rawDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch(e) {
      horaFormateada = '00:00';
    }

    const mappedMsg: any = {
      id: msg.id || msg.mensajeId || 0,
      texto: msg.content || msg.texto || msg.contenido || '',
      hora: horaFormateada,
      timestampReal: msg.createdAt || msg.fecha || msg.timestamp || new Date().toISOString(),
      enviadoPorMi: esDeEste,
      tipo: msg.tipo || 'text',
      archivoUrl: msg.archivoUrl || msg.fileUrl,
      leido: msg.leido || msg.read || false,
      editado: msg.editado || msg.edited || msg.isEdited || false,
      remitenteNombre: remitenteNombre,
      remitenteAvatarUrl: remitenteAvatarUrl,
      remitenteIniciales: this.generarIniciales(remitenteNombre)
    };
    return mappedMsg as Mensaje;
  }

  /**
   * Genera iniciales a partir de un nombre
   */
  private generarIniciales(nombre: string): string {
    return nombre
      .split(' ')
      .slice(0, 2)
      .map(palabra => palabra[0]?.toUpperCase())
      .join('');
  }

  /**
   * Genera un color consistente basado en el ID para que no cambie al recargar
   */
  private generarColorDeterminista(id: number): string {
    const colores = [
      'bg-blue-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-green-500',
      'bg-yellow-500',
      'bg-red-500',
      'bg-indigo-500',
      'bg-teal-500'
    ];
    return colores[id % colores.length];
  }

  /**
   * Selecciona un contacto activo
   */
  seleccionarContacto(contacto: ContactoChat): void {
    const nuevosContactos = this.contactos().map(c => {
      if (c.id === contacto.id) {
        return { ...c, mensajesSinLeer: 0 };
      }
      return c;
    });
    this.contactos.set(nuevosContactos);
    
    // Asignar el objeto actualizado al activo para mantener referencias sincronizadas
    const contactoActualizado = nuevosContactos.find(c => c.id === contacto.id);
    if (contactoActualizado) {
      this.contactoActivo.set(contactoActualizado);
    } else {
      this.contactoActivo.set(contacto);
    }
  }

  /**
   * Cierra el chat activo (deselecciona)
   */
  cerrarChat(): void {
    this.contactoActivo.set(undefined);
    localStorage.removeItem('activeChannelId');
  }

  /**
   * Agrega un nuevo mensaje al contacto activo
   */
  agregarMensajeAlContactoActivo(mensaje: Mensaje): void {
    const contacto = this.contactoActivo();
    if (contacto) {
      contacto.mensajes.push(mensaje);
    }
  }

  /**
   * Incrementa el contador de mensajes sin leer
   */
  incrementarMensajesSinLeer(contactoId: number): void {
    const nuevosContactos = this.contactos().map(c => {
      if (c.id === contactoId) {
        return { ...c, mensajesSinLeer: c.mensajesSinLeer + 1 };
      }
      return c;
    });
    this.contactos.set(nuevosContactos);
  }

  /**
   * Busca un contacto que tenga al usuario específico como participante
   */
  buscarContactoConParticipante(contactos: ContactoChat[], usuarioId: number): ContactoChat | undefined {
    return contactos.find(c => this.contactoTieneParticipante(c, usuarioId));
  }

  /**
   * Verifica si un contacto tiene a un usuario específico como participante
   */
  contactoTieneParticipante(contacto: ContactoChat, usuarioId: number): boolean {
    return contacto.participantes?.some((p: any) =>
      Number(p.id) === Number(usuarioId) ||
      Number(p.usuarioId) === Number(usuarioId)
    ) || false;
  }

  /**
   * Obtiene el ID del otro participante en un chat directo
   */
  obtenerOtroParticipanteId(contacto: ContactoChat, currentUserId: number): number {
    if (!contacto.participantes || contacto.participantes.length === 0) {
      return 0;
    }
    const otro = contacto.participantes.find((p: any) =>
      Number(p.id) !== Number(currentUserId) &&
      Number(p.usuarioId) !== Number(currentUserId)
    );
    return Number(otro?.id || otro?.usuarioId || 0);
  }

  /**
   * Guarda mensajes en localStorage para persistencia
   */
  guardarMensajesLocalStorage(contactoId: number, mensaje: any): void {
    const mensajesRawActuales = localStorage.getItem(`messages_raw_${contactoId}`);
    let arregloRaw = [];
    if (mensajesRawActuales) {
      try {
        arregloRaw = JSON.parse(mensajesRawActuales);
      } catch (e) {
        arregloRaw = [];
      }
    }
    arregloRaw.push(mensaje);
    localStorage.setItem(`messages_raw_${contactoId}`, JSON.stringify(arregloRaw));
  }

  /**
   * Verifica si un mensaje es duplicado usando una tolerancia de tiempo
   */
  esMensajeDuplicado(mensajes: Mensaje[], nuevoMsg: Mensaje): boolean {
    return mensajes.some(m => {
      if (m.texto !== nuevoMsg.texto || m.enviadoPorMi !== nuevoMsg.enviadoPorMi) {
        return false;
      }
      if ((m as any).timestampReal && (nuevoMsg as any).timestampReal) {
        // Usar el timestamp oculto para la validación matemática exacta
        const tiempoExistente = new Date((m as any).timestampReal).getTime();
        const tiempoNuevo = new Date((nuevoMsg as any).timestampReal).getTime();
        return Math.abs(tiempoExistente - tiempoNuevo) < 10000;
      }
      return m.hora === nuevoMsg.hora;
    });
  }

  /**
   * Actualiza la lista de contactos
   */
  actualizarContactos(canales: any[], currentUserId: number): void {
    const canalesFiltrados = canales.filter((canal: any) => {
      if (!canal.participantes || !Array.isArray(canal.participantes)) {
        console.warn('Canal sin participantes:', canal);
        return false;
      }

      const esParticipante = canal.participantes.some((p: any) =>
        Number(p.id) === Number(currentUserId) ||
        Number(p.usuarioId) === Number(currentUserId)
      );

      if (!esParticipante) {
        console.log(`Canal ${canal.canalId || canal.id} filtrado: usuario ${currentUserId} no es participante`);
      }

      return esParticipante;
    });

    console.log(`Canales filtrados para usuario ${currentUserId}:`, canalesFiltrados.length, 'de', canales.length);
    
    const contactosMapeados = canalesFiltrados.map(canal => {
      const contacto = this.mapChannelToContacto(canal);
      
      // Calcular estado en línea inicial para chats directos
      if (!contacto.esGrupo && contacto.participantes) {
        const otro = contacto.participantes.find((p: any) => Number(p.id) !== currentUserId && Number(p.usuarioId) !== currentUserId);
        if (otro) {
          const infoOtro = otro.usuario || otro;
          contacto.enLinea = infoOtro.enLinea === true || infoOtro.isOnline === true || infoOtro.online === true || false;
          
          // 🔥 FIX: Asignar el nombre e iniciales del otro usuario para los chats directos
          contacto.nombre = infoOtro.nombreCompleto || infoOtro.nombre_completo || infoOtro.nombre || 'Usuario Desconocido';
          contacto.iniciales = this.generarIniciales(contacto.nombre);
          if (infoOtro.avatarUrl || infoOtro.fotoUrl) (contacto as any).avatarUrl = infoOtro.avatarUrl || infoOtro.fotoUrl;
        }
      }
      return contacto;
    });
    this.contactos.set(contactosMapeados);
  }

  /**
   * Restaura el contacto activo desde localStorage
   */
  restaurarContactoActivoDesdeLocalStorage(): number | null {
    const persistedId = localStorage.getItem('activeChannelId');
    if (!persistedId) return null;

    const contactos = this.contactos();
    const found = contactos.find(c => c.id === Number(persistedId));
    if (found) {
      console.log('Restaurando canal desde localStorage:', found.id);
      this.seleccionarContacto(found);
      return found.id;
    }
    return null;
  }

  /**
   * Selecciona el primer contacto disponible
   */
  seleccionarPrimerContacto(): void {
    const contactos = this.contactos();
    if (contactos.length > 0) {
      this.seleccionarContacto(contactos[0]);
    }
  }

  /**
   * Limpia el estado del chat
   */
  limpiar(): void {
    this.contactos.set([]);
    this.contactoActivo.set(undefined);
    this.nuevoMensaje.set('');
    this.textoBusqueda.set('');
    this.mostrarModalNuevoChat.set(false);
    this.mostrarInfoContacto.set(false);
  }
}
