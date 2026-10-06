import { NgClass, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { NotificationsStateService } from '../../../core/realtime/notifications-state.service';
import type { DocumentsRecordsColumn, DocumentsRecordsRow, DocumentsRecordsTab } from '../../types/documents-records.types';
import { FlowStatus, FlowStatusTagComponent } from '../flow-status-tag/flow-status-tag.component';
import { IconComponent } from '../icon/icon.component';
import { RecordStatus, RecordStatusTagComponent } from '../record-status-tag/record-status-tag.component';
import { TooltipDirective } from '../tooltip/tooltip.directive';

export type DocumentsRecordsSelectionChange = {
  row: DocumentsRecordsRow;
  selected: boolean;
};

/**
 * Tabla de las pestañas Documentos / Registros: columnas configurables, celdas por tipo
 * (enlace al documento, tag de flujo, tag de registro), checkbox de selección y botón de historial.
 *
 * Es la tabla interna de `siaf-documents-records-page`; para una grilla nueva compón la grilla
 * estándar (`siaf-table-controls` arriba + `siaf-pagination Bottom` abajo) alrededor de ella.
 *
 * En Registros admite, por configuración de columnas: casillas por fila (`selectableRecords`), cabecera de dos filas
 * para columnas agrupadas (`headerGroup`), columnas fijas a la derecha antes del historial (`sticky` + `stickyWidth`) y
 * una columna con el ícono que abre el documento (`kind: 'document-icon'`). El historial lleva el tooltip «Historial
 * de registro» (o «Historial de documento»).
 *
 * @usar
 * - En las pestañas Documentos / Registros de `siaf-documents-records-page` (plan de cuentas, asiento de ajuste,
 *   catálogo de ajuste, catálogos de eventos, apertura contable y contabilización).
 * - Cuando las columnas vienen de configuración (`DocumentsRecordsColumn` con `kind`, `align` y `widthClass`) y el
 *   panel de columnas decide cuáles se ven.
 * - Con `selectionDisabled` para dejar marcables solo los documentos de la acción masiva: Elaborados para el creador
 *   (Verificar) y Verificados para el aprobador (Aprobar).
 * @evitar
 * - Para un listado de solo lectura con texto plano: `siaf-table`.
 * - Usarla sola, sin barra ni paginado: va dentro de la grilla estándar (`siaf-table-controls` arriba, con el
 *   seleccionar todo, y `siaf-pagination` con `position="Bottom"` y `rowPage` abajo).
 * - Mientras llegan las filas: `siaf-table-skeleton` con las mismas columnas y `minWidthClass`, no la tabla vacía.
 * - Copiar su marcado en otra pantalla: `siaf-tray-documents-view` todavía tiene una tabla parecida hecha a mano.
 * @teclado
 * - **Tab**: recorre, fila por fila, el checkbox (solo en Documentos), el enlace al documento y el botón de historial;
 *   un checkbox deshabilitado queda fuera.
 * - **Espacio**: marca o desmarca el checkbox de la fila (emite `selectionChanged`).
 * - **Enter**: en el enlace, abre el documento (`routerLink`).
 * - **Enter / Espacio**: en el botón de historial, emiten `historyOpened`.
 * @accesibilidad
 * - **1.3.1 Información y relaciones (A)**: `<table>` con `<thead>` y un `<th>` por columna (sin `scope`, que con una
 *   sola fila de cabecera no hace falta); las columnas del checkbox y del historial tienen el `<th>` vacío. No ordena
 *   columnas, así que no aplica `aria-sort`.
 * - **Pendiente · 4.1.2 Nombre, función y valor (A)**: el checkbox de cada fila no tiene nombre (ni `aria-label` ni
 *   `<label>`). El botón de historial sí lleva `aria-label`, pero en Registros dice siempre «Ver historial de cuenta
 *   contable», también en los asientos de ajuste.
 * - **Pendiente · 2.1.1 Teclado (A)**: la fila no es clicable y sus acciones son nativas, pero el texto completo de
 *   las cabeceras y celdas cortadas solo sale con `siafTooltip` al pasar el mouse: esas celdas no reciben foco (el
 *   enlace sí lo muestra al enfocarlo).
 * - **1.4.13 Contenido en hover o foco (AA)**: ese tooltip se cierra con Escape y se puede recorrer con el puntero.
 * - **Pendiente · 1.4.3 Contraste mínimo (AA)**: el enlace va en `text-neutral-high` (16.29:1 / 16.53:1) y «Nuevo» en
 *   blanco sobre `bg-brand-primary` (8.79:1 / 6.67:1), pero la etiqueta Observado de `siaf-flow-status-tag` (también
 *   Pendiente y Fallido) da 3.39:1 en claro, y el enlace en hover (`text-brand-primary`) pinta en oscuro con
 *   `bg-brand-primary` (2.66:1 sobre la superficie).
 * - **1.4.1 Uso del color (A)**: los estados llevan su nombre en la etiqueta y «Nuevo» es texto.
 * - **2.4.7 Foco visible (AA)**: sin estilo propio: enlace, checkbox y botón muestran el anillo nativo del navegador.
 * - **2.5.8 Tamaño del objetivo (AA)**: botón de historial de 32 px; el checkbox mide 16 px, pero cumple por
 *   espaciado (celda de 40 × 58 px).
 */
@Component({
  selector: 'siaf-documents-records-table',
  standalone: true,
  imports: [FlowStatusTagComponent, IconComponent, NgClass, NgTemplateOutlet, RecordStatusTagComponent, RouterLink, TooltipDirective],
  template: `
    <div class="siaf-table-scroll min-w-0">
      <table class="w-full border-collapse text-left text-sm" [ngClass]="minWidthClass">
        <thead>
          <!-- Con columnas agrupadas (headerGroup) hay dos filas de cabecera: el grupo arriba y sus columnas abajo. -->
          <tr class="bg-surface-high text-[10px] font-bold uppercase text-text">
            @if (conCasillas) {
              <th class="w-10 rounded-l-siaf-sm px-siaf-sm py-siaf-sm" [attr.rowspan]="conGrupos ? 2 : null"></th>
            }
            @for (celda of cabeceras; track $index) {
              <!-- MFD RF-01: al superponer el mouse se muestra el texto completo de la columna -->
              @if (celda.grupo) {
                <th class="truncate border-b border-l border-[var(--sys-color-divider-strong)] px-siaf-md py-siaf-sm text-center" siafTooltip [attr.colspan]="celda.columnas.length">{{ celda.grupo }}</th>
              } @else {
                <th class="truncate px-siaf-md py-siaf-sm" siafTooltip [attr.rowspan]="conGrupos ? 2 : null" [ngClass]="[celda.columnas[0].widthClass || 'w-[180px]', celda.columnas[0].align === 'right' ? 'text-right' : celda.columnas[0].align === 'center' ? 'text-center' : 'text-left']">{{ celda.columnas[0].label }}</th>
              }
            }
            @for (column of columnasFijas; track column.key; let i = $index) {
              <th class="sticky truncate border-l border-[var(--sys-color-divider-strong)] bg-surface-high px-siaf-xs py-siaf-sm text-center" siafTooltip [attr.rowspan]="conGrupos ? 2 : null" [style.right.px]="desplazamientoFija(i)" [style.width.px]="column.stickyWidth" [style.min-width.px]="column.stickyWidth">{{ column.label }}</th>
            }
            <th class="sticky right-0 w-14 rounded-r-siaf-sm border-l border-[var(--sys-color-divider-strong)] bg-surface-high px-siaf-sm py-siaf-sm" [attr.rowspan]="conGrupos ? 2 : null"></th>
          </tr>
          @if (conGrupos) {
            <tr class="bg-surface-high text-[10px] font-bold uppercase text-text">
              @for (column of columnasAgrupadas; track column.key) {
                <th class="truncate border-l border-[var(--sys-color-divider-strong)] px-siaf-md py-siaf-sm" siafTooltip [ngClass]="[column.widthClass || 'w-[180px]', column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left']">{{ column.label }}</th>
              }
            </tr>
          }
        </thead>
        <tbody>
          @for (row of rows; track rowTrackValue(row, $index)) {
            <tr class="border-b border-[var(--sys-color-divider-default)] bg-surface hover:bg-[var(--sys-color-bg-states-light-hover)]" [class.h-12]="activeTab === 'records'">
              @if (conCasillas) {
                <td class="h-[58px] px-siaf-sm py-siaf-xs">
                  <input
                    class="size-4 disabled:cursor-not-allowed"
                    type="checkbox"
                    [checked]="row.selected"
                    [disabled]="selectionDisabled(row)"
                    [attr.aria-label]="activeTab === 'records' ? 'Seleccionar registro' : null"
                    (change)="onSelectionChange(row, $event)"
                  />
                </td>
              }
              @for (column of columnasNormales; track column.key) {
                <td class="px-siaf-md py-siaf-sm" [class.border-l]="column.headerGroup" [class.border-[var(--sys-color-divider-default)]]="column.headerGroup" [ngClass]="[column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left', column.kind === 'document-link' ? 'max-w-[440px]' : '']">
                  <ng-container *ngTemplateOutlet="celda; context: { column: column, row: row }" />
                </td>
              }
              @for (column of columnasFijas; track column.key; let i = $index) {
                <td class="sticky border-l border-[var(--sys-color-divider-strong)] bg-surface py-siaf-sm" [class.px-siaf-md]="column.kind !== 'document-icon'" [class.px-siaf-xs]="column.kind === 'document-icon'" [style.right.px]="desplazamientoFija(i)" [style.width.px]="column.stickyWidth" [style.min-width.px]="column.stickyWidth" [class.text-center]="column.kind === 'document-icon'">
                  <ng-container *ngTemplateOutlet="celda; context: { column: column, row: row }" />
                </td>
              }
              <td class="sticky right-0 border-l border-[var(--sys-color-divider-strong)] bg-surface px-siaf-sm py-siaf-xs">
                <button class="inline-flex size-8 items-center justify-center rounded-siaf-md transition hover:bg-surface-muted active:bg-[var(--sys-color-bg-states-dark-pressed)]" type="button" [attr.aria-label]="textoHistorial" [siafTooltip]="textoHistorial" tooltipMode="always" (click)="historyOpened.emit(row)">
                  <siaf-icon name="history" [size]="20" />
                </button>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>

    <ng-template #celda let-column="column" let-row="row">
      @if (column.kind === 'document-link') {
        <span class="flex min-w-0 items-center gap-siaf-xs">
          <a class="min-w-0 flex-1 truncate text-sm leading-normal text-text hover:text-brand-primary" siafTooltip [routerLink]="documentRoute(row)" (click)="onDocumentClick(row)">{{ row[column.key] }}</a>
          @if (row['isNew']) {
            <span class="inline-flex shrink-0 items-center rounded-full bg-brand-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Nuevo</span>
          }
        </span>
      } @else if (column.kind === 'document-icon') {
        <a class="inline-flex size-8 items-center justify-center rounded-siaf-md text-[var(--sys-color-icon-states-enabled)] transition hover:bg-surface-muted" [routerLink]="documentRoute(row)" aria-label="Ver documento" siafTooltip="Ver documento" tooltipMode="always" (click)="onDocumentClick(row)">
          <siaf-icon name="description" [size]="24" />
        </a>
      } @else if (column.kind === 'flow-status') {
        <siaf-flow-status-tag [status]="flowStatus(row[column.key])" size="small" />
      } @else if (column.kind === 'record-status') {
        <siaf-record-status-tag [status]="recordStatus(row[column.key])" [size]="activeTab === 'records' ? 'small' : 'standard'" />
      } @else {
        <span class="block truncate" siafTooltip>{{ row[column.key] }}</span>
      }
    </ng-template>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocumentsRecordsTableComponent implements OnChanges {
  private readonly notificationsState = inject(NotificationsStateService);

  @Input() activeTab: DocumentsRecordsTab = 'documents';
  @Input() columns: DocumentsRecordsColumn[] = [];
  /** Casillas también en Registros (en Documentos siempre están). */
  @Input() selectableRecords = false;

  /** Columnas que se desplazan, sin las fijas a la derecha. */
  columnasNormales: DocumentsRecordsColumn[] = [];
  /** Columnas fijas a la derecha (`sticky`), antes de la de historial. */
  columnasFijas: DocumentsRecordsColumn[] = [];
  /** Primera fila de cabecera: un grupo con sus columnas o una columna suelta. */
  cabeceras: { grupo?: string; columnas: DocumentsRecordsColumn[] }[] = [];
  /** Columnas con grupo, en el orden de la segunda fila de cabecera. */
  columnasAgrupadas: DocumentsRecordsColumn[] = [];
  conGrupos = false;

  /** Ancho del botón de historial (`w-14`): las columnas fijas se apilan a su izquierda. */
  private static readonly ANCHO_HISTORIAL = 56;

  ngOnChanges(): void {
    this.columnasNormales = this.columns.filter((c) => c.sticky !== 'right');
    this.columnasFijas = this.columns.filter((c) => c.sticky === 'right');
    this.columnasAgrupadas = this.columnasNormales.filter((c) => c.headerGroup);
    this.conGrupos = this.columnasAgrupadas.length > 0;
    this.cabeceras = [];
    for (const columna of this.columnasNormales) {
      const anterior = this.cabeceras[this.cabeceras.length - 1];
      if (columna.headerGroup && anterior?.grupo === columna.headerGroup) anterior.columnas.push(columna);
      else this.cabeceras.push({ grupo: columna.headerGroup, columnas: [columna] });
    }
  }

  get conCasillas(): boolean {
    return this.activeTab === 'documents' || this.selectableRecords;
  }

  get textoHistorial(): string {
    return this.activeTab === 'records' ? 'Historial de registro' : 'Historial de documento';
  }

  /** Distancia al borde derecho de la columna fija `indice`: el historial y las fijas que van después de ella. */
  desplazamientoFija(indice: number): number {
    return this.columnasFijas.slice(indice + 1).reduce((total, c) => total + (c.stickyWidth ?? 0), DocumentsRecordsTableComponent.ANCHO_HISTORIAL);
  }
  @Input() rows: DocumentsRecordsRow[] = [];
  @Input() minWidthClass = '';
  @Input() recordTrackKey = '';
  @Input() documentRoute: (row: DocumentsRecordsRow) => string = () => '';
  @Input() selectionDisabled: (row: DocumentsRecordsRow) => boolean = () => false;

  @Output() selectionChanged = new EventEmitter<DocumentsRecordsSelectionChange>();
  @Output() historyOpened = new EventEmitter<DocumentsRecordsRow>();

  rowTrackValue(row: DocumentsRecordsRow, index: number): string | number {
    const key = this.activeTab === 'documents' ? 'number' : this.recordTrackKey;
    const value = row[key];
    // Si el valor está vacío o es placeholder ("—", "-"), usar index para evitar colisiones
    if (!value || value === '—' || value === '-') {
      return `idx-${index}`;
    }
    return String(value);
  }

  onDocumentClick(row: DocumentsRecordsRow): void {
    const documentId = row['documentId'];
    if (typeof documentId === 'string' && documentId) {
      void this.notificationsState.marcarLeidaPorDocumento(documentId);
    }
  }

  onSelectionChange(row: DocumentsRecordsRow, event: Event): void {
    this.selectionChanged.emit({
      row,
      selected: (event.target as HTMLInputElement).checked
    });
  }

  recordStatus(value: unknown): RecordStatus {
    const statuses: RecordStatus[] = ['Activo', 'Inactivo', 'Anulado', 'En Proceso', 'Validado', 'Eliminado', 'Abierto', 'Cerrado', 'Procesado'];
    return statuses.includes(value as RecordStatus) ? (value as RecordStatus) : 'Activo';
  }

  flowStatus(value: unknown): FlowStatus {
    const statuses: FlowStatus[] = [
      'Elaborado',
      'Registrado',
      'Verificado',
      'Validado',
      'Revisado',
      'Generado',
      'En proceso',
      'Autorizado',
      'Firmado',
      'Aprobado',
      'Aceptado',
      'Publicado',
      'Procesado',
      'Observado',
      'Pendiente',
      'Fallido',
      'Eliminado',
      'Rechazado',
      'Anulado'
    ];

    return statuses.includes(value as FlowStatus) ? (value as FlowStatus) : 'Elaborado';
  }
}

