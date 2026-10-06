import { Routes } from '@angular/router';

/** Gestión de Abastecimiento: Documentos y registros de «Actuaciones preparatorias» y su solicitud de anuncio. */
export const ABASTECIMIENTO_ROUTES: Routes = [
  {
    path: 'procesos/actuaciones-preparatorias',
    loadComponent: () =>
      import('./actuaciones-preparatorias/pages/documents/anuncios-documents.component').then(
        (m) => m.AnunciosDocumentsComponent,
      ),
  },
  {
    path: 'procesos/actuaciones-preparatorias/anuncio-contratacion-futura',
    loadComponent: () =>
      import('./actuaciones-preparatorias/pages/anuncio-contratacion-futura/anuncio-contratacion-futura.component').then(
        (m) => m.AnuncioContratacionFuturaComponent,
      ),
  },
  {
    path: 'procesos/actuaciones-preparatorias/anuncio-contratacion-futura/:id',
    loadComponent: () =>
      import('./actuaciones-preparatorias/pages/anuncio-contratacion-futura/anuncio-contratacion-futura.component').then(
        (m) => m.AnuncioContratacionFuturaComponent,
      ),
  },
];
