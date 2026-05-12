import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-channel-info',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './channel-info.component.html',
  styleUrls: ['./channel-info.component.scss']
})
export class ChannelInfoComponent implements OnChanges {
  @Input() channelInfo: any = null;
  @Input() currentUserId: number = 0;

  displayProfile: any = null;
  
  @Output() addParticipant = new EventEmitter<any>();
  @Output() removeParticipant = new EventEmitter<any>();
  @Output() leaveChannel = new EventEmitter<any>();
  @Output() closeInfoPanel = new EventEmitter<void>();
  @Output() makeAdmin = new EventEmitter<any>();
  @Output() removeAdmin = new EventEmitter<any>();

  ngOnChanges() {
    this.calculateDisplayProfile();
  }

  get isCurrentUserAdmin(): boolean {
    if (!this.channelInfo || !this.channelInfo.esGrupo) return false;
    
    // Si el grupo es viejo y nadie es admin, permitimos a todos invitar para no bloquear la app
    const tieneAdmins = this.channelInfo.participantes?.some((p: any) => p.esAdmin === true);
    if (!tieneAdmins) return true;
    
    // Buscar si tú eres admin
    const me = this.channelInfo.participantes?.find((p: any) => 
      Number(p.id) === Number(this.currentUserId) || Number(p.usuarioId) === Number(this.currentUserId)
    );
    return me?.esAdmin === true;
  }

  calculateDisplayProfile() {
    if (!this.channelInfo) {
      this.displayProfile = null;
      return;
    }

    if (this.channelInfo.esGrupo) {
      this.displayProfile = {
        nombre: this.channelInfo.nombre || 'Grupo',
        tipo: 'Canal de Grupo',
        icon: 'pi pi-users',
        iniciales: (this.channelInfo.nombre || 'G').substring(0, 2).toUpperCase(),
        esGrupo: true
      };
    } else {
      // Chat privado: buscar al otro usuario
      const otroUsuario = this.channelInfo.participantes?.find((p: any) => 
        Number(p.id) !== Number(this.currentUserId) && Number(p.usuarioId) !== Number(this.currentUserId)
      );

      // Desenrollar si viene dentro de 'usuario'
      const infoOtro = otroUsuario?.usuario || otroUsuario || {};
      
      const nombreMostrar = infoOtro.nombre || 'Usuario Desconocido';

      this.displayProfile = {
        nombre: nombreMostrar,
        tipo: infoOtro.rol || 'Chat Directo',
        email: infoOtro.email || '',
        icon: 'pi pi-user',
        iniciales: nombreMostrar.substring(0, 2).toUpperCase(),
        esGrupo: false,
        online: infoOtro.isOnline || infoOtro.enLinea || otroUsuario?.enLinea || false
      };
    }
  }

  private getChannelId(): number {
    return Number(this.channelInfo?.canalId || this.channelInfo?.id || 0);
  }

  onAddParticipant(usuarioId: number) {
    const canalId = this.getChannelId();
    if (canalId > 0) {
      this.addParticipant.emit({
        canalId,
        usuarioId,
        actorId: this.currentUserId
      });
    }
  }

  onRemoveParticipant(usuarioId: number) {
    const canalId = this.getChannelId();
    if (canalId > 0) {
      this.removeParticipant.emit({
        canalId,
        usuarioId,
        actorId: this.currentUserId
      });
    }
  }

  onMakeAdmin(usuarioId: number) {
    const canalId = this.getChannelId();
    if (canalId > 0) {
      this.makeAdmin.emit({
        canalId,
        usuarioId,
        actorId: this.currentUserId
      });
    }
  }

  onRemoveAdmin(usuarioId: number) {
    const canalId = this.getChannelId();
    if (canalId > 0) {
      this.removeAdmin.emit({
        canalId,
        usuarioId,
        actorId: this.currentUserId
      });
    }
  }

  onLeaveChannel() {
    const canalId = this.getChannelId();
    if (canalId > 0) {
      this.leaveChannel.emit({
        canalId,
        usuarioId: this.currentUserId
      });
    }
  }

  onClose() {
    this.closeInfoPanel.emit();
  }
}
