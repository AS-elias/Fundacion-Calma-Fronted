import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy, inject, signal, computed, ViewChild, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { CommunicationService } from '../../../../core/services/communication.service';
import { AuthService } from '../../../auth/services/auth.service';
import { ComunidadService } from '../../../comunidad/services/comunidad.service';
import { User } from '../../../../shared/models/user.model';
import { ChannelInfoComponent } from '../../components/channel-info/channel-info.component';

// Servicios inyectables para separación de responsabilidades
import { ChatManagementService } from '../../services/chat-management.service';
import { OnlineUsersService } from '../../services/online-users.service';
import { ContactoChat, Mensaje } from '../../models/chat.model';
import { EmptyChatComponent } from '../../components/empty-chat/empty-chat.component';
import { 
  UserEvent, 
  ChannelCreatedEvent, 
  RecentMessagesEvent, 
  NewMessageEvent, 
  BaseMessageData
} from '../../models/socket-events.model';

@Component({
  selector: 'app-comunicaciones',
  standalone: true,
  imports: [CommonModule, FormsModule, ChannelInfoComponent, EmptyChatComponent],
  templateUrl: './comunicaciones.component.html',
  styleUrls: ['./comunicaciones.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ComunicacionesComponent implements OnInit, OnDestroy {
  
  // Inyección de servicios
  private communicationService = inject(CommunicationService);
  public authService = inject(AuthService);
  private comunidadService = inject(ComunidadService);
  private activatedRoute = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);
  chatManagement = inject(ChatManagementService);
  onlineUsers = inject(OnlineUsersService);

  // Variables de autenticación
  currentUserId: number = 0;
  jwtToken: string = '';

  // Variables para búsqueda de usuarios
  usuariosSistema: any[] = [];
  usuariosBuscados: any[] = [];
  buscarUsuario: string = '';

  // Parámetros de chat directo desde Comunidad
  pendingChatContactoId: number = 0;
  pendingChatContactoNombre: string = '';
  mensajeEnEdicion = signal<any>(null);
  menuMensajeActivo = signal<string | number | null>(null);
  menuReaccionActivo = signal<string | number | null>(null); // ID del mensaje con picker de reacción abierto
  
  // Función para obtener la URL de Twemoji de cualquier caracter emoji
  getTwemojiUrl(emojiChar: string): string {
    if (!emojiChar) return '';
    // Extraer el codepoint exacto para Twemoji (maneja emojis compuestos)
    let codePoint = '';
    for (let i = 0; i < emojiChar.length; i++) {
      const hex = emojiChar.codePointAt(i)?.toString(16);
      if (hex && hex !== 'fe0f') { // Ignorar el selector de variación
        codePoint += (codePoint ? '-' : '') + hex;
      }
      if (emojiChar.codePointAt(i)! > 0xffff) i++; // Saltar el surrogate pair
    }
    return `https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/svg/${codePoint}.svg`;
  }

  // Usamos Twemoji para las reacciones rápidas
  readonly REACCIONES_RAPIDAS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

  // Referencia al contenedor de mensajes en el HTML para el auto-scroll
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;

  // Señales para template
  textoBusqueda = signal('');
  esModoGrupo = signal(false);
  nombreGrupoNuevo = signal('');
  usuariosSeleccionadosGrupo = new Set<number>();
  subiendoArchivo = signal(false);
  fotoGrupoBase64 = signal<string | null>(null);
  esModoAgregarMiembro = signal(false);
  esModoEditarGrupo = signal(false);

  // Modal de Alertas y Confirmaciones
  dialogVisible = signal(false);
  dialogType = signal<'alert' | 'confirm'>('alert');
  dialogMessage = signal('');
  dialogAction = signal<(() => void) | null>(null);

  // Panel de Emojis
  mostrarEmojis = signal(false);
  listaEmojis: string[] = ['😀','😂','😅','🤣','😊','😍','👍','🙏','🔥','🎉','🙌','❤️']; // Fallback inicial

  // Computed para contactos filtrados - AQUÍ está la lógica
  contactosFiltrados = computed(() => {
    const texto = this.textoBusqueda().toLowerCase();
    return texto.trim() === '' 
      ? this.chatManagement.contactos()
      : this.chatManagement.contactos().filter((c: ContactoChat) => 
          c.nombre.toLowerCase().includes(texto)
        );
  });

  // ===== ACCESO DIRECTO A SERVICIOS (Sin getters redundantes) =====
  // Usar directamente en templates: chatManagement.contacto() en lugar de getter

  @HostListener('document:keydown.escape')
  handleEscapeKey() {
    if (this.dialogVisible()) {
      this.dialogVisible.set(false);
      return;
    }
    if (this.chatManagement.mostrarModalNuevoChat()) {
      this.cerrarModalNuevoChat();
      return;
    }
    if (this.mostrarEmojis()) {
      this.mostrarEmojis.set(false);
      return;
    }
    if (this.menuReaccionActivo() !== null) {
      this.cerrarMenuReaccion();
      return;
    }
    if (this.menuMensajeActivo() !== null) {
      this.cerrarMenuMensaje();
      return;
    }
    if (this.chatManagement.mostrarInfoContacto()) {
      this.cerrarInfoContacto();
      return;
    }
    if (this.chatManagement.contactoActivo()) {
      this.cerrarChatActual();
      return;
    }
  }

  get miAvatarUrl(): string | null {
    const user = this.authService.getCurrentUser();
    let url = user?.foto_url || user?.fotoUrl;
    if (!url) return null;
    if (url.startsWith('http') || url.startsWith('data:image')) {
      return url;
    }
    if (url.startsWith('/')) {
      return `http://localhost:3005${url}`;
    }
    return `http://localhost:3005/${url}`;
  }

  get miIniciales(): string {
    const user = this.authService.getCurrentUser();
    return this.chatManagement.generarIniciales(user?.nombre || 'U');
  }

  ngOnInit() {
    try {
      this.jwtToken = this.authService.getToken() || '';
      
      // Función para arrancar el chat solo cuando tenemos el ID
      const inicializarChat = (userId: number) => {
        this.currentUserId = userId;
        console.log('🔍 INIT - ID de usuario cargado y verificado:', this.currentUserId);

        // Manejar parámetros de ruta DESPUÉS de tener el ID
        this.activatedRoute.queryParamMap.subscribe((params: any) => {
          this.pendingChatContactoId = Number(params.get('chatContactoId') || 0);
          this.pendingChatContactoNombre = params.get('chatContactoNombre') || '';

          if (this.pendingChatContactoId > 0) {
            console.log('Abrir chat directo desde Comunidad:', {
              id: this.pendingChatContactoId,
              nombre: this.pendingChatContactoNombre
            });
          }
        });

        if (!this.jwtToken) {
          console.warn('No hay token de sesión.');
        }

        // Conectar y configurar SOLO cuando tenemos ID seguro
        this.communicationService.connect(this.jwtToken).then(() => {
          this.setupWebsocketListeners();
          console.log('Solicitando canales para el usuario:', this.currentUserId);
          this.communicationService.getUserChannels({ usuarioId: this.currentUserId });
          this.cargarUsuariosSistema();
        this.cargarEmojis(); // Descargar Emojis de API Externa
        });
      };

      // Obtener ID con validación garantizada
      let userId = this.communicationService.getCurrentUserId();
      if (userId === 0) {
        const user = this.authService.getCurrentUser();
        if (user && user.id) {
          userId = Number(user.id);
          inicializarChat(userId);
        } else {
          // ⚠️ CRÍTICO: Si el usuario es asíncrono, esperamos su recuperación
          console.warn('⚠️ El ID de usuario es 0 en el arranque. Esperando recuperación de sesión...');
          // Si tu authService tiene un observable, descomenta e implementa:
          // this.authService.currentUser$.subscribe(user => {
          //   if (user && user.id) inicializarChat(Number(user.id));
          // });
          return;
        }
      } else {
        inicializarChat(userId);
      }
    } catch (error) {
      console.warn('Error inicializando:', error);
      this.cargarDatosFalsos();
    }
  }

  ngOnDestroy() {
    this.communicationService.disconnect();
    this.chatManagement.limpiar();
    this.onlineUsers.clear();
  }

  private setupWebsocketListeners() {
    const socket = this.communicationService.getSocket();
    if (!socket) {
      console.error('❌ Socket no disponible');
      return;
    }

    // Desvincular listeners anteriores para evitar ejecuciones duplicadas
    socket.off('userChannels');
    socket.off('channelCreated');
    socket.off('userOnline');
    socket.off('userOffline');
    socket.off('recentMessages');
    socket.off('newMessage');
    socket.off('messageEdited');
    socket.off('messageRead');
    socket.off('messagesRead');

    // ⚠️ IMPORTANTE: Re-adjuntar el listener global de CommunicationService
    // El socket.off('newMessage') anterior lo eliminó. Hay que restaurarlo para que
    // el contador global del sidebar siga funcionando mientras se está en esta pantalla.
    this.communicationService.reattachGlobalListeners();

    // Recibir lista de canales - CON VALIDACIÓN
    socket.on('userChannels', (data: unknown[]) => {
      try {
        if (!Array.isArray(data)) {
          console.warn('⚠️ userChannels: data no es un array', data);
          return;
        }
        console.log('✅ userChannels recibidos:', data.length, 'canales');
        this.chatManagement.actualizarContactos(data, this.currentUserId);

        // ⚠️ CRUCIAL: Unir al usuario a todas las "Salas" (Rooms) de sus chats para que 
        // el backend sepa a dónde enviarle los mensajes sin tener que presionar F5.
        this.chatManagement.contactos().forEach((c: ContactoChat) => {
          this.communicationService.joinChannel({ canalId: c.id, usuarioId: this.currentUserId });
        });

        // ELIMINADO: Ya no restauramos el último chat para evitar el "Chat Fantasma" al volver de otro módulo.
        // const contactoId = this.chatManagement.restaurarContactoActivoDesdeLocalStorage();
        // this.chatManagement.seleccionarPrimerContacto(); // <- ELIMINADO PARA EVITAR AUTO-SELECCIÓN

        this.tryOpenPendingChat();
        this.cdr.detectChanges();
      } catch (error) {
        console.error('❌ Error procesando userChannels:', error);
      }
    });

    // Evento cuando se crea un canal
    socket.on('channelCreated', (data: any) => {
      try {
        if (!data) {
          console.warn('⚠️ channelCreated: data vacío');
          return;
        }
        console.log("✅ channelCreated recibido");
        this.communicationService.getUserChannels({ usuarioId: this.currentUserId });
      } catch (error) {
        console.error('❌ Error procesando channelCreated:', error);
      }
    });

    // Usuarios en línea - CON VALIDACIÓN
    socket.on('userOnline', (data: any) => {
      try {
        const uid = data?.userId || data?.usuarioId;
        const userIdNum = Number(uid);
        if (!userIdNum) {
          console.warn('⚠️ userOnline: userId inválido', data);
          return;
        }
        console.log('✅ Usuario en línea:', userIdNum);
        this.onlineUsers.addOnlineUser(userIdNum);
        const nuevosContactos = this.onlineUsers.updateUserStatusInContactos(this.chatManagement.contactos(), userIdNum, true);
        this.chatManagement.contactos.set(nuevosContactos);
        this.cdr.detectChanges();
      } catch (error) {
        console.error('❌ Error procesando userOnline:', error);
      }
    });

    socket.on('userOffline', (data: any) => {
      try {
        const uid = data?.userId || data?.usuarioId;
        const userIdNum = Number(uid);
        if (!userIdNum) {
          console.warn('⚠️ userOffline: userId inválido', data);
          return;
        }
        console.log('💤 Usuario desconectado:', userIdNum);
        this.onlineUsers.removeOnlineUser(userIdNum);
        const nuevosContactos = this.onlineUsers.updateUserStatusInContactos(this.chatManagement.contactos(), userIdNum, false);
        this.chatManagement.contactos.set(nuevosContactos);
        this.cdr.detectChanges();
      } catch (error) {
        console.error('❌ Error procesando userOffline:', error);
      }
    });

    // Mensajes recientes - CON VALIDACIÓN
    socket.on('recentMessages', (data: RecentMessagesEvent) => {
      try {
        console.log("✅ recentMessages recibido");
        
        if (!this.chatManagement.contactoActivo()) {
          console.warn('⚠️ No hay contacto activo');
          return;
        }

        let messagesArray = Array.isArray(data) ? data : (data?.messages || []);
        const receivedCanalId = Array.isArray(data) ? null : data?.canalId;
        
        console.log("🔍 DEBUG: Primer mensaje recibido del backend:", messagesArray[0]);

        if (receivedCanalId && receivedCanalId !== this.chatManagement.contactoActivo()?.id) {
          console.warn(`⚠️ Mensajes para canal ${receivedCanalId}, pero el activo es ${this.chatManagement.contactoActivo()?.id}`);
          return;
        }

        localStorage.setItem(`messages_raw_${this.chatManagement.contactoActivo()?.id}`, JSON.stringify(messagesArray));
        
        const contacto = this.chatManagement.contactoActivo();
        if (contacto) {
          contacto.mensajes = messagesArray.map((msg: BaseMessageData) => 
            this.chatManagement.mapMessageToMensaje(msg, this.currentUserId, contacto.participantes)
          );
        }
        
        setTimeout(() => this.scrollToBottom(), 50); // Hacemos scroll al cargar historial
        this.cdr.detectChanges();
      } catch (error) {
        console.error('❌ Error procesando recentMessages:', error);
      }
    });

    // Nuevo mensaje - CON VALIDACIÓN
    socket.on('newMessage', (data: NewMessageEvent) => {
      try {
        console.log("✅ newMessage recibido del backend:", data);
        
        if (!data?.canalId) {
          console.warn('⚠️ newMessage: canalId faltante', data);
          return;
        }

        const canal = this.chatManagement.contactos().find((c: ContactoChat) => c.id === data.canalId);
        
        if (!canal) {
          console.warn('⚠️ Canal no encontrado en lista local:', data.canalId, '- Contador global activo.');
          return;
        }

        // Ya NO limpiamos el contador global aquí, a menos que el chat sea el activo actual.
        // El global listener ya agregó +1. El sidebar lo necesita si el usuario sale de la pantalla.

        const nuevoMsg = this.chatManagement.mapMessageToMensaje(data, this.currentUserId, canal.participantes);
        
        console.log('📍 NUEVO MENSAJE MAPEADO:', {
          enviadoPorMi: nuevoMsg.enviadoPorMi,
          texto: nuevoMsg.texto,
          canal: canal.nombre,
          currentUserId: this.currentUserId,
          backendData: data
        });
        
        if (!this.chatManagement.esMensajeDuplicado(canal.mensajes, nuevoMsg)) {
          // Actualizamos de forma inmutable para garantizar que Angular detecte el cambio en OnPush
          canal.mensajes = [...canal.mensajes, nuevoMsg];
          this.chatManagement.guardarMensajesLocalStorage(canal.id, data);
          
          // SINCRONIZAR ARRAY PRINCIPAL
          const nuevosContactos = this.chatManagement.contactos().map(c => 
            c.id === canal.id ? {...canal} as ContactoChat : c
          );
          this.chatManagement.contactos.set(nuevosContactos);
          
          console.log('✅ MENSAJE AGREGADO AL HISTORIAL');
        } else {
          console.log('🔄 MENSAJE DUPLICADO - NO AGREGADO. Actualizando ID real.');
          // Buscar el mensaje temporal enviado localmente para actualizar su ID con el del servidor
          const msgLocal = canal.mensajes.find((m: any) => 
            m.texto === nuevoMsg.texto && m.enviadoPorMi === true && (m.id > 1000000000000 || typeof m.id === 'string')
          );
          if (msgLocal && data.id) {
            (msgLocal as any).id = data.id; // Asignar el ID real de la base de datos
            console.log('✅ ID DE MENSAJE LOCAL ACTUALIZADO A:', data.id);
          }
        }

        if (this.chatManagement.contactoActivo()?.id === canal.id) {
          // Si el chat está activo, el usuario lo está leyendo. Limpiar global map para este canal.
          const mapaGlobal = new Map(this.communicationService.mensajesSinLeerGlobal());
          mapaGlobal.delete(canal.id);
          this.communicationService.mensajesSinLeerGlobal.set(mapaGlobal);

          // FORZAR ACTUALIZACIÓN REACTIVA Y SUBIR AL TOPE
          const canalActualizado = {...canal} as ContactoChat;
          this.chatManagement.contactoActivo.set(canalActualizado);
          // Subir al tope también cuando es el chat abierto
          const listaActual = this.chatManagement.contactos();
          const reordenados = [
            canalActualizado,
            ...listaActual.filter(c => c.id !== canalActualizado.id)
          ];
          this.chatManagement.contactos.set(reordenados);
          
          this.communicationService.readMessage({ 
            canalId: canal.id, 
            mensajeId: data.id || 0, 
            usuarioId: this.currentUserId 
          });
          setTimeout(() => this.scrollToBottom(), 50); // Hacemos scroll si llega mensaje en nuestro chat actual
        } else {
          // Incrementar el badge del sidebar para este canal (ya sube al tope internamente)
          this.chatManagement.incrementarMensajesSinLeer(canal.id);
        }
        this.cdr.detectChanges();
      } catch (error) {
        console.error('❌ Error procesando newMessage:', error);
      }
    });

    // Evento de mensaje editado
    socket.on('messageEdited', (data: any) => {
      try {
        console.log("✅ messageEdited recibido:", data);
        const canal = this.chatManagement.contactos().find((c: ContactoChat) => c.id === data.canalId);
        if (canal && data.mensajeId) {
          const msj = canal.mensajes.find((m: any) => m.id === data.mensajeId);
          if (msj) {
            msj.texto = data.contenido;
            (msj as any).editado = true;
            
            // Forzar reactividad para Angular OnPush
            if (this.chatManagement.contactoActivo()?.id === canal.id) {
              this.chatManagement.contactoActivo.set({...canal} as ContactoChat);
            }
            this.cdr.detectChanges();
          }
        }
      } catch (error) {
        console.error('❌ Error procesando messageEdited:', error);
      }
    });

    // Evento de mensaje eliminado para todos
    socket.on('messageDeleted', (data: any) => {
      try {
        console.log("🚫 messageDeleted recibido:", data);
        const canal = this.chatManagement.contactos().find((c: ContactoChat) => c.id === data.canalId);
        if (canal && data.mensajeId) {
          const msj = canal.mensajes.find((m: any) => m.id === data.mensajeId);
          if (msj) {
            msj.texto = '🚫 Este mensaje fue eliminado';
            (msj as any).eliminado = true;
            
            // Forzar reactividad
            if (this.chatManagement.contactoActivo()?.id === canal.id) {
              this.chatManagement.contactoActivo.set({...canal} as ContactoChat);
            }
            this.cdr.detectChanges();
          }
        }
      } catch (error) {
        console.error('❌ Error procesando messageDeleted:', error);
      }
    });

    // Eventos de lectura de mensajes (Pintar palomitas de azul en tiempo real)
    socket.on('messageRead', (data: any) => {
      try {
        const canal = this.chatManagement.contactos().find((c: ContactoChat) => c.id === data.canalId);
        if (canal) {
          if (data.mensajeId) {
            canal.mensajes = canal.mensajes.map((m: any) => 
              m.id === data.mensajeId ? { ...m, leido: true } : m
            );
          } else {
            canal.mensajes = canal.mensajes.map((m: any) => ({ ...m, leido: true }));
          }
          
          // Si el canal actualizado es el activo, forzar actualización
          if (this.chatManagement.contactoActivo()?.id === canal.id) {
            this.chatManagement.contactoActivo.set({...canal} as ContactoChat);
          }
          
          this.cdr.detectChanges();
        }
      } catch (error) {}
    });

    socket.on('messagesRead', (data: any) => {
      try {
        const canal = this.chatManagement.contactos().find((c: ContactoChat) => c.id === data.canalId);
        if (canal) {
          canal.mensajes = canal.mensajes.map((m: any) => ({ ...m, leido: true }));
          
          if (this.chatManagement.contactoActivo()?.id === canal.id) {
            this.chatManagement.contactoActivo.set({...canal} as ContactoChat);
          }

          this.cdr.detectChanges();
        }
      } catch (error) {}
    });

    // Evento de reacción a mensaje
    socket.on('messageReacted', (data: any) => {
      try {
        console.log("👍 messageReacted recibido:", data);
        
        let canalConMensaje: ContactoChat | undefined;
        let msjEncontrado: any;

        if (data.canalId) {
          canalConMensaje = this.chatManagement.contactos().find((c: ContactoChat) => c.id === data.canalId);
          if (canalConMensaje) msjEncontrado = canalConMensaje.mensajes.find((m: any) => m.id === data.mensajeId);
        } else {
          // Si el backend omite el canalId, buscamos en todos los canales cargados
          for (const c of this.chatManagement.contactos()) {
            const m = c.mensajes.find((m: any) => m.id === data.mensajeId);
            if (m) {
              canalConMensaje = c;
              msjEncontrado = m;
              break;
            }
          }
        }

        if (canalConMensaje && msjEncontrado) {
          if (!msjEncontrado.reacciones) msjEncontrado.reacciones = [];
          
          const existing = msjEncontrado.reacciones.find((r: any) => r.emoji === data.emoji);
          if (existing) {
            existing.count = data.count; // Actualizar con el count del servidor
          } else if (data.count > 0) {
            msjEncontrado.reacciones.push({ emoji: data.emoji, count: data.count });
          }
          
          // Eliminar reacciones con conteo 0
          msjEncontrado.reacciones = msjEncontrado.reacciones.filter((r: any) => r.count > 0);
          
          // Forzar reactividad si estamos en el canal activo
          if (this.chatManagement.contactoActivo()?.id === canalConMensaje.id) {
            this.chatManagement.contactoActivo.set({...canalConMensaje} as ContactoChat);
            this.cdr.detectChanges();
          }
        }
      } catch (error) {
        console.error('❌ Error procesando messageReacted:', error);
      }
    });

  }

  private async tryOpenPendingChat() {
    if (!this.pendingChatContactoId || this.currentUserId <= 0) return;

    const existingChat = this.chatManagement.buscarContactoConParticipante(
      this.chatManagement.contactos(),
      this.pendingChatContactoId
    );

    if (existingChat) {
      this.chatManagement.seleccionarContacto(existingChat);
      this.clearPendingChat();
      return;
    }

    // Crear nuevo canal
    if (this.communicationService.getSocket()) {
      try {
        console.log('🚀 Creando canal directo desde comunidad...');
        
        const nuevoCanal = await this.communicationService.createChannel({
          nombre: this.pendingChatContactoNombre || 'Chat directo',
          descripcion: 'Chat directo desde Comunidad',
          creadorId: this.currentUserId,
          participanteIds: [this.currentUserId, this.pendingChatContactoId],
          esGrupo: false
        });

        console.log('✅ Canal creado/recuperado:', nuevoCanal);
        
        // Mapear el canal devuelto para seleccionarlo de inmediato
        const contactoMapeado = this.chatManagement.mapChannelToContacto(nuevoCanal, this.currentUserId);
        
        // Actualizamos información de la otra persona
        if (contactoMapeado.participantes) {
           const otro = contactoMapeado.participantes.find((p: any) => Number(p.usuarioId) !== this.currentUserId);
           if (otro) {
              contactoMapeado.nombre = otro.nombre || this.pendingChatContactoNombre || 'Usuario';
              contactoMapeado.iniciales = this.chatManagement.generarIniciales(contactoMapeado.nombre);
              if (otro.avatar) {
                let url = otro.avatar;
                if (url && !url.startsWith('http') && !url.startsWith('data:image')) {
                  url = url.startsWith('/') ? `http://localhost:3005${url}` : `http://localhost:3005/${url}`;
                }
                (contactoMapeado as any).avatarUrl = url;
              }
           }
        }

        this.chatManagement.seleccionarContacto(contactoMapeado);
        
      } catch (error) {
        console.warn('❌ Error creando canal:', error);
      } finally {
        this.clearPendingChat();
        this.cdr.detectChanges();
      }
    }
  }

  private clearPendingChat() {
    this.pendingChatContactoId = 0;
    this.pendingChatContactoNombre = '';
  }

  // Método para hacer Scroll Automático al último mensaje
  private scrollToBottom(): void {
    try {
      if (this.messagesContainer) {
        this.messagesContainer.nativeElement.scrollTop = this.messagesContainer.nativeElement.scrollHeight;
      }
    } catch (err) { }
  }

  private cargarEmojis(): void {
    // Descargar un paquete JSON público con la lista oficial de emojis desde un CDN
    fetch('https://unpkg.com/emoji.json@13.1.0/emoji.json')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          this.listaEmojis = data.slice(0, 350).map((e: any) => e.char); // Tomamos los primeros 350 para no saturar la RAM
          this.cdr.detectChanges();
        }
      })
      .catch(err => console.warn('Error cargando emojis externos:', err));
  }

  // ===== Chat Methods =====
  
  seleccionarContacto(contacto: ContactoChat) {
    this.chatManagement.seleccionarContacto(contacto);
    this.chatManagement.nuevoMensaje.set(''); // Limpiar texto al cambiar de chat
    this.mostrarEmojis.set(false); // Cerrar panel de emojis si estaba abierto
    this.cancelarEdicion(); // Limpiar el estado de edición
    this.communicationService.getRecentMessages({ canalId: contacto.id, limit: 50 });
    
    // MARCAR TODOS LOS MENSAJES COMO LEÍDOS AL ENTRAR AL CHAT
    this.communicationService.readMessage({ 
      canalId: contacto.id, 
      mensajeId: 0, 
      usuarioId: this.currentUserId 
    });

    setTimeout(() => this.scrollToBottom(), 50);
    this.cdr.detectChanges();
  }

  verInfoContacto(): void {
    this.chatManagement.mostrarInfoContacto.set(true);
  }

  cerrarChatActual(): void {
    this.chatManagement.cerrarChat();
    this.chatManagement.nuevoMensaje.set('');
    this.mostrarEmojis.set(false);
    this.cancelarEdicion();
    this.cdr.detectChanges();
  }

  cerrarInfoContacto(): void {
    this.chatManagement.mostrarInfoContacto.set(false);
  }

  async enviarMensaje(): Promise<void> {
    const mensaje = this.chatManagement.nuevoMensaje().trim();
    const canalActivo = this.chatManagement.contactoActivo();
    if (!mensaje || !canalActivo) return;

    // --- FLUJO DE EDICIÓN ---
    const msjEditando = this.mensajeEnEdicion();
    if (msjEditando) {
      console.log('✏️ Guardando edición:', mensaje);
      this.communicationService.editMessage({
        canalId: canalActivo.id,
        mensajeId: msjEditando.id,
        remitenteId: this.currentUserId,
        contenido: mensaje
      });
      
      // Optimistic update
      msjEditando.texto = mensaje;
      msjEditando.editado = true;
      
      this.cancelarEdicion();
      this.cdr.detectChanges();
      return;
    }

    // --- FLUJO NORMAL (NUEVO MENSAJE) ---

    // ✅ OPTIMISTIC UPDATE: Mostrar el mensaje localmente de inmediato
    const tempId = Date.now(); // ID temporal hasta que recargue
    const now = new Date();
    const horaFormateada = now.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', hour12: true });
    const fechaISO = now.toISOString();
    const nuevoMsg: any = {
      id: tempId,
      texto: mensaje,
      hora: horaFormateada,
      fechaISO: fechaISO,
      timestampReal: fechaISO,
      enviadoPorMi: true,
      tipo: 'text',
      archivoUrl: undefined,
      leido: false,
      editado: false
    };

    // Agregar a la UI localmente
    canalActivo.mensajes = [...canalActivo.mensajes, nuevoMsg];
    
    // FORZAR ACTUALIZACIÓN REACTIVA Y SUBIR AL TOPE (estilo WhatsApp)
    const canalCopia = {...canalActivo} as ContactoChat;
    const listaActual = this.chatManagement.contactos();
    const nuevosContactos = [
      canalCopia,
      ...listaActual.filter(c => c.id !== canalCopia.id)
    ];
    this.chatManagement.contactos.set(nuevosContactos);
    this.chatManagement.contactoActivo.set(canalCopia);
    
    this.chatManagement.nuevoMensaje.set('');
    this.cdr.detectChanges();
    setTimeout(() => this.scrollToBottom(), 50);

    console.log('📤 Enviando mensaje:', mensaje);
    
    // Emitir sin esperar respuesta (fire-and-forget)
    this.communicationService.sendMessage({
      canalId: canalActivo.id,
      remitenteId: this.currentUserId,
      contenido: mensaje,
      tipo: 'text',
      archivoUrl: null
    });
  }

  // ===== Helper Methods =====

  iniciarEdicion(msj: any): void {
    if (msj.tipo !== 'text') return; // Evitar editar imágenes o archivos
    this.mensajeEnEdicion.set(msj);
    this.chatManagement.nuevoMensaje.set(msj.texto);
  }

  cancelarEdicion(): void {
    this.mensajeEnEdicion.set(null);
    this.chatManagement.nuevoMensaje.set('');
  }

  // ===== Menú de Mensajes =====

  esAdminActual(): boolean {
    const canalActivo = this.chatManagement.contactoActivo();
    if (!canalActivo || !canalActivo.esGrupo) return false;
    const yo = canalActivo.participantes?.find((p: any) => 
      Number(p.id) === this.currentUserId || Number(p.usuarioId) === this.currentUserId
    );
    return yo ? !!yo.esAdmin : false;
  }

  toggleMenuMensaje(msjId: string | number): void {
    if (this.menuMensajeActivo() === msjId) {
      this.menuMensajeActivo.set(null);
    } else {
      this.menuMensajeActivo.set(msjId);
    }
  }

  cerrarMenuMensaje(): void {
    this.menuMensajeActivo.set(null);
  }

  toggleMenuReaccion(msjId: string | number): void {
    this.menuMensajeActivo.set(null); // cerrar el otro menu si estaba abierto
    this.menuReaccionActivo.set(this.menuReaccionActivo() === msjId ? null : msjId);
  }

  cerrarMenuReaccion(): void {
    this.menuReaccionActivo.set(null);
  }

  reaccionar(msj: any, emoji: string): void {
    const canalActivo = this.chatManagement.contactoActivo();
    if (!canalActivo) return;

    // Emitir al backend inmediatamente (el backend es la fuente de la verdad para el toggle)
    this.communicationService.getSocket()?.emit('reactToMessage', {
      mensajeId: msj.id,
      canalId: canalActivo.id,
      usuarioId: this.currentUserId,
      emoji
    });

    this.cerrarMenuReaccion();
  }

  eliminarParaMi(msj: any): void {
    this.pedirConfirmacion('¿Seguro que deseas eliminar este mensaje solo para ti?', () => {
      // Ocultar localmente
      const canalActivo = this.chatManagement.contactoActivo();
      if (canalActivo) {
        canalActivo.mensajes = canalActivo.mensajes.filter((m: any) => m.id !== msj.id);
        this.chatManagement.contactoActivo.set({...canalActivo} as ContactoChat);
        this.cdr.detectChanges();
        
        // Emitir al backend
        this.communicationService.getSocket()?.emit('deleteMessageForMe', { 
          mensajeId: msj.id,
          canalId: canalActivo.id,
          usuarioId: this.currentUserId
        });
      }
    });
    this.cerrarMenuMensaje();
  }

  eliminarParaTodos(msj: any): void {
    if (!msj.enviadoPorMi && !this.esAdminActual()) return;
    this.pedirConfirmacion('¿Seguro que deseas eliminar este mensaje para todos?', () => {
      const canalActivo = this.chatManagement.contactoActivo();
      if (canalActivo) {
        // Optimistic update
        msj.texto = '🚫 Este mensaje fue eliminado';
        msj.eliminado = true;
        this.chatManagement.contactoActivo.set({...canalActivo} as ContactoChat);
        this.cdr.detectChanges();
        
        // Emitir al backend
        this.communicationService.getSocket()?.emit('deleteMessageForAll', { 
          mensajeId: msj.id,
          canalId: canalActivo.id,
          usuarioId: this.currentUserId
        });
      }
    });
    this.cerrarMenuMensaje();
  }

  private cargarDatosFalsos(): void {
    console.log('Cargando datos falsos');
  }

  mostrarAlerta(mensaje: string): void {
    this.dialogType.set('alert');
    this.dialogMessage.set(mensaje);
    this.dialogVisible.set(true);
  }

  pedirConfirmacion(mensaje: string, accion: () => void): void {
    this.dialogType.set('confirm');
    this.dialogMessage.set(mensaje);
    this.dialogAction.set(accion);
    this.dialogVisible.set(true);
  }

  cerrarDialogo(): void {
    this.dialogVisible.set(false);
    this.dialogAction.set(null);
  }

  ejecutarDialogo(): void {
    if (this.dialogType() === 'confirm') {
      const accion = this.dialogAction();
      if (accion) accion();
    }
    this.cerrarDialogo();
  }

  async onFileSelected(event: any): Promise<void> {
    const fileInput = event.target;
    const file = fileInput.files[0];
    const canal = this.chatManagement.contactoActivo();
    
    if (!file || !canal) {
      if (fileInput) fileInput.value = '';
      return;
    }
    
    console.log('Subiendo archivo al servidor:', file.name);
    this.subiendoArchivo.set(true); // <--- INDICAMOS QUE INICIA LA SUBIDA
    
    try {
      // Identificar si es imagen o archivo
      const isImage = file.type.startsWith('image/');
      const tipoStr = isImage ? 'image' : 'file';
      const placeholderMsg = isImage ? '📷 Imagen adjunta' : `📄 Archivo: ${file.name}`;

      // Consumir el endpoint de subida (REST) para soportar archivos grandes sin tumbar el Socket
      const response = await this.communicationService.uploadFile(canal.id, file);
      const urlFina = response?.url || response?.archivoUrl || response?.fileUrl || response?.path || response?.data?.url || response?.data?.path;
      
      if (!urlFina) throw new Error('El servidor no devolvió una URL válida');

      // Mostrar de inmediato en el chat
      const horaFormateada = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const nuevoMsg: any = { // <-- Se usa 'any' para satisfacer TypeScript
        texto: placeholderMsg,
        hora: horaFormateada,
        timestampReal: new Date().toISOString(),
        enviadoPorMi: true,
        tipo: tipoStr,
        archivoUrl: urlFina,
        leido: false
      };
      canal.mensajes = [...canal.mensajes, nuevoMsg];
      this.cdr.detectChanges();
      setTimeout(() => this.scrollToBottom(), 50);

      // Enviar por socket al destinatario instantáneamente
      this.communicationService.sendMessage({
        canalId: canal.id,
        remitenteId: this.currentUserId,
        contenido: placeholderMsg,
        tipo: tipoStr,
        archivoUrl: urlFina
      });
    } catch (error: any) {
      console.error('Error al procesar el archivo:', error);
      this.mostrarAlerta(`No se pudo adjuntar el archivo. Asegúrate de que el servidor lo permite.`);
    } finally {
      this.subiendoArchivo.set(false); // <--- OCULTAMOS EL INDICADOR SIN IMPORTAR SI FALLA O ES EXITOSO
      
      // Limpiar el input oculto para permitir volver a adjuntar el mismo archivo u otro nuevo
      if (fileInput) fileInput.value = '';
    }
  }

  abrirModalNuevoChat(): void {
    this.esModoAgregarMiembro.set(false);
    this.esModoEditarGrupo.set(false);
    this.nombreGrupoNuevo.set('');
    this.fotoGrupoBase64.set(null);
    this.chatManagement.mostrarModalNuevoChat.set(true);
  }

  cerrarModalNuevoChat(): void {
    this.chatManagement.mostrarModalNuevoChat.set(false);
    this.esModoAgregarMiembro.set(false);
    this.esModoEditarGrupo.set(false);
    this.nombreGrupoNuevo.set('');
    this.fotoGrupoBase64.set(null); // Limpiar foto al cerrar
  }

  abrirModalAgregarMiembro(): void {
    this.esModoAgregarMiembro.set(true);
    this.esModoGrupo.set(false);
    this.chatManagement.mostrarModalNuevoChat.set(true);
  }

  abrirModalEditarGrupo(): void {
    const canal = this.chatManagement.contactoActivo();
    if (!canal || !canal.esGrupo) return;

    this.esModoGrupo.set(true);
    this.esModoAgregarMiembro.set(false);
    this.esModoEditarGrupo.set(true);
    this.nombreGrupoNuevo.set(canal.nombre);
    this.fotoGrupoBase64.set((canal as any).avatarUrl || null);
    this.chatManagement.mostrarModalNuevoChat.set(true);
  }

  async guardarEdicionGrupo(): Promise<void> {
    const canal = this.chatManagement.contactoActivo();
    if (!canal) return;

    const nombre = this.nombreGrupoNuevo().trim();
    if (!nombre) {
      this.mostrarAlerta('El nombre del grupo no puede estar vacío.');
      return;
    }

    try {
      await this.communicationService.updateChannelRest(canal.id, {
        nombre: nombre,
        avatarUrl: this.fotoGrupoBase64()
      });

      // Actualización visual inmediata (Optimistic UI)
      canal.nombre = nombre;
      if (this.fotoGrupoBase64() !== null) {
        (canal as any).avatarUrl = this.fotoGrupoBase64() as string;
      }

      this.cerrarModalNuevoChat();
      this.cdr.detectChanges();
      this.mostrarAlerta('Grupo actualizado correctamente.');
    } catch (err: any) {
      console.error('Error editando grupo:', err);
      this.mostrarAlerta('No se pudo actualizar el grupo. Revisa tu conexión.');
    }
  }

  eliminarMiembro(event: any): void {
    const canal = this.chatManagement.contactoActivo();
    if (!canal || !canal.id) return;
    
    // 💡 El componente hijo emite un objeto { canalId, usuarioId, actorId }. 
    // Extraemos el usuarioId real para poder procesarlo como número.
    const targetUserId = event?.usuarioId !== undefined ? event.usuarioId : event;
    const idNum = Number(targetUserId);

    this.pedirConfirmacion('¿Estás seguro de que deseas eliminar a este participante del grupo?', () => {
      this.communicationService.removeParticipant({
        canalId: canal.id,
        usuarioId: idNum,
        actorId: this.currentUserId
      });
      
      // ✅ Solución al error: canal.participantes es posiblemente undefined
      canal.participantes = (canal.participantes || []).filter((p: any) => Number(p.id) !== idNum && Number(p.usuarioId) !== idNum);
      this.cdr.detectChanges();
    });
  }

  hacerAdministrador(event: any): void {
    const canal = this.chatManagement.contactoActivo();
    if (!canal || !canal.id) return;
    
    const targetUserId = event?.usuarioId !== undefined ? event.usuarioId : event;
    const idNum = Number(targetUserId);

    this.pedirConfirmacion('¿Estás seguro de que deseas promover a este participante como administrador?', () => {
      this.communicationService.makeAdmin({
        canalId: canal.id,
        usuarioId: idNum,
        actorId: this.currentUserId
      });
      
      // Optimistic UI: Mostrar de inmediato que es admin
      const participante = canal.participantes?.find((p: any) => Number(p.id) === idNum || Number(p.usuarioId) === idNum);
      if (participante) {
        participante.esAdmin = true;
        this.cdr.detectChanges();
      }
    });
  }

  quitarAdministrador(event: any): void {
    const canal = this.chatManagement.contactoActivo();
    if (!canal || !canal.id) return;
    
    const targetUserId = event?.usuarioId !== undefined ? event.usuarioId : event;
    const idNum = Number(targetUserId);

    this.pedirConfirmacion('¿Estás seguro de que deseas quitar los privilegios de administrador a este participante?', () => {
      this.communicationService.removeAdmin({
        canalId: canal.id,
        usuarioId: idNum,
        actorId: this.currentUserId
      });
      
      // Optimistic UI: Quitar corona de inmediato
      const participante = canal.participantes?.find((p: any) => Number(p.id) === idNum || Number(p.usuarioId) === idNum);
      if (participante) {
        participante.esAdmin = false;
        this.cdr.detectChanges();
      }
    });
  }

  toggleEmojiPicker(): void {
    this.mostrarEmojis.set(!this.mostrarEmojis());
  }

  agregarEmojiSeleccionado(emoji: string): void {
    const currentTexto = this.chatManagement.nuevoMensaje();
    this.chatManagement.nuevoMensaje.set(currentTexto + emoji);
  }

  eliminarChat(contacto: ContactoChat): void {
    if (!contacto || !contacto.id || Number(contacto.id) < 1) {
      console.error('❌ ERROR: contacto.id inválido:', contacto);
      this.mostrarAlerta('Error: No se puede eliminar este chat. ID inválido.');
      return;
    }

    const accion = contacto.esGrupo ? 'abandonar este grupo' : 'eliminar este chat';

    this.pedirConfirmacion(`¿Estás seguro de que deseas ${accion}?`, () => {
      const canalId = Number(contacto.id);
      console.log('📤 Eliminando/Abandonando canal:', canalId);
      
      if (contacto.esGrupo) {
        // Para grupos, abandonamos el canal
        this.communicationService.leaveChannel({
          canalId: canalId,
          usuarioId: this.currentUserId
        });
      } else {
        // Para chats directos, forzamos la eliminación en el backend por REST
        this.communicationService.deleteChannelRest(canalId).catch((err: any) => {
          console.error('Error al eliminar chat directo por REST, intentando por socket...', err);
          this.communicationService.deleteChannelEmit({ canalId, usuarioId: this.currentUserId });
        });
      }
      
      // ✅ IMPORTANTE: Actualizar UI INMEDIATAMENTE sin esperar al backend
      const contactosActuales = this.chatManagement.contactos();
      const contactosFiltrados = contactosActuales.filter((c: ContactoChat) => Number(c.id) !== canalId);
      this.chatManagement.contactos.set(contactosFiltrados);
      
      // Si era el contacto activo, desseleccionar y limpiar caché
      if (this.chatManagement.contactoActivo() && Number(this.chatManagement.contactoActivo()?.id) === canalId) {
        this.chatManagement.contactoActivo.set(undefined);
        localStorage.removeItem('activeChannelId'); // Evita que se restaure el fantasma
        this.chatManagement.mostrarInfoContacto.set(false);
      }
      
      console.log('✅ Chat eliminado de la UI (enviando sincronización al backend...)');
      this.cdr.detectChanges();
    });
  }

  private cargarUsuariosSistema(): void {
    forkJoin({
      mismaArea: this.comunidadService.getContactosAccesibles().pipe(catchError(() => of([]))),
      otrasAreas: this.comunidadService.buscarUsuariosOtraArea('').pipe(catchError(() => of([])))
    }).subscribe({
      next: ({ mismaArea, otrasAreas }) => {
        this.procesarUsuariosParaBuscador(mismaArea, otrasAreas);
      },
      error: (err: any) => console.error('❌ Error cargando usuarios del sistema:', err)
    });
  }

  private procesarUsuariosParaBuscador(mismaArea: any, otrasAreas: any): void {
    // Extracción segura del arreglo de usuarios dependiendo del formato que devuelva el backend
    const arrMismaArea = Array.isArray(mismaArea) ? mismaArea : (mismaArea?.data || mismaArea?.users || []);
    const arrOtrasAreas = Array.isArray(otrasAreas) ? otrasAreas : (otrasAreas?.data || otrasAreas?.users || []);

    const todosLosUsuarios = [...arrMismaArea, ...arrOtrasAreas];
    const usuariosUnicos = Array.from(new Map(todosLosUsuarios.map(u => [u.email, u])).values());

    const usuariosMapeados = usuariosUnicos.map((u: any) => ({
      id: Number(u.id),
      nombre_completo: u.nombreCompleto || u.nombre || '',
      apellido: u.apellidoCompleto || '',
      email: u.email || '',
      rol: u.rolNombre || u.rol || u.puesto || ''
    }));

    this.usuariosSistema = usuariosMapeados.filter(u => Number(u.id) !== this.currentUserId);
    this.usuariosBuscados = [...this.usuariosSistema];
    this.cdr.detectChanges();
  }

  filtrarUsuarios(): void {
    const texto = this.buscarUsuario.toLowerCase();
    
    // Filtramos primero a los que ya son miembros del grupo actual si estamos agregando/editando
    let usuariosDisponibles = this.usuariosSistema;
    if (this.esModoAgregarMiembro() || this.esModoEditarGrupo()) {
      const participantesIds = this.chatManagement.contactoActivo()?.participantes?.map((p: any) => {
        return Number(p.usuarioId) || Number(p.usuario?.id) || Number(p.id);
      }) || [];
      
      usuariosDisponibles = usuariosDisponibles.filter(u => !participantesIds.includes(Number(u.id)));
    }

    if (texto.trim() === '') {
      this.usuariosBuscados = usuariosDisponibles;
    } else {
      this.usuariosBuscados = usuariosDisponibles.filter((u: any) => {
        const nombreCompleto = (u.nombre_completo || '').toLowerCase();
        const nombre = (u.nombre || '').toLowerCase();
        const apellido = (u.apellido_completo || u.apellido || '').toLowerCase();
        const email = (u.email || '').toLowerCase();
        
        return nombreCompleto.includes(texto) || 
               nombre.includes(texto) || 
               apellido.includes(texto) ||
               email.includes(texto);
      });
    }
    this.cdr.detectChanges();
  }

  private comprimirImagen(file: File, maxWidth: number, maxHeight: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event: any) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > maxWidth) { height = Math.round((height * maxWidth) / width); width = maxWidth; }
          } else {
            if (height > maxHeight) { width = Math.round((width * maxHeight) / height); height = maxHeight; }
          }
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.7)); // Retorna Base64 ligero en JPEG
        };
        img.onerror = (err) => reject(err);
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async onFotoGrupoSelected(event: any): Promise<void> {
    const file = event.target.files[0];
    if (file) {
      try {
        const base64 = await this.comprimirImagen(file, 250, 250);
        this.fotoGrupoBase64.set(base64);
      } catch(e) {
        console.error('Error comprimiendo la foto', e);
      }
    }
    // Limpiar input para permitir seleccionar la misma foto si se elimina temporalmente
    event.target.value = '';
  }

  iniciarChatConUsuario(user: any): void {
    const userId = Number(user.id);

    // --- MODO AÑADIR A GRUPO EXISTENTE ---
    if (this.esModoAgregarMiembro()) {
      const canal = this.chatManagement.contactoActivo();
      if (!canal) return;
      
      // ✅ Solución al error: canal.participantes es posiblemente undefined
      if (canal.participantes?.some((p:any) => Number(p.id) === userId || Number(p.usuarioId) === userId)) {
        this.mostrarAlerta('Este usuario ya es miembro del grupo.');
        return;
      }

      this.pedirConfirmacion(`¿Añadir a ${user.nombre_completo || user.nombre} al grupo?`, () => {
        this.communicationService.addParticipant({
          canalId: canal.id,
          usuarioId: userId,
          actorId: this.currentUserId
        });
        
        if (!canal.participantes) canal.participantes = [];
        canal.participantes.push({
          id: userId,
          usuarioId: userId,
          nombre: user.nombre_completo || user.nombre,
          rol: user.rol?.nombre || user.rol || 'Usuario'
        });
        
        this.cerrarModalNuevoChat();
        this.cdr.detectChanges();
      });
      return;
    }

    // FIX: Se deben usar paréntesis para evaluar el Signal
    if (!this.esModoGrupo()) {
      // Chat directo
      this.pendingChatContactoId = userId;
      this.pendingChatContactoNombre = user.nombre_completo || user.nombre || 'Usuario';
      this.tryOpenPendingChat();
      this.cerrarModalNuevoChat(); // Cerrar modal al iniciar
    } else {
      // Agregar a grupo
      if (this.usuariosSeleccionadosGrupo.has(userId)) {
        this.usuariosSeleccionadosGrupo.delete(userId); // Permitir deseleccionar
      } else {
        this.usuariosSeleccionadosGrupo.add(userId);
      }
    }
    this.cdr.detectChanges();
  }

  isUsuarioSeleccionado(userId: any): boolean {
    return this.usuariosSeleccionadosGrupo.has(Number(userId));
  }

  crearGrupo(): void {
    const nombre = this.nombreGrupoNuevo().trim();
    if (!nombre || this.usuariosSeleccionadosGrupo.size === 0) {
      this.mostrarAlerta('Por favor ingresa un nombre para el grupo y selecciona al menos un usuario.');
      return;
    }

    const participantes = Array.from(this.usuariosSeleccionadosGrupo);
    participantes.push(this.currentUserId);

    // ✅ VALIDATION: Asegurar que los IDs son números válidos
    const participantesValidos = participantes.filter(id => id && Number(id) > 0).map(id => Number(id));
    if (participantesValidos.length < 2) {
      console.error('❌ ERROR: Participantes inválidos', participantes);
      this.mostrarAlerta('Error: IDs de participantes inválidos');
      return;
    }

    console.log('📤 Creando grupo:', nombre, 'con', participantesValidos.length, 'participantes:', participantesValidos);
    
    // ✅ FIRE-AND-FORGET: No esperar respuesta
    this.communicationService.createChannel({
      nombre,
      descripcion: 'Grupo creado desde comunicaciones',
      creadorId: this.currentUserId,
      participanteIds: participantesValidos,
      esGrupo: true,
      avatarUrl: this.fotoGrupoBase64() // Mandamos la imagen en base64
    });

    // Actualizar UI localmente
    this.nombreGrupoNuevo.set('');
    this.usuariosSeleccionadosGrupo.clear();
    this.esModoGrupo.set(false);
    this.fotoGrupoBase64.set(null);
    this.cerrarModalNuevoChat();
    
    console.log('✅ Grupo creado. Sincronizando con backend...');
    
    // Solicitar actualización de canales
    this.communicationService.getUserChannels({ usuarioId: this.currentUserId });
    this.cdr.detectChanges();
  }
}
