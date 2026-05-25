import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { delay } from 'rxjs';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ToastModule } from 'primeng/toast';
import { ProgressBarModule } from 'primeng/progressbar';
import { MessageService } from 'primeng/api';
import { LoadingService } from './core/services/loading.service';
import { InactivityService } from './modules/auth/services/inactivity.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, ToastModule, ProgressBarModule],
  template: `
    <p-toast></p-toast>
    <div class="global-loader-container" *ngIf="isLoading$ | async">
      <p-progressBar mode="indeterminate" [style]="{'height': '4px', 'border-radius': '0'}" color="var(--primary-color)"></p-progressBar>
    </div>
    <router-outlet></router-outlet>
  `,
  styles: [`
    .global-loader-container {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      z-index: 9999;
    }
  `]
})
export class AppComponent implements OnInit, OnDestroy { 
  private inactivityService = inject(InactivityService);
  public loadingService = inject(LoadingService);
  public isLoading$ = this.loadingService.isLoading$.pipe(delay(0));

  ngOnInit(): void {
    this.inactivityService.iniciarTemporizador();
  }

  ngOnDestroy(): void {
    this.inactivityService.detenerTemporizador();
  }
}