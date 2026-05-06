import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-empty-chat',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './empty-chat.component.html',
  styleUrls: ['./empty-chat.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmptyChatComponent {}
