import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-chat-area',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-area.component.html',
  styleUrls: ['./chat-area.component.scss']
})
export class ChatAreaComponent implements AfterViewChecked {
  @Input() channel: any = null;
  @Input() messages: any[] = [];
  @Input() currentUserId: number = 0;
  
  @Output() sendMessage = new EventEmitter<any>();
  @Output() uploadFile = new EventEmitter<any>();
  @Output() reactToMessage = new EventEmitter<any>();
  @Output() deleteMessage = new EventEmitter<any>();
  
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;
  
  newMessageContent = '';
  showEmojiPicker = false;
  
  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  scrollToBottom(): void {
    try {
      this.messagesContainer.nativeElement.scrollTop = this.messagesContainer.nativeElement.scrollHeight;
    } catch(err) { }
  }

  onSend() {
    if (this.newMessageContent.trim() && this.channel) {
      this.sendMessage.emit({
        canalId: this.channel.canalId,
        remitenteId: this.currentUserId,
        contenido: this.newMessageContent.trim(),
        tipo: 'text',
        archivoUrl: null
      });
      this.newMessageContent = '';
    }
  }

  onFileUpload(event: any) {
    const file = event.target.files[0];
    if (file && this.channel) {
      this.uploadFile.emit({
        file,
        canalId: this.channel.canalId
      });
    }
  }

  onReact(messageId: number, emoji: string) {
    this.reactToMessage.emit({ mensajeId: messageId, emoji });
  }

  onDelete(messageId: number) {
    this.deleteMessage.emit({ mensajeId: messageId, canalId: this.channel?.canalId });
  }
}
