import { Routes } from '@angular/router';

import { AnalisisDatos } from './analisis-datos/analisis-datos';
import { DesarrolloComercial } from './desarrollo-comercial/desarrollo-comercial';
import { EstrategiaComercial } from './estrategia-comercial';

export const COMERCIAL_ROUTES: Routes = [
  {
    path: '',
    redirectTo: 'estrategia-comercial',
    pathMatch: 'full'
  },
  {
    path: 'estrategia-comercial',
    component: EstrategiaComercial,
  },

  {
    path: 'analisis-datos',
    component: AnalisisDatos,
  },

  {
    path: 'desarrollo-comercial',
    component: DesarrolloComercial,
  },
];
