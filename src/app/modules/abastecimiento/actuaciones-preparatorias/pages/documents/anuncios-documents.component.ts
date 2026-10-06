import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';

import { AnuncioRegistroHistoryPanelComponent } from '../../components/anuncio-registro-history-panel/anuncio-registro-history-panel.component';
import { ButtonGroupItem, ButtonsGroupComponent } from '../../../../../shared/ui/buttons-group/buttons-group.component';
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
  imports: [AnuncioRegistroHistoryPanelComponent, ButtonsGroupComponent, DocumentsRecordsPageComponent, IconComponent],
  template: `
    <siaf-documents-records-page
      [config]="pageConfig()"
      [loading]="cargando()"
      (documentsQueryChange)="onDocumentsQuery($event)"
      (recordHistoryRequested)="abrirHistorial($event)"
    >
      <!-- Cada procedimiento de Actuaciones preparatorias tiene sus registros; la cinta se desplaza con la flecha. -->
      <div records-header class="relative">
        <div #cinta class="overflow-x-auto pb-siaf-xxs [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <siaf-buttons-group
            class="w-max pr-12 [&_button]:whitespace-nowrap"
            ariaLabel="Procedimiento"
            [items]="procedimientos"
            [value]="procedimiento()"
            (valueChange)="procedimiento.set($event)"
          />
        </div>
        <button
          class="absolute right-0 top-0 inline-flex size-10 items-center justify-center rounded-siaf-md border border-[var(--sys-color-border-states-enabled)] bg-surface text-[var(--sys-color-icon-states-enabled)] shadow-siaf-elevation-1 transition hover:bg-surface-muted"
          type="button"
          aria-label="Ver más procedimientos"
          (click)="desplazar(cinta)"
        >
          <siaf-icon name="chevron_right" [size]="24" />
        </button>
      </div>
    </siaf-documents-records-page>

    <siaf-anuncio-registro-history-panel [open]="historialAbierto()" [registro]="registroHistorial()" (closed)="historialAbierto.set(false)" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnunciosDocumentsComponent implements OnInit {
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

  desplazar(cinta: HTMLElement): void {
    cinta.scrollBy({ left: 240, behavior: 'smooth' });
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
      publicacion: 'Publicado',
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
      documentRows,
      recordRows,
      serverQuery: { total: this.solicitudesState.bandejaTotal() },
    };
  });
}
