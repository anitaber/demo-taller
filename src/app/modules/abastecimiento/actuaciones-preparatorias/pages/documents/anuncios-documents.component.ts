import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnDestroy, OnInit, ViewChild, afterEveryRender, computed, inject, signal } from '@angular/core';

import { AnuncioDocumentoVisorComponent } from '../../components/anuncio-documento-visor/anuncio-documento-visor.component';
import { AnuncioRegistroHistoryPanelComponent } from '../../components/anuncio-registro-history-panel/anuncio-registro-history-panel.component';
import { ButtonGroupItem, ButtonsGroupComponent } from '../../../../../shared/ui/buttons-group/buttons-group.component';
import { ModalComponent } from '../../../../../shared/ui/modal/modal.component';
import { IconComponent } from '../../../../../shared/ui/icon/icon.component';

import { PermissionService } from '../../../../../core/auth/permission.service';
import { ESTADO } from '../../../../../core/models/documento.model';
import { SolicitudesFacadeService } from '../../../../../core/state/solicitudes-facade.service';
import { SolicitudesStateService } from '../../../../../core/state/solicitudes-state.service';
import { DocumentsRecordsPageComponent } from '../../../../../shared/components/documents-records-page/documents-records-page.component';
import type { DocumentsQuery, DocumentsRecordsConfig, DocumentsRecordsRow } from '../../../../../shared/types/documents-records.types';
import { createNewDocumentIdsSignal } from '../../../../../shared/utils/new-document-ids.util';
import { AnunciosApiService } from '../../api/anuncios-api.service';
import { REQUEST_ROUTE } from '../../config/anuncio-contratacion-futura.rutas';
import { ANUNCIOS_DOCUMENTS_CONFIG } from '../../config/anuncios-documents.config';
import { AnuncioRegistro, CODIGO_DOCUMENTO, NOMBRE_DOCUMENTO } from '../../models/anuncio-contratacion-futura.model';

/**
 * «Documentos y registros» de Actuaciones preparatorias. La pantalla entera la arma `siaf-documents-records-page`:
 * esta página solo carga la bandeja (documentos) y los anuncios aprobados (registros) y las pasa como filas.
 */
@Component({
  selector: 'siaf-anuncios-documents',
  standalone: true,
  imports: [ModalComponent, AnuncioDocumentoVisorComponent, AnuncioRegistroHistoryPanelComponent, ButtonsGroupComponent, DocumentsRecordsPageComponent, IconComponent],
  template: `
    <siaf-documents-records-page
      [config]="pageConfig()"
      [loading]="cargando()"
      (documentsQueryChange)="onDocumentsQuery($event)"
      (recordHistoryRequested)="abrirHistorial($event)"
      (recordDocumentRequested)="abrirDocumento($event)"
      (recordsExported)="descargarExcel($event)"
      (recordMenuAction)="onAccionRegistros($event)"
    >
      <!-- Cada procedimiento de Actuaciones preparatorias tiene sus registros; la cinta se desplaza con la flecha. -->
      <div records-header class="relative">
        <div #cinta class="overflow-x-auto pb-siaf-xxs [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" (scroll)="actualizarFlechas(cinta)">
          <siaf-buttons-group
            class="w-max pr-12 [&_button]:whitespace-nowrap"
            ariaLabel="Procedimiento"
            [items]="procedimientos"
            [value]="procedimiento()"
            (valueChange)="procedimiento.set($event)"
          />
        </div>
        @if (flechaIzquierda()) {
          <button
            class="absolute left-0 top-0 inline-flex size-10 items-center justify-center rounded-siaf-md border border-[var(--sys-color-border-states-enabled)] bg-surface text-[var(--sys-color-icon-states-enabled)] shadow-siaf-elevation-1 transition hover:bg-surface-muted"
            type="button"
            aria-label="Ver procedimientos anteriores"
            (click)="desplazar(cinta, -1)"
          >
            <siaf-icon name="chevron_left" [size]="24" />
          </button>
        }
        @if (flechaDerecha()) {
          <button
            class="absolute right-0 top-0 inline-flex size-10 items-center justify-center rounded-siaf-md border border-[var(--sys-color-border-states-enabled)] bg-surface text-[var(--sys-color-icon-states-enabled)] shadow-siaf-elevation-1 transition hover:bg-surface-muted"
            type="button"
            aria-label="Ver más procedimientos"
            (click)="desplazar(cinta, 1)"
          >
            <siaf-icon name="chevron_right" [size]="24" />
          </button>
        }
      </div>
    </siaf-documents-records-page>

    <siaf-modal
      variant="custom"
      title="¿Despublicar registros?"
      [description]="descripcionDespublicar()"
      confirmVariant="primary"
      confirmLabel="Aceptar"
      cancelLabel="Cancelar"
      [open]="modalDespublicar()"
      (confirmed)="confirmarDespublicar()"
      (canceled)="modalDespublicar.set(false)"
      (closed)="modalDespublicar.set(false)"
    />

    <siaf-anuncio-documento-visor [open]="documentoAbierto()" [registro]="registroDocumento()" (closed)="documentoAbierto.set(false)" />

    <siaf-anuncio-registro-history-panel [open]="historialAbierto()" [registro]="registroHistorial()" (closed)="historialAbierto.set(false)" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnunciosDocumentsComponent implements OnInit, OnDestroy {
  /** Procedimientos de Actuaciones preparatorias: solo el anuncio de contratación futura tiene registros por ahora. */
  readonly procedimientos: ButtonGroupItem[] = [
    { label: 'Segmentación', value: 'segmentacion' },
    { label: 'Anuncio de contratación futura', value: 'anuncio' },
    { label: 'Formulación de requerimiento', value: 'formulacion' },
    { label: 'Estrategia de contratación', value: 'estrategia' },
    { label: 'Interacción con el mercado', value: 'interaccion' },
    { label: 'Designación de evaluadores', value: 'evaluadores' },
    { label: 'Aprobación de expediente de contratación', value: 'expediente' },
    { label: 'Elaboración de bases', value: 'bases' },
  ];
  readonly procedimiento = signal('anuncio');

  /** Flechas de la cinta: cada una aparece solo si hay procedimientos por ver hacia ese lado. */
  readonly flechaIzquierda = signal(false);
  readonly flechaDerecha = signal(false);
  private cintaEl: HTMLElement | null = null;

  private observador: ResizeObserver | null = null;

  constructor() {
    // Tras cada pintado, con la cinta ya medida (al cargar, al cambiar de pestaña): las signals solo avisan si cambian.
    afterEveryRender(() => {
      if (this.cintaEl) this.actualizarFlechas(this.cintaEl);
    });
  }

  @ViewChild('cinta') set cintaRef(el: ElementRef<HTMLElement> | undefined) {
    this.observador?.disconnect();
    this.cintaEl = el?.nativeElement ?? null;
    if (!this.cintaEl) return;
    // Vuelve a medir cada vez que cambia el tamaño de la cinta o de su contenido (carga, ventana, cambio de pantalla).
    const cinta = this.cintaEl;
    this.observador = new ResizeObserver(() => this.actualizarFlechas(cinta));
    this.observador.observe(cinta);
    if (cinta.firstElementChild) this.observador.observe(cinta.firstElementChild);
  }

  ngOnDestroy(): void {
    this.observador?.disconnect();
  }

  actualizarFlechas(cinta: HTMLElement): void {
    this.flechaIzquierda.set(cinta.scrollLeft > 1);
    this.flechaDerecha.set(cinta.scrollLeft + cinta.clientWidth < cinta.scrollWidth - 1);
  }

  desplazar(cinta: HTMLElement, sentido: 1 | -1): void {
    cinta.scrollBy({ left: 240 * sentido, behavior: 'smooth' });
  }

  // ── Acciones sobre los registros marcados ─────────────────────────
  readonly modalDespublicar = signal(false);
  private registrosADespublicar: string[] = [];
  readonly descripcionDespublicar = signal('Los registros dejarán de estar publicados.');

  onAccionRegistros(evento: { action: string; rows: DocumentsRecordsRow[] }): void {
    if (evento.action !== 'despublicar' || !evento.rows.length) return;
    this.registrosADespublicar = evento.rows.filter((fila) => fila['publicacion'] !== 'Despublicado').map((fila) => String(fila['recordId']));
    this.descripcionDespublicar.set(
      this.registrosADespublicar.length === 1 ? 'El registro dejará de estar publicado.' : 'Los registros dejarán de estar publicados.',
    );
    this.modalDespublicar.set(true);
  }

  confirmarDespublicar(): void {
    this.modalDespublicar.set(false);
    this.anunciosApi.despublicar(this.registrosADespublicar).subscribe(() => {
      this.anunciosApi.listarRegistros().subscribe((registros) => this.registros.set(registros));
    });
  }

  /** Descarga en Excel los registros marcados, con las columnas de la grilla. */
  async descargarExcel(filas: DocumentsRecordsRow[]): Promise<void> {
    const { Workbook } = await import('exceljs');
    const libro = new Workbook();
    const hoja = libro.addWorksheet('Anuncios de contratación futura');
    hoja.columns = [
      { header: 'Descripción', key: 'descripcion', width: 70 },
      { header: 'Fec. aprox. contratación', key: 'fechaConvocatoria', width: 24 },
      { header: 'Estado del registro', key: 'status', width: 20 },
      { header: 'N° de documento', key: 'numero', width: 16 },
      { header: 'Documento', key: 'documentoDescripcion', width: 42 },
      { header: 'Estado de la publicación', key: 'publicacion', width: 24 },
    ];
    hoja.getRow(1).font = { bold: true };
    filas.forEach((fila) => hoja.addRow(fila));
    const buffer = await libro.xlsx.writeBuffer();
    const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = `anuncios-contratacion-futura-${new Date().toISOString().slice(0, 10)}.xlsx`;
    enlace.click();
    URL.revokeObjectURL(url);
  }

  // ── Documento del registro (PDF) ──────────────────────────────────
  readonly documentoAbierto = signal(false);
  readonly registroDocumento = signal<AnuncioRegistro | null>(null);

  abrirDocumento(fila: DocumentsRecordsRow): void {
    const registro = this.registros().find((r) => r.id === fila['recordId']) ?? null;
    if (!registro) return;
    this.registroDocumento.set(registro);
    this.documentoAbierto.set(true);
  }

  // ── Historial del registro ────────────────────────────────────────
  readonly historialAbierto = signal(false);
  readonly registroHistorial = signal<AnuncioRegistro | null>(null);

  abrirHistorial(fila: DocumentsRecordsRow): void {
    const registro = this.registros().find((r) => r.id === fila['recordId']) ?? null;
    if (!registro) return;
    this.registroHistorial.set(registro);
    this.historialAbierto.set(true);
  }

  private readonly solicitudesState = inject(SolicitudesStateService);
  private readonly solicitudesFacade = inject(SolicitudesFacadeService);
  private readonly permissions = inject(PermissionService);
  private readonly anunciosApi = inject(AnunciosApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly nuevos = createNewDocumentIdsSignal();

  private readonly registros = signal<AnuncioRegistro[]>([]);
  readonly cargando = signal(true);

  ngOnInit(): void {
    // Bandeja según el rol (el aprobador además refresca cada 30 s).
    // La primera página la resuelve el backend (simulado), igual que las siguientes.
    this.solicitudesFacade.iniciarBandeja(this.permissions.currentRole(), this.destroyRef, [CODIGO_DOCUMENTO], { page: 1, limit: 10 });
    this.anunciosApi.listarRegistros().subscribe({
      next: (registros) => { this.registros.set(registros); this.cargando.set(false); },
      error: () => this.cargando.set(false),
    });
  }

  /** Búsqueda y paginación de la pestaña Documentos (Enter, lupa o cambio de página). */
  onDocumentsQuery(q: DocumentsQuery): void {
    const query = { search: q.search, page: q.page, limit: q.limit };
    if (this.permissions.currentRole() === 'approver') this.solicitudesFacade.cargarBandejaAprobador([CODIGO_DOCUMENTO], query);
    else this.solicitudesFacade.cargarBandejaCreador([CODIGO_DOCUMENTO], query);
  }

  readonly pageConfig = computed((): DocumentsRecordsConfig => {
    const solicitudes = this.permissions.currentRole() === 'approver'
      ? this.solicitudesState.bandejaAprobador()
      : this.solicitudesState.bandejaCreador();
    const nuevos = this.nuevos();

    const documentRows: DocumentsRecordsRow[] = solicitudes.map((s) => {
      const verificado = [...s.historial].reverse().find((h) => h.estado === ESTADO.VERIFICADO);
      const aprobado = [...s.historial].reverse().find((h) => h.estado === ESTADO.APROBADO);
      return {
        document: s.tipoDocumento,
        documentId: s.id,
        isNew: nuevos.has(s.id),
        number: s.numero || '—',
        actionType: s.tipoAccion === 'creacion' ? 'Creación' : s.tipoAccion,
        status: s.estado,
        system: 'Sistema Nacional de Abastecimiento',
        date: s.fecha,
        entity: s.entidad || '—',
        creator: s.creador,
        subject: s.justificacion,
        requesterArea: s.unidad,
        evaluationDate: verificado?.fecha ?? '—',
        evaluationUser: verificado?.usuario ?? '—',
        approvalDate: aprobado?.fecha ?? '—',
        approvalUser: aprobado?.usuario ?? '—',
        linkRoute: `${REQUEST_ROUTE}/${s.id}`,
      };
    });

    // Solo el anuncio de contratación futura tiene registros: los demás procedimientos aparecen vacíos.
    const registros = this.procedimiento() === 'anuncio' ? this.registros() : [];
    const recordRows: DocumentsRecordsRow[] = registros.map((r) => ({
      recordId: r.id,
      status: r.estado,
      descripcion: r.descripcion.toUpperCase(),
      fechaConvocatoria: r.fechaConvocatoria.split('-').reverse().join('/'),
      numero: r.numeroDocumento,
      documentoDescripcion: NOMBRE_DOCUMENTO,
      // Un anuncio aprobado queda publicado.
      publicacion: r.publicacion ?? 'Publicado',
      verDocumento: '',
      // Para el historial del registro: la solicitud que lo creó.
      document: NOMBRE_DOCUMENTO,
      documentId: r.documentoId,
      number: r.numeroDocumento,
      actionType: 'Creación',
      linkRoute: `${REQUEST_ROUTE}/${r.documentoId}`,
    }));

    return {
      ...ANUNCIOS_DOCUMENTS_CONFIG,
      // Despublicar es solo del aprobador; descargar en Excel lo tienen los dos roles.
      recordMenuItems: this.permissions.currentRole() === 'approver' ? ANUNCIOS_DOCUMENTS_CONFIG.recordMenuItems : [],
      documentRows,
      recordRows,
      serverQuery: { total: this.solicitudesState.bandejaTotal() },
    };
  });
}
