import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LayoutService {

  private sidebarMobileOpen = new BehaviorSubject<boolean>(false);
  public sidebarMobileOpen$ = this.sidebarMobileOpen.asObservable();

  constructor() { }

  toggleSidebarMobile() {
    this.sidebarMobileOpen.next(!this.sidebarMobileOpen.value);
  }

  closeSidebarMobile() {
    this.sidebarMobileOpen.next(false);
  }
}
