import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, computed, inject, signal } from '@angular/core';

import { SolicitudResponse, SolicitudesApiService } from '../../../../../core/api/solicitudes-api.service';
import { ActionTrackerComponent, ActionTrackerSummary } from '../../../../../shared/ui/action-tracker/action-tracker.component';
import { FocoDirective } from '../../../../../shared/ui/foco/foco.directive';
import { IconComponent } from '../../../../../shared/ui/icon/icon.component';
import { RecordStatusTagComponent } from '../../../../../shared/ui/record-status-tag/record-status-tag.component';
import { SidePanelAnimacion } from '../../../../../shared/ui/side-panel-animacion';
import { StepItem, StepsComponent } from '../../../../../shared/ui/steps/steps.component';
import { SummaryCardComponent, SummaryCardField } from '../../../../../shared/ui/summary-card/summary-card.component';
import { AnuncioRegistro, NOMBRE_DOCUMENTO } from '../../models/anuncio-contratacion-futura.model';

/**
 * Panel lateral a pantalla completa «Historial del registro» de un anuncio de contratación futura (Figma 21081:43131),
 * que abre `AnunciosDocumentsComponent` desde el botón de historial de la pestaña Registros.
 *
 * Muestra la versión de creación del registro (N° de creación, tipo de acción y fecha) junto con el documento que lo
 * creó, el anuncio tal como se aprobó (contratación segmentada, datos de la contratación y convocatoria) y quién lo
 * elaboró, verificó y aprobó (`siaf-action-tracker`). Es de solo lectura; se cierra con la X, el fondo o Escape.
 *
 * Con `open` pide la solicitud del registro para armar la trazabilidad; el resto sale del propio `registro`.
 */
@Component({
  selector: 'siaf-anuncio-registro-history-panel',
  standalone: true,
  imports: [ActionTrackerComponent, FocoDirective, IconComponent, NgTemplateOutlet, RecordStatusTagComponent, StepsComponent, SummaryCardComponent],
  template: `
    @if (anim.visible()) {
      <section
        class="siaf-sidepanel-overlay fixed inset-y-0 left-0 right-0 z-50 bg-black/55 pl-0 lg:pl-[65px]"
        [class.cerrando]="anim.cerrando()"
        aria-modal="true"
        role="dialog"
        aria-labelledby="anuncio-history-title"
        (click)="closed.emit()"
      >
        <aside class="flex h-screen w-full flex-col overflow-hidden bg-surface text-text shadow-siaf-lg lg:rounded-l-siaf-md" [siafFoco]="open" (siafFocoEscape)="closed.emit()" (click)="$event.stopPropagation()">
          <header class="flex h-14 shrink-0 items-center gap-siaf-xs px-siaf-md">
            <h2 id="anuncio-history-title" class="m-0 min-w-0 flex-1 text-base font-bold uppercase leading-normal tracking-[0.02px] text-text">Historial del registro</h2>
            <button class="inline-flex size-10 items-center justify-center rounded-siaf-md text-text transition hover:bg-surface-muted active:bg-[var(--sys-color-bg-states-light-pressed)]" type="button" aria-label="Cerrar historial del registro" (click)="closed.emit()">
              <siaf-icon name="close" [size]="24" />
            </button>
          </header>

          <div class="min-h-0 flex-1 overflow-y-auto border-y border-[var(--sys-color-divider-strong)] bg-surface">
            @if (registro; as r) {
              <div class="mx-auto grid min-h-full w-full max-w-[1160px] grid-cols-1 gap-[64px] px-siaf-md py-siaf-md sm:px-siaf-xl lg:grid-cols-[210px_minmax(0,890px)] lg:px-0">
                <aside class="hidden lg:block">
                  <!-- Versiones del registro: hoy solo la de creación. -->
                  <siaf-steps class="sticky top-siaf-md block" variant="cards" [steps]="versiones()" [activeStep]="1" />
                </aside>

                <section class="flex min-w-0 flex-col gap-siaf-sm">
                  <section class="rounded-siaf-md border border-[var(--sys-color-divider-strong)] bg-surface px-siaf-lg py-siaf-md">
                    <ng-container [ngTemplateOutlet]="campoPlano" [ngTemplateOutletContext]="{ etiqueta: 'Documento', valor: nombreDocumento }" />
                    <div class="mt-siaf-lg grid gap-siaf-md md:grid-cols-3">
                      <ng-container [ngTemplateOutlet]="campoPlano" [ngTemplateOutletContext]="{ etiqueta: 'Nro de documento', valor: r.numeroDocumento }" />
                      <ng-container [ngTemplateOutlet]="campoPlano" [ngTemplateOutletContext]="{ etiqueta: 'Tipo de acción', valor: 'Creación' }" />
                      <div class="flex min-w-0 flex-col gap-siaf-xxs">
                        <span class="text-[11px] font-medium uppercase leading-none tracking-[0.66px] text-text-muted">Estado del registro</span>
                        <siaf-record-status-tag [status]="r.estado" size="small" />
                      </div>
                    </div>
                  </section>

                  <section class="rounded-siaf-md border border-[var(--sys-color-divider-strong)] bg-surface px-siaf-xl py-siaf-xl">
                    <header class="mb-siaf-xl">
                      <h2 class="m-0 text-base font-bold uppercase leading-normal tracking-[0.02px] text-text">Anuncio de contratación futura</h2>
                    </header>

                    <div class="flex flex-col gap-siaf-xl">
                      <section class="flex flex-col gap-siaf-md">
                        <ng-container [ngTemplateOutlet]="tituloSeccion" [ngTemplateOutletContext]="{ titulo: 'Contratación segmentada' }" />
                        <siaf-summary-card [fields]="camposContratacion()" [showIndicator]="true" [bordered]="true" [showClose]="false" />
                      </section>

                      <section class="flex flex-col gap-siaf-md">
                        <ng-container [ngTemplateOutlet]="tituloSeccion" [ngTemplateOutletContext]="{ titulo: 'Datos de la contratación' }" />
                        <div class="grid gap-siaf-md md:grid-cols-[320px_1fr]">
                          <ng-container [ngTemplateOutlet]="campoLectura" [ngTemplateOutletContext]="{ etiqueta: 'Tipo de procedimiento', valor: r.tipoProcedimiento }" />
                        </div>
                        <ng-container [ngTemplateOutlet]="campoLectura" [ngTemplateOutletContext]="{ etiqueta: 'Alcance (especificaciones técnicas preliminares)', valor: r.alcance }" />
                        <div class="grid gap-siaf-md md:grid-cols-2">
                          <ng-container [ngTemplateOutlet]="campoLectura" [ngTemplateOutletContext]="{ etiqueta: 'Plazo de entrega/ejecución (días calendario)', valor: '' + r.plazoEntrega }" />
                          @if (r.cantidadAproximada !== null) {
                            <ng-container [ngTemplateOutlet]="campoLectura" [ngTemplateOutletContext]="{ etiqueta: 'Cantidad aproximada', valor: cantidadTexto(r.cantidadAproximada) }" />
                          }
                        </div>
                      </section>

                      <section class="flex flex-col gap-siaf-md">
                        <ng-container [ngTemplateOutlet]="tituloSeccion" [ngTemplateOutletContext]="{ titulo: 'Convocatoria' }" />
                        <div class="grid gap-siaf-md md:grid-cols-[320px_1fr]">
                          <ng-container [ngTemplateOutlet]="campoLectura" [ngTemplateOutletContext]="{ etiqueta: 'Fecha aproximada de convocatoria', valor: fechaCorta(r.fechaConvocatoria) }" />
                        </div>
                      </section>
                    </div>
                  </section>

                  <section class="rounded-siaf-md border border-[var(--sys-color-divider-strong)] bg-surface">
                    <siaf-action-tracker [summaryItems]="trazabilidad()" />
                  </section>
                </section>
              </div>
            }
          </div>

          <ng-template #campoPlano let-etiqueta="etiqueta" let-valor="valor">
            <div class="min-w-0">
              <span class="block text-[11px] font-medium uppercase leading-none tracking-[0.66px] text-text-muted">{{ etiqueta }}</span>
              <span class="mt-siaf-xs block text-sm font-normal leading-normal text-text">{{ valor }}</span>
            </div>
          </ng-template>

          <!-- Campo de solo lectura: borde con la etiqueta montada sobre él, como un campo de texto del kit. -->
          <ng-template #campoLectura let-etiqueta="etiqueta" let-valor="valor">
            <div class="relative min-h-10 min-w-0 rounded-siaf-md border border-[var(--sys-color-border-states-enabled)] px-siaf-md py-siaf-xs">
              <span class="absolute -top-[9px] left-[13px] bg-surface px-siaf-xxs text-xs font-medium leading-normal text-[var(--sys-color-text-neutral-low)]">{{ etiqueta }}</span>
              <p class="m-0 py-[3px] text-sm leading-normal tracking-[0.025px] text-[var(--sys-color-text-neutral-medium)]">{{ valor }}</p>
            </div>
          </ng-template>

          <ng-template #tituloSeccion let-titulo="titulo">
            <div class="flex min-h-10 items-center">
              <h3 class="m-0 text-sm font-bold uppercase leading-normal tracking-[0.02px] text-text">{{ titulo }}</h3>
            </div>
          </ng-template>
        </aside>
      </section>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnuncioRegistroHistoryPanelComponent implements OnChanges {
  private readonly solicitudesApi = inject(SolicitudesApiService);

  @Input() open = false;
  @Input() registro: AnuncioRegistro | null = null;

  @Output() closed = new EventEmitter<void>();

  readonly nombreDocumento = NOMBRE_DOCUMENTO;
  /** Render animado del panel (entrada/salida por la derecha, 300 ms). */
  readonly anim = new SidePanelAnimacion();
  private readonly solicitud = signal<SolicitudResponse | null>(null);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']) this.anim.actualizar(this.open);
    if (changes['open'] && this.open && this.registro) {
      this.solicitud.set(null);
      this.solicitudesApi.obtenerDetalle(this.registro.documentoId).subscribe({ next: (s) => this.solicitud.set(s) });
    }
  }

  /** Versiones del registro para la columna de `siaf-steps`: hoy solo la de creación. */
  readonly versiones = computed<StepItem[]>(() => {
    const fecha = this.solicitud()?.fechaRegistro ?? this.registro?.fechaRegistro;
    return [{
      label: 'Creación',
      fields: [
        { label: 'N° Creación', value: this.registro?.numeroDocumento ?? '--' },
        { label: 'Tipo de acción', value: 'Creación' },
        { label: 'Fecha', value: fecha ? this.fechaHora(new Date(fecha), '2-digit') : '--' },
      ],
    }];
  });

  readonly camposContratacion = computed<SummaryCardField[]>(() => {
    const r = this.registro;
    if (!r) return [];
    return [
      { label: 'Código', value: r.contratacionCodigo },
      { label: 'Descripción', value: r.descripcion.toUpperCase() },
      { label: 'Objeto de contratación', value: r.objeto.toUpperCase() },
      { label: 'Origen', value: r.origen },
    ];
  });

  /** Quién elaboró, verificó y aprobó la solicitud que creó el registro (la última vez que pasó por cada estado). */
  readonly trazabilidad = computed<ActionTrackerSummary[]>(() => {
    const historial = this.solicitud()?.historialEstados ?? [];
    const quien = (estado: string, label: string): ActionTrackerSummary => {
      const h = [...historial].reverse().find((x) => x.estadoNuevo === estado);
      if (!h) return { label, actionBy: 'No asignado aún', date: 'Fecha y hora no registradas' };
      const nombre = h.creador ? `${h.creador.nombres} ${h.creador.apellidoPaterno} ${h.creador.apellidoMaterno}`.trim().toUpperCase() : '--';
      return { label, actionBy: nombre, date: this.fechaHora(new Date(h.createdAt), 'numeric') };
    };
    return [quien('ELABORADO', 'Elaborado por'), quien('VERIFICADO', 'Verificado por'), quien('APROBADO', 'Aprobado por')];
  });

  fechaCorta(iso: string): string {
    return iso.split('-').reverse().join('/');
  }

  cantidadTexto(cantidad: number): string {
    return cantidad.toLocaleString('en-US');
  }

  /** `19/08/25   08:00:59`: fecha y hora separadas por espacios, como en el diseño. */
  private fechaHora(fecha: Date, anio: '2-digit' | 'numeric'): string {
    const dia = fecha.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: anio });
    const hora = fecha.toLocaleTimeString('es-PE', { hour12: false });
    return `${dia}   ${hora}`;
  }
}
