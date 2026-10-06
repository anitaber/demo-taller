import { Routes } from '@angular/router';

import { roleChildGuard } from './core/auth';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/login/login.component').then((m) => m.LoginComponent)
  },
  {
    path: 'login/recuperar-contrasena',
    loadComponent: () =>
      import('./features/otp-verification/otp-verification.component').then((m) => m.OtpVerificationComponent)
  },
  // ── Catálogo de componentes (sin sesión) ──
  {
    path: 'ui-kit',
    loadComponent: () =>
      import('./features/ui-kit/ui-kit.component').then((m) => m.UiKitComponent)
  },
  // Un ejemplo del catálogo a pantalla completa: lo cargan los marcos de escritorio y móvil.
  {
    path: 'ui-kit/vista/:selector',
    loadComponent: () =>
      import('./features/ui-kit/ui-kit-vista.component').then((m) => m.UiKitVistaComponent)
  },
  {
    path: '',
    loadComponent: () =>
      import('./layout/shell/app-shell.component').then((m) => m.AppShellComponent),
    canActivateChild: [roleChildGuard],
    children: [
      // ── Escritorio virtual ──
      {
        path: 'panel',
        loadChildren: () =>
          import('./layout/virtual-desk/virtual-desk.routes').then((m) => m.VIRTUAL_DESK_ROUTES),
        data: { permissions: ['document.read'] }
      },
      // El proceso «Registro de cuentas bancarias» (`modules/tesoreria/`, `TESORERIA_ROUTES`) quedó desconectado: para
      // volver a verlo hay que montar aquí sus rutas, ponerlo en el árbol de procesos y devolver su tipo de documento
      // al catálogo del backend simulado.
      // ── Gestión de Abastecimiento: Actuaciones preparatorias (Documentos y registros y anuncio de contratación futura) ──
      {
        path: '',
        loadChildren: () =>
          import('./modules/abastecimiento/abastecimiento.routes').then((m) => m.ABASTECIMIENTO_ROUTES),
        data: { permissions: ['document.read'] }
      },
    ]
  },
  // Sin sesión, el guard del armazón lleva al login.
  { path: '**', redirectTo: 'panel' }
];
