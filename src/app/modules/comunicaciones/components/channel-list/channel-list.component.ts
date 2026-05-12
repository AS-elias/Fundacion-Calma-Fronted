import { Component, EventEmitter, Output, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-channel-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './channel-list.component.html',
  styleUrls: ['./channel-list.component.scss']
})
export class ChannelListComponent {
  @Input() channels: any[] = [];
  @Output() channelSelected = new EventEmitter<any>();
  @Output() createNewChannel = new EventEmitter<void>();

  selectChannel(channel: any) {
    this.channelSelected.emit(channel);
  }

  onCreateChannel() {
    this.createNewChannel.emit();
  }
}
