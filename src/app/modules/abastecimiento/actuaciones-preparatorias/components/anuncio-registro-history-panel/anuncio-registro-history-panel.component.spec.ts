import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AnuncioRegistro } from '../../models/anuncio-contratacion-futura.model';
import { AnuncioRegistroHistoryPanelComponent } from './anuncio-registro-history-panel.component';

describe('AnuncioRegistroHistoryPanelComponent', () => {
  let fixture: ComponentFixture<AnuncioRegistroHistoryPanelComponent>;
  let http: HttpTestingController;
  const el = (): HTMLElement => fixture.nativeElement;

  const registro: AnuncioRegistro = {
    id: 'acf-1',
    codigo: 'ACF-0001',
    estado: 'Activo',
    entidadSiglas: 'MEF',
    documentoId: 'sol-1',
    numeroDocumento: '0001',
    fechaRegistro: '2026-08-19T08:00:59.000Z',
    contratacionCodigo: '0004',
    descripcion: 'Adquisición de medicamentos oncológicos para hospitales de la red asistencial',
    objeto: 'Bien',
    origen: 'PAC',
    tipoProcedimiento: 'Licitación pública',
    cantidadAproximada: 100000,
    alcance: 'Medicamentos para la red asistencial.',
    plazoEntrega: 90,
    fechaConvocatoria: '2026-10-14',
  };

  const persona = (nombres: string, apellidoPaterno: string) => ({ nombres, apellidoPaterno, apellidoMaterno: 'Díaz' });
  const solicitud = {
    id: 'sol-1',
    fechaRegistro: '2026-08-19T08:00:59.000Z',
    historialEstados: [
      { id: 'h1', estadoNuevo: 'ELABORADO', createdAt: '2026-08-19T08:00:59.000Z', creador: persona('Ana', 'Torres') },
      { id: 'h2', estadoNuevo: 'VERIFICADO', createdAt: '2026-08-20T09:00:00.000Z', creador: persona('Ana', 'Torres') },
    ],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnuncioRegistroHistoryPanelComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AnuncioRegistroHistoryPanelComponent);
    fixture.componentRef.setInput('registro', registro);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    http.expectOne((r) => r.url.endsWith('/solicitudes/sol-1')).flush(solicitud);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('muestra el documento, el anuncio tal como se aprobó y la convocatoria', () => {
    const texto = el().textContent ?? '';

    expect(texto).toContain('Historial del registro');
    expect(texto).toContain('Solicitud de anuncio de contratación futura');
    expect(texto).toContain('0004');
    expect(texto).toContain('ADQUISICIÓN DE MEDICAMENTOS ONCOLÓGICOS');
    expect(texto).toContain('Licitación pública');
    expect(texto).toContain('Medicamentos para la red asistencial.');
    expect(texto).toContain('100,000');
    expect(texto).toContain('14/10/2026');
  });

  it('en la trazabilidad, creador y verificador son la misma persona y lo no ocurrido figura sin asignar', () => {
    const texto = el().textContent ?? '';

    expect(texto.match(/ANA TORRES DÍAZ/g)?.length).toBe(2);
    expect(texto).toContain('No asignado aún');
  });

  it('un anuncio de obra no muestra la cantidad aproximada', () => {
    fixture.componentRef.setInput('registro', { ...registro, cantidadAproximada: null });
    fixture.detectChanges();

    expect(el().textContent).not.toContain('Cantidad aproximada');
  });

  it('se cierra con la X', () => {
    let cerrado = false;
    fixture.componentInstance.closed.subscribe(() => (cerrado = true));

    el().querySelector<HTMLButtonElement>('button[aria-label="Cerrar historial del registro"]')!.click();

    expect(cerrado).toBeTrue();
  });
});
