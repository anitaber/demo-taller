import { Routes } from '@angular/router';

/** Gestión de Abastecimiento: por ahora solo la pantalla inicial de la solicitud de anuncio de contratación futura. */
export const ABASTECIMIENTO_ROUTES: Routes = [
  {
    path: 'procesos/actuaciones-preparatorias/anuncio-contratacion-futura',
    loadComponent: () =>
      import('./actuaciones-preparatorias/pages/anuncio-contratacion-futura/anuncio-contratacion-futura.component').then(
        (m) => m.AnuncioContratacionFuturaComponent,
      ),
  },
];
