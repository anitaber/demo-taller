import { provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ESPERA_AL_SALIR_MS } from '../tooltip/tooltip.directive';
import { DocumentsRecordsTableComponent } from './documents-records-table.component';
import type { DocumentsRecordsColumn, DocumentsRecordsRow } from '../../types/documents-records.types';

/** N° de documento largo: el formato real del sistema, que se corta en la columna. */
const NUMERO_LARGO = 'SCMPC-SPC-0001-2026-MEF-DGCP-UNIDAD-EJECUTORA-DE-PRUEBA-MUY-LARGA';

describe('DocumentsRecordsTableComponent — tooltip de textos truncados', () => {
  let fixture: ComponentFixture<DocumentsRecordsTableComponent>;

  const columns: DocumentsRecordsColumn[] = [
    { key: 'document', label: 'N° Documento', visibility: 'visible', group: 'default', widthClass: 'w-[440px]', kind: 'document-link' },
    { key: 'entidad', label: 'Entidad', visibility: 'visible', group: 'default' }
  ];

  const rows: DocumentsRecordsRow[] = [{ number: '1', document: NUMERO_LARGO, entidad: NUMERO_LARGO }];

  beforeEach(async () => {
    // El tooltip por hover solo actúa en dispositivos con hover real, y un
    // Chrome headless sin puntero (el del CI en Linux) reporta `hover: none`.
    // Forzamos la consulta para que estos specs no dependan del entorno.
    spyOn(window, 'matchMedia').and.returnValue({ matches: true } as MediaQueryList);

    await TestBed.configureTestingModule({
      imports: [DocumentsRecordsTableComponent],
      providers: [provideRouter([]), provideHttpClient()]
    }).compileComponents();

    fixture = TestBed.createComponent(DocumentsRecordsTableComponent);
    fixture.componentRef.setInput('columns', columns);
    fixture.componentRef.setInput('rows', rows);
    fixture.componentRef.setInput('documentRoute', () => '/');
    // El host debe estar en el layout real para que scrollWidth/clientWidth midan.
    fixture.nativeElement.style.width = '320px';
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
  });

  afterEach(() => {
    document.querySelectorAll('[role="tooltip"]').forEach((t) => t.remove());
    fixture.nativeElement.remove();
  });

  function tooltipVisible(): HTMLElement | null {
    return document.body.querySelector('[role="tooltip"]');
  }

  it('muestra el N° de documento completo al pasar el mouse sobre el enlace truncado', () => {
    const enlace: HTMLElement = fixture.nativeElement.querySelector('a');
    expect(enlace.scrollWidth).toBeGreaterThan(enlace.clientWidth);

    enlace.dispatchEvent(new MouseEvent('mouseenter'));

    expect(tooltipVisible()?.textContent).toBe(NUMERO_LARGO);
  });

  it('muestra el contenido completo de una celda de texto truncada', () => {
    // La tabla usa table-layout automático: la celda solo se trunca si algo
    // le pone tope de ancho (como el max-w del enlace de documento).
    const celda: HTMLElement = fixture.nativeElement.querySelector('tbody span.truncate');
    (celda.closest('td') as HTMLElement).style.maxWidth = '80px';

    celda.dispatchEvent(new MouseEvent('mouseenter'));

    expect(tooltipVisible()?.textContent).toBe(NUMERO_LARGO);
  });

  it('no muestra tooltip cuando el texto entra completo', () => {
    fixture.componentRef.setInput('rows', [{ number: '1', document: 'A-1', entidad: 'B' }]);
    fixture.detectChanges();

    fixture.nativeElement.querySelector('a').dispatchEvent(new MouseEvent('mouseenter'));

    expect(tooltipVisible()).toBeNull();
  });

  it('oculta el tooltip al salir el mouse, tras la espera que permite llevar el puntero al globo', fakeAsync(() => {
    const enlace: HTMLElement = fixture.nativeElement.querySelector('a');

    enlace.dispatchEvent(new MouseEvent('mouseenter'));
    enlace.dispatchEvent(new MouseEvent('mouseleave'));
    tick(ESPERA_AL_SALIR_MS);

    expect(tooltipVisible()).toBeNull();
  }));
});

describe('DocumentsRecordsTableComponent — Registros con cabecera agrupada y columnas fijas', () => {
  let fixture: ComponentFixture<DocumentsRecordsTableComponent>;
  const el = (): HTMLElement => fixture.nativeElement;

  const columns: DocumentsRecordsColumn[] = [
    { key: 'descripcion', label: 'Descripción', visibility: 'visible', group: 'default', widthClass: 'w-[300px]' },
    { key: 'numero', label: 'Número', visibility: 'visible', group: 'default', headerGroup: 'Documento' },
    { key: 'documento', label: 'Descripción', visibility: 'visible', group: 'default', headerGroup: 'Documento' },
    { key: 'publicacion', label: 'Estado de la publicación', visibility: 'visible', group: 'default', sticky: 'right', stickyWidth: 130 },
    { key: 'ver', label: '', visibility: 'visible', group: 'default', kind: 'document-icon', sticky: 'right', stickyWidth: 56 },
  ];
  const rows: DocumentsRecordsRow[] = [
    { recordId: 'a', descripcion: 'UNO', numero: '0001', documento: 'Solicitud', publicacion: 'Publicado', linkRoute: '/procesos/x/1' },
    { recordId: 'b', descripcion: 'DOS', numero: '0002', documento: 'Solicitud', publicacion: 'Publicado', linkRoute: '/procesos/x/2' },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DocumentsRecordsTableComponent],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();
    fixture = TestBed.createComponent(DocumentsRecordsTableComponent);
    fixture.componentRef.setInput('activeTab', 'records');
    fixture.componentRef.setInput('columns', columns);
    fixture.componentRef.setInput('rows', rows);
    fixture.componentRef.setInput('recordTrackKey', 'recordId');
    fixture.componentRef.setInput('selectableRecords', true);
    fixture.componentRef.setInput('documentRoute', (row: DocumentsRecordsRow) => String(row['linkRoute']));
    fixture.detectChanges();
  });

  it('con columnas agrupadas pinta dos filas de cabecera: el grupo arriba y sus columnas abajo', () => {
    const filas = el().querySelectorAll('thead tr');
    expect(filas.length).toBe(2);

    const grupo = Array.from(filas[0].querySelectorAll('th')).find((th) => th.textContent?.trim() === 'Documento');
    expect(grupo?.getAttribute('colspan')).toBe('2');
    expect(Array.from(filas[1].querySelectorAll('th')).map((th) => th.textContent?.trim())).toEqual(['Número', 'Descripción']);
  });

  it('en Registros pinta una casilla por fila solo si la config lo pide', () => {
    expect(el().querySelectorAll('tbody input[type="checkbox"]').length).toBe(2);

    fixture.componentRef.setInput('selectableRecords', false);
    fixture.detectChanges();

    expect(el().querySelectorAll('tbody input[type="checkbox"]').length).toBe(0);
  });

  it('las casillas avisan de la fila marcada', () => {
    let cambio: { selected: boolean } | undefined;
    fixture.componentInstance.selectionChanged.subscribe((c) => (cambio = c));

    (el().querySelector('tbody input[type="checkbox"]') as HTMLInputElement).click();

    expect(cambio?.selected).toBeTrue();
  });

  it('las columnas fijas van a la derecha, antes del historial, apiladas con el ancho que declaran', () => {
    // Sin la columna de casillas, que también es fija pero a la izquierda.
    const fijas = Array.from(el().querySelectorAll<HTMLElement>('tbody tr:first-child td.sticky:not(.sombra-izq)'));

    // publicación (130), ícono del documento (56) y el botón de historial, que mide 56.
    expect(fijas.length).toBe(3);
    expect(fijas[0].style.right).toBe('112px');
    expect(fijas[1].style.right).toBe('56px');
    expect(fijas[2].querySelector('button')?.getAttribute('aria-label')).toBe('Historial de registro');
  });

  it('el ícono del documento enlaza a la solicitud de la fila', () => {
    const enlace = el().querySelector<HTMLAnchorElement>('tbody tr:first-child a[aria-label="Ver documento"]');

    expect(enlace?.getAttribute('href')).toBe('/procesos/x/1');
  });
});
