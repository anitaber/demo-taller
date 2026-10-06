import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AuthApiService } from '../../core/api/auth-api.service';
import { AuthService } from '../../core/auth/auth.service';
import { CurrentUserService } from '../../core/auth/current-user.service';
import { PermissionService } from '../../core/auth/permission.service';
import { SolicitudesStateService } from '../../core/state/solicitudes-state.service';
import { PROVEEDORES_SHELL_DE_MUESTRA, sembrarSesionDeMuestra } from '../../features/ui-kit/ejemplos/datos-de-muestra';
import { ShellNavigationService } from '../shell/shell-navigation.service';
import { VirtualDeskComponent } from './virtual-desk.component';

/** El Panel con la sesión de muestra del catálogo: creador con cuatro documentos y dos notificaciones sin leer. */
describe('VirtualDeskComponent', () => {
  let fixture: ComponentFixture<VirtualDeskComponent>;
  const el = (): HTMLElement => fixture.nativeElement;
  const tarjetas = (): HTMLElement[] => Array.from(el().querySelectorAll<HTMLElement>('siaf-desk-card'));
  const abrirProcesos = jasmine.createSpy('openProcessMenu');
  const abrirBandeja = jasmine.createSpy('openTray');
  const abrirCrear = jasmine.createSpy('openCreateDocument');

  beforeEach(async () => {
    abrirProcesos.calls.reset();
    abrirBandeja.calls.reset();
    abrirCrear.calls.reset();
    await TestBed.configureTestingModule({
      imports: [VirtualDeskComponent],
      providers: [
        ...PROVEEDORES_SHELL_DE_MUESTRA,
        { provide: AuthService, useValue: { debeCambiarPassword: signal(false).asReadonly() } },
        { provide: AuthApiService, useValue: { cambiarPassword: () => of(undefined) } },
        { provide: ShellNavigationService, useValue: { openProcessMenu: abrirProcesos, openTray: abrirBandeja, openCreateDocument: abrirCrear } },
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    sembrarSesionDeMuestra(TestBed.inject(CurrentUserService), TestBed.inject(PermissionService), TestBed.inject(SolicitudesStateService));
    fixture = TestBed.createComponent(VirtualDeskComponent);
    fixture.detectChanges();
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('pinta las ocho tarjetas con siaf-desk-card, cada una en su variante y con los contadores de la bandeja', () => {
    const resumen = tarjetas().map((t) => [
      t.querySelector('[data-variante]')?.getAttribute('data-variante'),
      t.querySelector('[data-titulo]')?.textContent?.trim(),
      t.querySelector('[data-numero]')?.textContent?.trim() ?? null,
    ]);
    expect(resumen).toEqual([
      ['featured', 'Bandeja de Documentos', '04'],
      ['featured', 'Procesos', null],
      ['counter', 'Recibidos', '01'],
      ['counter', 'Enviados', '02'],
      ['counter', 'Borradores', '02'],
      ['counter', 'Notificaciones', '02'],
      ['shortcut', 'Consulta y Reportes', null],
      ['shortcut', 'Crear documento', null],
    ]);
    const hechasAMano = Array.from(el().querySelectorAll('article')).filter((a) => !a.closest('siaf-desk-card'));
    expect(hechasAMano.length).withContext('sin tarjetas hechas a mano').toBe(0);
  });

  const boton = (titulo: string): HTMLButtonElement | undefined =>
    Array.from(el().querySelectorAll<HTMLButtonElement>('siaf-desk-card button')).find((b) => b.querySelector('[data-titulo]')?.textContent?.trim() === titulo);

  it('todas las tarjetas son botones salvo Consulta y Reportes, que aún no tiene destino', () => {
    const botones = Array.from(el().querySelectorAll<HTMLButtonElement>('siaf-desk-card button'));
    expect(botones.map((b) => b.querySelector('[data-titulo]')?.textContent?.trim())).toEqual([
      'Bandeja de Documentos', 'Procesos', 'Recibidos', 'Enviados', 'Borradores', 'Notificaciones', 'Crear documento',
    ]);
  });

  it('Procesos abre el menú de procesos', () => {
    boton('Procesos')!.click();
    expect(abrirProcesos).toHaveBeenCalledTimes(1);
  });

  it('cada contador de la bandeja abre su sección y la tarjeta Bandeja abre Recibidos', () => {
    boton('Bandeja de Documentos')!.click();
    boton('Recibidos')!.click();
    boton('Enviados')!.click();
    boton('Borradores')!.click();
    boton('Notificaciones')!.click();

    expect(abrirBandeja.calls.allArgs()).toEqual([['Recibidos'], ['Recibidos'], ['Enviados'], ['Borradores'], ['Notificaciones']]);
  });

  it('Crear documento abre el panel de creación', () => {
    boton('Crear documento')!.click();
    expect(abrirCrear).toHaveBeenCalledTimes(1);
  });
});
