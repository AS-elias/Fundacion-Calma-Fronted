import { Injectable, inject, signal } from '@angular/core';
import { Mensaje, ContactoChat } from '../models/chat.model';
import { CommunicationService } from '../../../core/services/communication.service';

@Injectable({
  providedIn: 'root'
})
export class ChatManagementService {
  
  private commService = inject(CommunicationService);

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

  private formatAvatarUrl(url?: string): string | undefined {
    if (!url) return undefined;
    if (url.startsWith('http') || url.startsWith('data:image')) {
      return url;
    }
    if (url.startsWith('/')) {
      return `https://fundacion-calma-backend.onrender.com${url}`;
    }
    return `https://fundacion-calma-backend.onrender.com/${url}`;
  }

  /** ID de usuario en un registro de participante (no confundir con id de fila participantes_canal) */
  obtenerUsuarioIdParticipante(p: any): number {
    const explicit =
      p?.usuarioId ??
      p?.usuario_id ??
      p?.userId ??
      p?.user_id ??
      p?.usuarios?.id;
    if (explicit != null && explicit !== '') {
      return Number(explicit);
    }
    if (p?.id != null && p?.canal_id == null && p?.canalId == null) {
      return Number(p.id);
    }
    return 0;
  }

  obtenerOtroParticipante(participantes: any[], currentUserId: number): any | undefined {
    if (!participantes?.length) return undefined;
    const yo = Number(currentUserId);
    return participantes.find(
      (p) => this.obtenerUsuarioIdParticipante(p) !== yo,
    );
  }

  /**
   * En chats 1 a 1 el nombre del canal en BD suele ser el del otro usuario visto por quien creó el chat.
   * Siempre mostramos el nombre del otro participante, nunca el propio.
   */
  private asignarNombreDesdeParticipante(
    contacto: ContactoChat,
    participante: any,
  ): void {
    const info = participante.usuario || participante.usuarios || participante;
    const nombreOtro =
      info.nombreCompleto ||
      info.nombre_completo ||
      info.nombre ||
      participante.nombre ||
      '';

    if (!nombreOtro) return;

    contacto.nombre = nombreOtro;
    contacto.iniciales = this.generarIniciales(nombreOtro);
    const avatarExtraido =
      info.avatarUrl ||
      info.fotoUrl ||
      info.foto_url ||
      info.avatar ||
      participante.avatar;
    if (avatarExtraido) {
      contacto.avatarUrl = this.formatAvatarUrl(avatarExtraido);
    }
    if (
      info.enLinea === true ||
      info.isOnline === true ||
      participante.isOnline === true
    ) {
      contacto.enLinea = true;
    }
  }

  aplicarNombreChatDirecto(
    contacto: ContactoChat,
    currentUserId: number,
    canalRaw?: any,
  ): void {
    if (contacto.esGrupo === true) return;

    const yo = Number(currentUserId);
    if (!yo) return;

    const otro = this.obtenerOtroParticipante(
      contacto.participantes || [],
      yo,
    );
    if (otro) {
      this.asignarNombreDesdeParticipante(contacto, otro);
      return;
    }

    const ultimo = canalRaw?.ultimoMensaje;
    const remitenteId = Number(
      ultimo?.remitenteId ?? ultimo?.emisor_id ?? 0,
    );
    if (remitenteId > 0 && remitenteId !== yo) {
      const part = contacto.participantes?.find(
        (p) => this.obtenerUsuarioIdParticipante(p) === remitenteId,
      );
      if (part) {
        this.asignarNombreDesdeParticipante(contacto, part);
      }
    }
  }

  /**
   * Mapea un canal (del backend) a un contacto (del frontend)
   */
  mapChannelToContacto(canal: any, currentUserId: number): ContactoChat {
    // ✅ VALIDATION: Asegurar que el ID es un número válido
    const canalId = canal.canalId || canal.id || canal.channelId || canal.channel_id;
    const idNumero = Number(canalId);
    
    if (!idNumero || idNumero < 1) {
      console.error('❌ ERROR en mapChannelToContacto: Canal sin ID válido', canal);
    }
    
    console.log('🗂️ Mapeando canal:', { canalId: idNumero, nombre: canal.nombre });
    
    // 🔥 FIX: Si el backend envía el último mensaje, lo mapeamos para que se vea en el sidebar
    const mensajesIniciales = [];
    if (canal.ultimoMensaje) {
      mensajesIniciales.push(this.mapMessageToMensaje(canal.ultimoMensaje, currentUserId, canal.participantes || []));
    }
    
    const contacto: ContactoChat = {
      id: idNumero,
      nombre: canal.nombre || 'Sin nombre',
      iniciales: this.generarIniciales(canal.nombre || 'SN'),
      colorBg: this.generarColorDeterminista(idNumero),
      enLinea: false,
      mensajesSinLeer: canal.mensajesSinLeer || canal.unreadCount || canal.mensajesNoLeidos || canal.unreadMessages || 0,
      mensajes: mensajesIniciales,
      esGrupo: canal.esGrupo === true || canal.es_grupo === true,
      participantes: canal.participantes || [],
      avatarUrl: this.formatAvatarUrl(canal.avatarUrl || canal.imagenUrl || canal.foto || canal.avatarBase64)
    };

    this.aplicarNombreChatDirecto(contacto, currentUserId, canal);
    return contacto;
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
    if (msg.remitente && (msg.remitente.avatarUrl || msg.remitente.fotoUrl || msg.remitente.foto_url || msg.remitente.avatar || msg.remitente.foto)) remitenteAvatarUrl = msg.remitente.avatarUrl || msg.remitente.fotoUrl || msg.remitente.foto_url || msg.remitente.avatar || msg.remitente.foto;
    else if (msg.usuario && (msg.usuario.avatarUrl || msg.usuario.fotoUrl || msg.usuario.foto_url || msg.usuario.avatar || msg.usuario.foto)) remitenteAvatarUrl = msg.usuario.avatarUrl || msg.usuario.fotoUrl || msg.usuario.foto_url || msg.usuario.avatar || msg.usuario.foto;
    else if (msg.sender && (msg.sender.avatarUrl || msg.sender.fotoUrl || msg.sender.foto_url || msg.sender.avatar || msg.sender.foto)) remitenteAvatarUrl = msg.sender.avatarUrl || msg.sender.fotoUrl || msg.sender.foto_url || msg.sender.avatar || msg.sender.foto;
    else if (msg.autor && (msg.autor.avatarUrl || msg.autor.fotoUrl || msg.autor.foto_url || msg.autor.avatar || msg.autor.foto)) remitenteAvatarUrl = msg.autor.avatarUrl || msg.autor.fotoUrl || msg.autor.foto_url || msg.autor.avatar || msg.autor.foto;

    if (!remitenteAvatarUrl && remitenteId && participantes.length > 0) {
      const part = participantes.find((p: any) => Number(p.id) === Number(remitenteId) || Number(p.usuarioId) === Number(remitenteId));
      if (part) {
        const infoPart = part.usuario || part;
        remitenteAvatarUrl = infoPart.avatarUrl || infoPart.fotoUrl || infoPart.foto_url || infoPart.avatar || infoPart.foto;
      }
    }
    
    remitenteAvatarUrl = this.formatAvatarUrl(remitenteAvatarUrl);

    // Formatear la hora correctamente buscando todos los campos posibles del backend
    let horaFormateada = '';
    let fechaISO = '';
    try {
      // Busca en todos los campos posibles que puede enviar el backend
      const rawDate = msg.createdAt || msg.creadoAt || msg.creado_at || msg.created_at ||
                      msg.fecha || msg.timestamp || msg.date || msg.sentAt || msg.enviadoAt || null;
      if (rawDate) {
        const d = new Date(rawDate);
        fechaISO = d.toISOString();
        horaFormateada = d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', hour12: true });
      } else {
        // Fallback: hora actual (mensajes enviados localmente antes de confirmar)
        const now = new Date();
        fechaISO = now.toISOString();
        horaFormateada = now.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', hour12: true });
      }
    } catch(e) {
      horaFormateada = '00:00';
      fechaISO = new Date().toISOString();
    }

    let tipoFinal = msg.tipo || 'text';
    const archivoFinalUrl = msg.archivoUrl || msg.fileUrl;
    
    // Corregir el tipo si el backend lo guardó erróneamente como 'file' pero la URL indica que es imagen
    if (tipoFinal === 'file' && archivoFinalUrl) {
      if (/\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(archivoFinalUrl)) {
        tipoFinal = 'image';
      }
    }

    const mappedMsg: any = {
      id: msg.id || msg.mensajeId || 0,
      texto: msg.content || msg.texto || msg.contenido || '',
      hora: horaFormateada,
      fechaISO: fechaISO,
      timestampReal: fechaISO,
      enviadoPorMi: esDeEste,
      tipo: tipoFinal,
      archivoUrl: archivoFinalUrl,
      leido: msg.leido || msg.read || false,
      editado: msg.editado || msg.edited || msg.isEdited || false,
      remitenteNombre: remitenteNombre,
      remitenteAvatarUrl: remitenteAvatarUrl,
      remitenteIniciales: this.generarIniciales(remitenteNombre),
      reacciones: msg.reacciones || []
    };
    return mappedMsg as Mensaje;
  }

  /**
   * Formatea una fecha ISO en etiqueta estilo WhatsApp: Hoy, Ayer, o la fecha
   */
  formatearEtiquetaDia(fechaISO: string): string {
    if (!fechaISO) return '';
    const fecha = new Date(fechaISO);
    const hoy = new Date();
    const ayer = new Date(); ayer.setDate(ayer.getDate() - 1);

    const mismoAnio = fecha.getFullYear() === hoy.getFullYear();
    const mismoMes = fecha.getMonth() === hoy.getMonth();
    const mismoDia = fecha.getDate() === hoy.getDate();
    const ayerMes = fecha.getMonth() === ayer.getMonth();
    const ayerDia = fecha.getDate() === ayer.getDate();
    const ayerAnio = fecha.getFullYear() === ayer.getFullYear();

    if (mismoAnio && mismoMes && mismoDia) return 'Hoy';
    if (mismoAnio && ayerMes && ayerDia && ayerAnio) return 'Ayer';
    return fecha.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  /**
   * Genera iniciales basadas en el nombre del canal o contacto
   */
  public generarIniciales(nombre: string): string {
    if (!nombre) return 'UN';
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
  seleccionarContacto(contacto: ContactoChat, currentUserId?: number): void {
    if (currentUserId) {
      this.aplicarNombreChatDirecto(contacto, currentUserId);
    }

    const nuevosContactos = this.contactos().map(c => {
      if (c.id === contacto.id) {
        return { ...contacto, mensajesSinLeer: 0 };
      }
      return c;
    });
    this.contactos.set(nuevosContactos);

    const mapaGlobal = new Map(this.commService.mensajesSinLeerGlobal());
    mapaGlobal.delete(contacto.id);
    this.commService.mensajesSinLeerGlobal.set(mapaGlobal);

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

  /** Conteo efectivo: máximo entre lista local y mapa global del sidebar */
  obtenerMensajesSinLeer(contacto: ContactoChat | number): number {
    const id = typeof contacto === 'number' ? contacto : contacto.id;
    const local =
      typeof contacto === 'number'
        ? this.contactos().find((c) => c.id === id)?.mensajesSinLeer || 0
        : contacto.mensajesSinLeer || 0;
    const global = this.commService.mensajesSinLeerGlobal().get(id) || 0;
    return Math.max(local, global);
  }

  /**
   * Incrementa el contador de mensajes sin leer
   */
  incrementarMensajesSinLeer(contactoId: number): void {
    const lista = this.contactos();
    const idx = lista.findIndex(c => c.id === contactoId);
    if (idx === -1) return;

    const nuevoConteo = this.obtenerMensajesSinLeer(lista[idx]) + 1;
    const actualizado = { ...lista[idx], mensajesSinLeer: nuevoConteo };
    const nuevosContactos = [
      actualizado,
      ...lista.filter((_, i) => i !== idx)
    ];
    this.contactos.set(nuevosContactos);

    const mapaGlobal = new Map(this.commService.mensajesSinLeerGlobal());
    mapaGlobal.set(contactoId, nuevoConteo);
    this.commService.mensajesSinLeerGlobal.set(mapaGlobal);
  }

  /**
   * Mueve un canal al tope de la lista (cuando yo envío un mensaje)
   */
  subirContactoAlTope(contactoId: number): void {
    const lista = this.contactos();
    const idx = lista.findIndex(c => c.id === contactoId);
    if (idx <= 0) return; // Ya está arriba o no existe
    const reordenados = [
      lista[idx],
      ...lista.filter((_, i) => i !== idx)
    ];
    this.contactos.set(reordenados);
    // Mantener referencia del activo sincronizada
    const activo = this.contactoActivo();
    if (activo?.id === contactoId) {
      this.contactoActivo.set(reordenados[0]);
    }
  }

  /**
   * Busca un contacto que tenga al usuario específico como participante
   */
  buscarContactoConParticipante(contactos: ContactoChat[], usuarioId: number): ContactoChat | undefined {
    return contactos.find(c => !c.esGrupo && this.contactoTieneParticipante(c, usuarioId));
  }

  /**
   * Verifica si un contacto tiene a un usuario específico como participante
   */
  contactoTieneParticipante(contacto: ContactoChat, usuarioId: number): boolean {
    return (
      contacto.participantes?.some(
        (p: any) => this.obtenerUsuarioIdParticipante(p) === Number(usuarioId),
      ) || false
    );
  }

  /**
   * Obtiene el ID del otro participante en un chat directo
   */
  obtenerOtroParticipanteId(contacto: ContactoChat, currentUserId: number): number {
    const otro = this.obtenerOtroParticipante(
      contacto.participantes || [],
      currentUserId,
    );
    return this.obtenerUsuarioIdParticipante(otro);
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
        return false;
      }

      // 🔥 SIMULACIÓN ESTILO WHATSAPP: Ocultar chats directos vacíos (0 mensajes)
      // a menos que sea el chat actualmente abierto. Así simulamos la eliminación del chat.
      const esChatDirecto = canal.esGrupo === false || canal.es_grupo === false;
      const tieneMensajes = canal.ultimoMensaje != null || (canal.mensajes && canal.mensajes.length > 0);
      const isActivo = this.contactoActivo()?.id === (canal.canalId || canal.id);

      if (esChatDirecto && !tieneMensajes && !isActivo) {
        return false; // Se oculta de la lista
      }

      return true;
    });

    console.log(`Canales filtrados para usuario ${currentUserId}:`, canalesFiltrados.length, 'de', canales.length);
    
    const mapaGlobal = this.commService.mensajesSinLeerGlobal();
    const contactosMapeados = canalesFiltrados.map(canal => {
      const contacto = this.mapChannelToContacto(canal, currentUserId);
      
      // RECUPERAR MENSAJES PREVIOS SI EXISTEN PARA EVITAR QUE SE BORREN
      const contactoExistente = this.contactos().find(c => c.id === contacto.id);
      if (contactoExistente && contactoExistente.mensajes && contactoExistente.mensajes.length > 0) {
        contacto.mensajes = [...contactoExistente.mensajes];
      }

      const previoLocal = contactoExistente?.mensajesSinLeer || 0;
      const previoGlobal = mapaGlobal.get(contacto.id) || 0;
      contacto.mensajesSinLeer = Math.max(
        contacto.mensajesSinLeer || 0,
        previoLocal,
        previoGlobal,
      );

      this.aplicarNombreChatDirecto(contacto, currentUserId, canal);

      return contacto;
    });

    // Ordenar los contactos para que el chat con el mensaje más reciente aparezca siempre primero (arriba)
    contactosMapeados.sort((a, b) => {
      const timeA = a.mensajes && a.mensajes.length > 0 
        ? new Date((a.mensajes[a.mensajes.length - 1] as any).timestampReal || (a.mensajes[a.mensajes.length - 1] as any).fechaISO || 0).getTime() 
        : 0;
      const timeB = b.mensajes && b.mensajes.length > 0 
        ? new Date((b.mensajes[b.mensajes.length - 1] as any).timestampReal || (b.mensajes[b.mensajes.length - 1] as any).fechaISO || 0).getTime() 
        : 0;
      return timeB - timeA;
    });

    this.contactos.set(contactosMapeados);
    this.commService.syncUnreadFromChannels(
      contactosMapeados.map((c) => ({
        canalId: c.id,
        unreadCount: c.mensajesSinLeer,
      })),
    );
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
