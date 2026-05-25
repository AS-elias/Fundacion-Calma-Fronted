import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { SidebarComponent } from '../../components/sidebar/sidebar'; // <-- IMPORTAMOS EL SIDEBAR
import { NavbarComponent } from '../../components/navbar/navbar.component';
import { LayoutService } from '../../services/layout.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, SidebarComponent, NavbarComponent], // <-- LO REGISTRAMOS AQUÍ
  templateUrl: './main-layout.html',
  styleUrls: ['./main-layout.scss']
})
export class MainLayoutComponent implements OnInit {
  layoutService = inject(LayoutService);
  private router = inject(Router);

  ngOnInit() {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.layoutService.closeSidebarMobile();
    });
  }

  closeMenu() {
    this.layoutService.closeSidebarMobile();
  }
}
