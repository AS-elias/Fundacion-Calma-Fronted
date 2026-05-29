import 'zone.js';
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component'; // Asegúrate que el archivo sea src/app/app.ts
import { isDevMode } from '@angular/core';

if (!isDevMode()) {
  // Deshabilitar logs en producción para mayor seguridad y rendimiento
  console.log = () => {};
  console.info = () => {};
  console.warn = () => {};
  console.debug = () => {};
}

bootstrapApplication(AppComponent, appConfig).catch((err) => console.error(err));
