import { Component, Input, ViewChild, ElementRef, ChangeDetectionStrategy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WebRtcService } from '../../services/webrtc.service';

@Component({
  selector: 'app-call-status',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './call-status.component.html',
  styleUrls: ['./call-status.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CallStatusComponent implements AfterViewInit {
  @Input() webRtcService!: WebRtcService;
  @Input() onAcceptCall!: () => void;
  @Input() onEndCall!: () => void;

  @ViewChild('localVideo', { static: false }) localVideoRef?: ElementRef<HTMLVideoElement>;
  @ViewChild('remoteVideo', { static: false }) remoteVideoRef?: ElementRef<HTMLVideoElement>;

  ngAfterViewInit(): void {
    // Pasar referencias de video al servicio WebRTC para que muestre streams
    if (this.localVideoRef?.nativeElement && this.remoteVideoRef?.nativeElement) {
      this.webRtcService.setVideoElements(
        this.localVideoRef.nativeElement,
        this.remoteVideoRef.nativeElement
      );
    }
  }

  acceptCall(): void {
    this.onAcceptCall?.();
  }

  endCall(): void {
    this.onEndCall?.();
  }
}
