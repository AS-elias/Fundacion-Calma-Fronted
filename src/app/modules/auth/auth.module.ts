import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthRoutingModule } from './auth-routing-module';
import { LoginComponent } from './pages/login/login.component'; // Importa el componente

@NgModule({
  imports: [
    CommonModule,
    AuthRoutingModule,
    LoginComponent // <--- AL SER STANDALONE, VA EN IMPORTS, NO EN DECLARATIONS
  ]
})
export class AuthModule { }
