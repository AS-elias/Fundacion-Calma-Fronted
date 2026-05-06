import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DatePicker } from 'primeng/datepicker';
import { DashboardService, UserDashboardStats } from '../../services/dashboard.service';

@Component({
  selector: 'app-user-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePicker],
  templateUrl: './user.component.html',
  styleUrls: ['./user.scss']
})
export class UserComponent implements OnInit {
  fechaActual: Date = new Date();
  
  stats: UserDashboardStats | null = null;
  cargando = true;

  private dashboardService = inject(DashboardService);

  ngOnInit(): void {
    this.dashboardService.getUserStats().subscribe({
      next: (data) => {
        this.stats = data;
        this.cargando = false;
      },
      error: () => {
        this.cargando = false;
      }
    });
  }
}