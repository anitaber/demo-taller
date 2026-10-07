import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

import { CatalogosApiService, TipoDocumentoResponse } from '../../../../../core/api/catalogos-api.service';
import { SolicitudResponse, SolicitudesApiService } from '../../../../../core/api/solicitudes-api.service';
import { CurrentUserService } from '../../../../../core/auth/current-user.service';
import { PermissionService } from '../../../../../core/auth/permission.service';
import { ESTADO, MOTIVOS_RECHAZO } from '../../../../../core/models/documento.model';
import { SolicitudesFacadeService } from '../../../../../core/state/solicitudes-facade.service';
import { BreadcrumbItem } from '../../../../../shared/components/breadcrumb/breadcrumb.component';
import { DetailHistoryTabsComponent } from '../../../../../shared/components/detail-history-tabs/detail-history-tabs.component';
import { HistorialSource, buildCurrentComment, buildHistoryEntries } from '../../../../../shared/components/detail-history-tabs/detail-history-tabs.utils';
import { ModalComponent } from '../../../../../shared/ui/modal/modal.component';
import { PaginationComponent } from '../../../../../shared/components/pagination/pagination.component';
import { RequestApprovalModalsComponent } from '../../../../../shared/components/request-approval-modals/request-approval-modals.component';
import { SelectionSideNavComponent } from '../../../../../shared/components/selection-side-nav/selection-side-nav.component';
import { SolicitudeFormCardComponent } from '../../../../../shared/components/solicitude-form-card/solicitude-form-card.component';
import { SolicitudeHeaderState } from '../../../../../shared/components/solicitude-header/solicitude-header.component';
import { SolicitudeInfoCardComponent, SolicitudeInfoField } from '../../../../../shared/components/solicitude-info-card/solicitude-info-card.component';
import { SolicitudePageLayoutComponent } from '../../../../../shared/components/solicitude-page-layout/solicitude-page-layout.component';
import { TableControlsComponent } from '../../../../../shared/components/table-controls/table-controls.component';
import { TimelineComponent } from '../../../../../shared/components/timeline/timeline.component';
import { TimelineItem } from '../../../../../shared/components/timeline/timeline.model';
import { ActionTrackerComponent, ActionTrackerSummary } from '../../../../../shared/ui/action-tracker/action-tracker.component';
import { ButtonComponent } from '../../../../../shared/ui/button/button.component';
import { DateTimePickerComponent } from '../../../../../shared/ui/date-time-picker/date-time-picker.component';
import { DocumentSummaryCardComponent } from '../../../../../shared/ui/document-summary-card/document-summary-card.component';
import { FlowStatus } from '../../../../../shared/ui/flow-status-tag/flow-status-tag.component';
import { IconComponent } from '../../../../../shared/ui/icon/icon.component';
import { PopoverComponent } from '../../../../../shared/ui/popover/popover.component';
import { ReadonlyFieldComponent } from '../../../../../shared/ui/readonly-field/readonly-field.component';
import { SnackbarVariant } from '../../../../../shared/ui/snackbar/snackbar.component';
import { SummaryCardComponent, SummaryCardField } from '../../../../../shared/ui/summary-card/summary-card.component';
import { TextAreaControlComponent } from '../../../../../shared/ui/text-area-control/text-area-control.component';
import { TextFieldComponent, TextFieldOption } from '../../../../../shared/ui/text-field/text-field.component';
import { buildProcessBreadcrumbs } from '../../../../../shared/utils/breadcrumbs.util';
import { crearSnapshotFormulario, hayCambiosRespectoAlSnapshot } from '../../../../../shared/utils/form-snapshot.util';
import { AnunciosApiService } from '../../api/anuncios-api.service';
import { PROCESS_ID, PROCESS_ROUTE, REQUEST_SEGMENT } from '../../config/anuncio-contratacion-futura.rutas';
import { AnuncioItemDatos, CODIGO_DOCUMENTO, NOMBRE_DOCUMENTO } from '../../models/anuncio-contratacion-futura.model';
import {
  COLUMNAS_CONTRATACION,
  CONTRATACIONES_SEGMENTADAS,
  ContratacionSegmentada,
  OPCIONES_MODIFICACION_CMN,
  llevaCantidadAproximada,
  origenTexto,
  OPCIONES_OBJETO,
  OPCIONES_ORIGEN,
} from '../../models/contratacion-segmentada.model';

type FiltrosContratacion = { objeto: string; origen: string; modificacionCmn: string };
const SIN_FILTROS: FiltrosContratacion = { objeto: '', origen: '', modificacionCmn: '' };

/**
 * Solicitud de anuncio de contratación futura (SACF), proceso «Actuaciones preparatorias».
 *
 * El creador arma uno o más anuncios con «+»: elige una contratación segmentada con la lupa (panel con búsqueda,
 * paginación y filtros por objeto, origen y N° de modificación del CMN), completa alcance, plazo de entrega y fecha de
 * convocatoria, y «Aceptar» lo suma a la grilla. Grabar guarda los anuncios y elabora la solicitud (genera el número);
 * después el creador la verifica y el aprobador la aprueba, observa o rechaza; al aprobarse, cada anuncio pasa a los
 * registros. Todo el estado vive en signals y la cabecera se deriva del estado del documento, igual que en la
 * solicitud de ejemplo de cuentas bancarias.
 */
@Component({
  selector: 'siaf-anuncio-contratacion-futura',
  standalone: true,
  imports: [
    ActionTrackerComponent,
    ButtonComponent,
    DateTimePickerComponent,
    DetailHistoryTabsComponent,
    DocumentSummaryCardComponent,
    IconComponent,
    PopoverComponent,
    ReadonlyFieldComponent,
    RequestApprovalModalsComponent,
    SelectionSideNavComponent,
    SolicitudeFormCardComponent,
    SolicitudeInfoCardComponent,
    SolicitudePageLayoutComponent,
    SummaryCardComponent,
    ModalComponent,
    PaginationComponent,
    TableControlsComponent,
    TextAreaControlComponent,
    TextFieldComponent,
    TimelineComponent,
  ],
  template: `
    <div class="min-h-[calc(100vh-56px)] bg-[var(--sys-color-bg-surfaces-surface-lowest)] text-text">
      <!-- La cabecera (migas, título, estado y botones según rol y estado) la pinta el layout de solicitudes. -->
      <siaf-solicitude-page-layout
        [breadcrumbs]="breadcrumbs"
        [role]="headerRole()"
        [state]="headerState()"
        [loading]="cargando()"
        [heading]="heading"
        secondaryText="Creación"
        [showReturn]="true"
        [showButtonGroup]="mostrarAcciones()"
        [saveDisabled]="!formValido() || saving()"
        [verifyDisabled]="!puedeVerificar() || cargando()"
        (returned)="regresar()"
        (canceled)="modalCancelarSolicitud.set(true)"
        (saved)="modalGrabar.set(true)"
        (edited)="editar()"
        (verified)="modalVerificar.set(true)"
        (deleted)="modalEliminar.set(true)"
        (approved)="abrirAprobar()"
        (observed)="abrirObservar()"
        (rejected)="abrirRechazar()"
      >
        @if (elaborado()) {
          <section class="grid gap-siaf-md lg:grid-cols-[1fr_360px]">
            <siaf-solicitude-info-card [fields]="camposEntidad()" />
            <siaf-document-summary-card [documentNumber]="numeroDocumento()" [status]="estadoDocumento()" />
          </section>
        } @else {
          <siaf-solicitude-info-card [fields]="camposEntidad()" [captureOpenDate]="true" />
        }

        <siaf-timeline
          title="Seguimiento del proceso de Actuaciones preparatorias"
          processName="Actuaciones preparatorias"
          itemLabel="procedimiento"
          itemsLabel="procedimientos"
          [items]="etapas()"
          [current]="etapaActual()"
          [fillCurrent]="false"
        />

        <siaf-solicitude-form-card [title]="registrando() ? 'Registro de anuncio de contratación futura' : 'Anuncio de contratación futura'">
          <div card-actions class="flex items-center gap-siaf-sm">
            @if (registrando()) {
              <siaf-button variant="outline" size="md" (click)="modalCancelar.set(true)">Cancelar</siaf-button>
              <siaf-button variant="filled" size="md" [disabled]="!registroCompleto()" (click)="agregarItem()">Aceptar</siaf-button>
            } @else if (!soloLectura()) {
              <siaf-button variant="accent" size="md" icon="add" [iconOnly]="true" ariaLabel="Agregar anuncio de contratación futura" (click)="registrando.set(true)" />
            }
          </div>

          @if (registrando()) {
            <div class="flex flex-col gap-siaf-sm">
              <div class="flex min-h-10 items-center justify-between gap-siaf-md">
                <h3 class="m-0 text-sm font-bold uppercase text-text">Contratación segmentada</h3>
                <siaf-button variant="accent" size="md" icon="search" [iconOnly]="true" ariaLabel="Seleccionar tipo de contratación" [disabled]="!!contratacion()" (click)="abrirPanel()" />
              </div>
              @if (contratacion()) {
                <siaf-summary-card
                  [fields]="camposContratacion()"
                  [bordered]="true"
                  closeLabel="Quitar contratación segmentada"
                  (closed)="modalQuitar.set(true)"
                />
              } @else {
                <div class="flex min-h-[49px] items-center rounded-siaf-md bg-[var(--sys-color-bg-surfaces-surface-low)] px-siaf-md py-siaf-sm">
                  <p class="m-0 text-sm text-[var(--sys-color-text-neutral-medium)]">No se ha seleccionado ningún tipo. Haga clic en el botón para realizar una selección.</p>
                </div>
              }
            </div>

            @if (contratacion(); as c) {
              <div class="flex flex-col gap-siaf-md">
                <h3 class="m-0 text-sm font-bold uppercase text-text">Datos de la contratación</h3>
                @if (c.origen === 'CMN') {
                  <!-- Con origen CMN el tipo de procedimiento se elige: la lista es la del objeto de la contratación. -->
                  <siaf-input
                    class="block w-full md:w-1/2"
                    label="Tipo de procedimiento"
                    type="select"
                    [required]="true"
                    [options]="opcionesTipoProcedimiento()"
                    [value]="tipoProcedimientoCmn()"
                    (valueChange)="tipoProcedimientoCmn.set('' + $any($event))"
                  />
                } @else {
                  <readonly-field caption="Tipo de procedimiento" [value]="c.tipoProcedimiento" />
                }
                <text-area-control
                  placeholder="Alcance (Especificaciones Técnicas Preliminares)"
                  [maxlength]="1000"
                  [value]="alcance()"
                  (valueChange)="alcance.set($event)"
                />
                <div class="grid items-center gap-siaf-md md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <div class="relative">
                    <!-- Sin las flechas del número: se superponen con el ícono de ayuda. -->
                    <siaf-input
                      class="block [&_input]:[appearance:textfield] [&_input::-webkit-inner-spin-button]:appearance-none [&_input::-webkit-outer-spin-button]:appearance-none"
                      label="Plazo entrega (días calendario)"
                      type="number"
                      [value]="plazoEntrega()"
                      (valueChange)="plazoEntrega.set('' + $any($event))"
                    />
                    <siaf-popover
                      class="absolute right-siaf-md top-3"
                      position="top"
                      [focusOnOpen]="false"
                      align="end"
                      [open]="ayudaAbierta() === 'plazo'"
                      title="Plazo entrega (días calendario)"
                      text="Indica el número de días calendario previstos para la entrega del bien."
                      (closed)="cerrarAyuda()"
                      (mouseenter)="abrirAyuda('plazo')"
                      (mouseleave)="cerrarAyudaConDemora()"
                    >
                      <button
                        popover-trigger
                        class="grid size-6 place-items-center rounded-full text-[var(--sys-color-icon-states-enabled)] focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sys-color-border-states-focus)]"
                        type="button"
                        aria-label="Ayuda: plazo de entrega"
                        [attr.aria-expanded]="ayudaAbierta() === 'plazo'"
                        (focus)="abrirAyuda('plazo')"
                        (blur)="cerrarAyuda()"
                        (click)="abrirAyuda('plazo')"
                      >
                        <siaf-icon name="info" [size]="24" />
                      </button>
                    </siaf-popover>
                  </div>
                  @if (llevaCantidad(c.objeto)) {
                    <readonly-field caption="Cantidad aproximada" [value]="cantidadTexto(c)" />
                  }
                </div>
              </div>

              <div class="flex flex-col gap-siaf-md">
                <h3 class="m-0 text-sm font-bold uppercase text-text">Convocatoria</h3>
                <div class="grid items-center gap-siaf-md md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div class="flex items-center gap-siaf-sm">
                  <siaf-date-time-picker
                    class="min-w-0 flex-1"
                    label="Fecha aproximada de convocatoria"
                    position="top"
                    [fullWidth]="true"
                    [defaultToToday]="false"
                    [minDate]="hoy"
                    [error]="errorFechaConvocatoria()"
                    [value]="fechaConvocatoria()"
                    (valueChange)="fechaConvocatoria.set($event)"
                  />
                  <siaf-popover
                    class="shrink-0"
                    position="top"
                    [focusOnOpen]="false"
                    [align]="alineacionAyudaFecha()"
                    [open]="ayudaAbierta() === 'fecha'"
                    title="Fecha aproximada de convocatoria"
                    text="Debe considerar un plazo mínimo de 40 días calendario entre la aprobación del Anuncio de Contratación Futura y la fecha aproximada de convocatoria."
                    (closed)="cerrarAyuda()"
                    (mouseenter)="abrirAyuda('fecha')"
                    (mouseleave)="cerrarAyudaConDemora()"
                  >
                    <button
                      popover-trigger
                      class="grid size-6 place-items-center rounded-full text-[var(--sys-color-icon-states-enabled)] focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sys-color-border-states-focus)]"
                      type="button"
                      aria-label="Ayuda: fecha aproximada de convocatoria"
                      [attr.aria-expanded]="ayudaAbierta() === 'fecha'"
                      (focus)="abrirAyuda('fecha')"
                      (blur)="cerrarAyuda()"
                      (click)="abrirAyuda('fecha')"
                    >
                      <siaf-icon name="info" [size]="24" />
                    </button>
                  </siaf-popover>
                </div>
                <readonly-field caption="Días de anticipación" [value]="diasAnticipacion() === null ? '—' : diasAnticipacion() + ' días'" />
                </div>
              </div>
            }
          } @else if (items().length > 0) {
            <siaf-input label="Buscar" [value]="busquedaItems()" (valueChange)="buscarItems($any($event))" />

            <siaf-table-controls
              selectAllLabel="Seleccionar anuncios"
              editLabel="Editar"
              [deleteLabel]="seleccionItems().length > 1 ? 'Borrar items' : 'Borrar item'"
              [checked]="todosSeleccionados()"
              [indeterminate]="algunoSeleccionado()"
              [selectedCount]="seleccionItems().length"
              [showSelection]="!soloLectura()"
              [showEditAction]="!soloLectura() && puedeModificar()"
              [editDisabled]="seleccionItems().length !== 1"
              [showDeleteAction]="!soloLectura() && puedeModificar()"
              (edit)="editarSeleccionado()"
              [page]="paginaItems()"
              [pageSize]="filasPorPaginaItems()"
              [totalItems]="itemsFiltrados().length"
              [totalPages]="totalPaginasItems()"
              (selectionChange)="seleccionarTodos($event)"
              (delete)="modalBorrarItem.set(true)"
              (previous)="paginaItems.set(paginaItems() - 1)"
              (next)="paginaItems.set(paginaItems() + 1)"
            />

            <div class="siaf-table-scroll min-w-0">
              <table class="w-full border-collapse text-left text-sm">
                <thead>
                  <tr class="h-10 bg-[var(--sys-color-bg-surfaces-surface-high)] text-xs font-bold uppercase text-text">
                    @if (!soloLectura()) {
                      <th class="w-12 rounded-l-siaf-sm px-siaf-sm"></th>
                    }
                    <th class="px-siaf-md py-siaf-sm" [class.rounded-l-siaf-sm]="soloLectura()">Descripción</th>
                    <th class="w-[260px] rounded-r-siaf-sm px-siaf-md py-siaf-sm">Fec. aprox. convocatoria</th>
                  </tr>
                </thead>
                <tbody>
                  @for (item of itemsPagina(); track item.id) {
                    <tr class="h-[58px] border-b border-[var(--sys-color-divider-default)] text-[var(--sys-color-text-neutral-medium)]" [class.bg-[var(--sys-color-bg-states-light-selected)]]="!soloLectura() && estaSeleccionado(item.id)">
                      @if (!soloLectura()) {
                        <td class="px-siaf-sm">
                          <input
                            class="size-4 accent-brand-primary"
                            type="checkbox"
                            [checked]="estaSeleccionado(item.id)"
                            [attr.aria-label]="'Seleccionar anuncio ' + item.contratacionCodigo"
                            (change)="alternarSeleccion(item.id)"
                          />
                        </td>
                      }
                      <td class="px-siaf-md py-siaf-sm uppercase">{{ item.descripcion }}</td>
                      <td class="px-siaf-md py-siaf-sm">{{ fechaCorta(item.fechaConvocatoria) }}</td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="3" class="px-siaf-md py-siaf-lg text-center text-text-muted">No se encontraron resultados.</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <siaf-pagination
              navigation="Activate"
              position="Bottom"
              [rowPage]="true"
              [page]="paginaItems()"
              [pageSize]="filasPorPaginaItems()"
              [totalItems]="itemsFiltrados().length"
              [totalPages]="totalPaginasItems()"
              [rowsPerPage]="filasPorPaginaItems()"
              [rowsPerPageOptions]="opcionesFilas"
              (previous)="paginaItems.set(paginaItems() - 1)"
              (next)="paginaItems.set(paginaItems() + 1)"
              (rowsPerPageChange)="cambiarFilasItems($event)"
            />
          } @else {
            <div class="flex min-h-[49px] items-center rounded-siaf-md bg-[var(--sys-color-bg-surfaces-surface-low)] px-siaf-md py-siaf-sm">
              <p class="m-0 text-sm text-[var(--sys-color-text-neutral-medium)]">Por favor, haga clic en el botón (+) para seleccionar una opción.</p>
            </div>
          }
        </siaf-solicitude-form-card>

        <!-- ── Comentarios del aprobador y trazabilidad ── -->
        @if (historial().length > 0 || comentarioActual()) {
          <siaf-detail-history-tabs [comentario]="comentarioActual()" [entries]="historial()" />
        }

        @if (numeroDocumento()) {
          <siaf-action-tracker [showSummaryCards]="true" [showTabs]="false" [summaryItems]="trazabilidad()" />
        }
      </siaf-solicitude-page-layout>

      <siaf-selection-side-nav
        [open]="panelAbierto()"
        title="Contrataciones segmentadas 2026"
        mode="single"
        notice="Se muestran solo las contrataciones segmentadas cuyo monto es igual o mayor al tope aplicable para el Anuncio de Contratación Futura."
        [columns]="columnas"
        [rows]="filasPagina()"
        [searchValue]="busqueda()"
        [selectedIds]="seleccionTemporal() ? [seleccionTemporal()] : []"
        [paginated]="true"
        [page]="pagina()"
        [pageSize]="filasPorPagina()"
        [rowsPerPage]="filasPorPagina()"
        [rowsPerPageOptions]="opcionesFilas"
        [totalItems]="filtradas().length"
        [totalPages]="totalPaginas()"
        (searchChange)="buscar($event)"
        (selectionChange)="seleccionTemporal.set($event.length ? $event[0] : '')"
        (previousPage)="pagina.set(pagina() - 1)"
        (nextPage)="pagina.set(pagina() + 1)"
        (rowsPerPageChange)="cambiarFilasPorPagina($event)"
        [filterOpen]="filtrosAbiertos()"
        [appliedFilters]="chipsFiltros()"
        [truncateHeaders]="true"
        tableMinWidthClass="min-w-[1150px]"
        (filterRemoved)="quitarFiltro($event)"
        (filtersCleared)="borrarFiltros()"
        (filterRequested)="abrirFiltros()"
        (filterCanceled)="filtrosAbiertos.set(false)"
        (filterApplied)="aplicarFiltros()"
        (closed)="cerrarPanel()"
        (accepted)="aceptarSeleccion()"
      >
        <ng-container filter-fields>
          <siaf-input
            label="Objeto de contratación"
            type="select"
            placeholder="Selecciona"
            [options]="opcionesObjeto"
            [value]="borrador().objeto"
            (valueChange)="cambiarBorrador('objeto', $any($event))"
          />
          <siaf-input
            label="Origen"
            type="select"
            placeholder="Selecciona"
            [options]="opcionesOrigen"
            [value]="borrador().origen"
            (valueChange)="cambiarOrigen($any($event))"
          />
          <siaf-input
            label="N° Modificación CMN"
            type="select"
            placeholder="Selecciona"
            [options]="opcionesModificacion"
            [disabled]="borrador().origen !== 'CMN'"
            [value]="borrador().modificacionCmn"
            (valueChange)="cambiarBorrador('modificacionCmn', $any($event))"
          />
        </ng-container>
      </siaf-selection-side-nav>

      <siaf-modal
        variant="delete-record"
        title="¿Borrar item(s)?"
        illustrationSrc="assets/figma/modals/delete-item.svg"
        confirmLabel="Aceptar"
        cancelLabel="Cancelar"
        [open]="modalBorrarItem()"
        [showIllustration]="true"
        (confirmed)="confirmarBorrarItem()"
        (canceled)="modalBorrarItem.set(false)"
        (closed)="modalBorrarItem.set(false)"
      />

      <siaf-modal
        variant="cancel"
        title="¿Quitar la contratación segmentada?"
        description="Se perderán los datos registrados."
        confirmLabel="Aceptar"
        cancelLabel="Cancelar"
        [open]="modalQuitar()"
        [showIllustration]="false"
        (confirmed)="modalQuitar.set(false); quitarContratacion()"
        (canceled)="modalQuitar.set(false)"
        (closed)="modalQuitar.set(false)"
      />

      <siaf-modal
        variant="cancel"
        title="¿Cancelar el registro?"
        description="Se perderán los datos registrados."
        confirmLabel="Aceptar"
        cancelLabel="Cancelar"
        [open]="modalCancelar()"
        [showIllustration]="false"
        (confirmed)="modalCancelar.set(false); cancelarRegistro()"
        (canceled)="modalCancelar.set(false)"
        (closed)="modalCancelar.set(false)"
      />

      <!-- «Cancelar» de la cabecera: el modal «cancel» del kit (texto e ilustración de los lineamientos). -->
      <siaf-modal
        variant="cancel"
        confirmVariant="primary"
        confirmLabel="Aceptar"
        cancelLabel="Cancelar"
        [open]="modalCancelarSolicitud()"
        [showIllustration]="true"
        (confirmed)="modalCancelarSolicitud.set(false); regresar()"
        (canceled)="modalCancelarSolicitud.set(false)"
        (closed)="modalCancelarSolicitud.set(false)"
      />

      <siaf-request-approval-modals
        [saveOpen]="modalGrabar()"
        [verifyOpen]="modalVerificar()"
        [deleteOpen]="modalEliminar()"
        [approveOpen]="modalAprobar()"
        [observeOpen]="modalObservar()"
        [rejectOpen]="modalRechazar()"
        [saving]="saving()"
        [reason]="comentario()"
        [rejectReasonType]="motivoRechazo()"
        [rejectReasonTypeOptions]="motivosRechazo"
        [snackbarVariant]="aviso()"
        [snackbarMessage]="avisoMensaje()"
        [snackbarOpen]="avisoAbierto()"
        requestType="creación"
        [requestNumber]="numeroDocumento()"
        (saveConfirmed)="onConfirmarGrabar()"
        (verifyConfirmed)="onConfirmarVerificar()"
        (deleteConfirmed)="onConfirmarEliminar()"
        (approveConfirmed)="onConfirmarAprobar()"
        (observeConfirmed)="onConfirmarObservar()"
        (rejectConfirmed)="onConfirmarRechazar()"
        (saveClosed)="modalGrabar.set(false)"
        (verifyClosed)="modalVerificar.set(false)"
        (deleteClosed)="modalEliminar.set(false)"
        (approvalClosed)="cerrarModalesAprobador()"
        (reasonChange)="comentario.set($event)"
        (rejectReasonTypeChange)="motivoRechazo.set($event)"
        (snackbarClosed)="avisoAbierto.set(false)"
      />
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnuncioContratacionFuturaComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly currentUser = inject(CurrentUserService);
  private readonly permissions = inject(PermissionService);
  private readonly catalogosApi = inject(CatalogosApiService);
  private readonly solicitudesApi = inject(SolicitudesApiService);
  private readonly solicitudesFacade = inject(SolicitudesFacadeService);
  private readonly anunciosApi = inject(AnunciosApiService);

  private solicitudId: string | null = null;
  private tiposDocumento: TipoDocumentoResponse[] = [];

  // ── Estado del documento ──────────────────────────────────────────
  /** Última respuesta del backend: de ella salen el estado, los anuncios, el historial y la trazabilidad. */
  private readonly solicitud = signal<SolicitudResponse | null>(null);
  readonly estado = computed(() => (this.solicitud()?.estado ?? 'NUEVO').toUpperCase());
  readonly editando = signal(false);
  readonly cargando = signal(false);
  readonly saving = signal(false);

  readonly headerRole = computed<'creator' | 'approver'>(() => (this.permissions.currentRole() === 'approver' ? 'approver' : 'creator'));
  /**
   * ¿La solicitud es del usuario? Solo su creador puede editarla, verificarla o eliminarla (otro usuario con perfil
   * creador solo la ve). Sin id de usuario en la sesión no se puede saber y se deja pasar: el backend decide.
   */
  readonly esAutor = computed(() => {
    const usuarioId = this.currentUser.user().usuarioId;
    const creadorId = this.solicitud()?.creador?.id;
    return !usuarioId || !creadorId || usuarioId === creadorId;
  });
  /** El aprobador siempre ve sus acciones; el creador, solo en lo suyo. */
  readonly mostrarAcciones = computed(() => this.headerRole() === 'approver' || this.esAutor());
  readonly elaborado = computed(() => this.estado() !== 'NUEVO');
  readonly soloLectura = computed(() => this.elaborado() && !this.editando());
  readonly puedeVerificar = computed(() => ['ELABORADO', 'OBSERVADO'].includes(this.estado()));
  readonly numeroDocumento = computed(() => this.solicitud()?.numero ?? '');
  /** La solicitud está en la etapa 2 (tras Segmentación, que ya se cumplió); con el anuncio aprobado, esa etapa también. */
  readonly etapaActual = computed(() => (this.estado() === 'APROBADO' ? 2 : 1));

  readonly headerState = computed<SolicitudeHeaderState>(() => {
    if (this.editando()) return 'edit';
    switch (this.estado()) {
      case 'APROBADO': return 'approved';
      case 'OBSERVADO': return 'observed';
      case 'RECHAZADO': return 'rejected';
      case 'VERIFICADO': return 'verified';
      case 'ELIMINADO': return 'deleted';
      case 'ELABORADO': return 'elaborated';
      default: return 'new';
    }
  });

  readonly estadoDocumento = computed<FlowStatus>(() => {
    const etiquetas: Record<string, FlowStatus> = {
      APROBADO: ESTADO.APROBADO,
      OBSERVADO: ESTADO.OBSERVADO,
      RECHAZADO: ESTADO.RECHAZADO,
      VERIFICADO: ESTADO.VERIFICADO,
      ELIMINADO: ESTADO.ELIMINADO,
    };
    return etiquetas[this.estado()] ?? ESTADO.ELABORADO;
  });

  // ── Historial y trazabilidad (del historial de estados) ───────────
  private readonly fuentesHistorial = computed<HistorialSource[]>(() =>
    (this.solicitud()?.historialEstados ?? []).map((h) => ({
      estadoBackend: h.estadoNuevo,
      fechaISO: h.createdAt,
      comentario: h.comentario,
      usuario: h.creador ? `${h.creador.nombres} ${h.creador.apellidoPaterno} ${h.creador.apellidoMaterno}` : '',
      rol: h.perfil?.cfgPerfil?.rol?.nombre ?? '',
    })),
  );
  readonly historial = computed(() => buildHistoryEntries(this.fuentesHistorial()));
  readonly comentarioActual = computed(() => buildCurrentComment(this.estado(), this.fuentesHistorial()));

  readonly trazabilidad = computed<ActionTrackerSummary[]>(() => {
    const historial = this.solicitud()?.historialEstados ?? [];
    // La última vez que pasó por cada estado (tras observar y subsanar, cuenta la verificación nueva).
    const ultimo = (estado: string) => [...historial].reverse().find((h) => h.estadoNuevo === estado);
    const quien = (estado: string, label: string): ActionTrackerSummary => {
      const h = ultimo(estado);
      const nombre = h?.creador ? `${h.creador.nombres} ${h.creador.apellidoPaterno} ${h.creador.apellidoMaterno}` : '';
      return { label, actionBy: nombre.toUpperCase(), date: h ? new Date(h.createdAt).toLocaleString('es-PE') : '' };
    };
    const tercero = this.estado() === 'OBSERVADO'
      ? quien('OBSERVADO', 'Observado por')
      : this.estado() === 'RECHAZADO' ? quien('RECHAZADO', 'Rechazado por') : quien('APROBADO', 'Aprobado por');
    return [quien('ELABORADO', 'Elaborado por'), quien('VERIFICADO', 'Verificado por'), tercero];
  });

  // ── Modales y avisos ──────────────────────────────────────────────
  readonly modalGrabar = signal(false);
  readonly modalVerificar = signal(false);
  readonly modalEliminar = signal(false);
  readonly modalAprobar = signal(false);
  readonly modalObservar = signal(false);
  readonly modalRechazar = signal(false);
  readonly comentario = signal('');
  readonly motivoRechazo = signal('');
  readonly motivosRechazo = [...MOTIVOS_RECHAZO];
  readonly avisoAbierto = signal(false);
  readonly aviso = signal<SnackbarVariant>('creation-elaborated');
  /** Texto propio del aviso (solo con la variante `custom`, como «agregado a la lista»). */
  readonly avisoMensaje = signal('');
  private temporizadorAviso: ReturnType<typeof setTimeout> | null = null;

  /** Tras pulsar «+»: la sección pasa a «Registro de anuncio…» con la selección de tipo de contratación. */
  readonly registrando = signal(false);

  // ── Panel «Contrataciones segmentadas» ────────────────────────────
  readonly columnas = COLUMNAS_CONTRATACION;
  readonly opcionesFilas = [10, 25, 50, 100];
  readonly panelAbierto = signal(false);
  readonly busqueda = signal('');
  readonly pagina = signal(1);
  readonly filasPorPagina = signal(25);
  readonly seleccionTemporal = signal('');
  readonly contratacion = signal<ContratacionSegmentada | null>(null);

  // ── Datos de la contratación elegida ──────────────────────────────
  readonly alcance = signal('');
  readonly plazoEntrega = signal('');
  /** Tipo de procedimiento elegido; solo se usa cuando el origen de la contratación es CMN. */
  readonly tipoProcedimientoCmn = signal('');
  /** Tipos de procedimiento que se ofrecen según el objeto de la contratación (los que ya usa el PAC para ese objeto). */
  readonly opcionesTipoProcedimiento = computed((): TextFieldOption[] => {
    const objeto = this.contratacion()?.objeto;
    const tipos = new Set(
      CONTRATACIONES_SEGMENTADAS.filter((c) => c.objeto === objeto && c.origen === 'PAC').map((c) => c.tipoProcedimiento),
    );
    return [...tipos].map((v) => ({ label: v, value: v }));
  });
  readonly fechaConvocatoria = signal('');
  /** El registro está completo cuando hay contratación elegida, alcance, un plazo de entrega válido y la fecha de convocatoria. */
  readonly registroCompleto = computed(() =>
    !!this.contratacion()
    && !!this.alcance().trim()
    && (this.contratacion()?.origen !== 'CMN' || !!this.tipoProcedimientoCmn())
    && Number(this.plazoEntrega()) > 0
    && this.cumpleAnticipacion(),
  );

  /** Hoy en formato ISO (YYYY-MM-DD, hora local): la fecha de convocatoria no puede ser anterior. */
  readonly hoy = this.aIso(new Date());
  /** Plazo mínimo, en días calendario, entre la aprobación del anuncio y la fecha aproximada de convocatoria. */
  private readonly PLAZO_MINIMO_DIAS = 40;

  /** Días calendario entre hoy y la fecha elegida (null sin fecha). */
  readonly diasAnticipacion = computed((): number | null => {
    const fecha = this.fechaConvocatoria();
    if (!fecha) return null;
    const [a, m, d] = fecha.split('-').map(Number);
    const [ha, hm, hd] = this.hoy.split('-').map(Number);
    return Math.round((Date.UTC(a, m - 1, d) - Date.UTC(ha, hm - 1, hd)) / 86_400_000);
  });
  readonly errorFechaConvocatoria = computed(() => {
    const dias = this.diasAnticipacion();
    return dias !== null && dias < this.PLAZO_MINIMO_DIAS ? 'No cumple el plazo mínimo de 40 días calendario' : '';
  });
  private cumpleAnticipacion(): boolean {
    const dias = this.diasAnticipacion();
    return dias !== null && dias >= this.PLAZO_MINIMO_DIAS;
  }
  private aIso(f: Date): string {
    return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
  }

  /** Ayuda (popover) abierta: se muestra con el hover o el foco del ícono ⓘ. */
  readonly ayudaAbierta = signal<'plazo' | 'fecha' | null>(null);
  private temporizadorAyuda: ReturnType<typeof setTimeout> | null = null;

  /** En pantallas anchas el globo de la fecha sale hacia la derecha del ícono; en angostas, hacia la izquierda para no salirse. */
  readonly alineacionAyudaFecha = signal<'start' | 'end'>('start');

  abrirAyuda(cual: 'plazo' | 'fecha'): void {
    this.cancelarTemporizadorAyuda();
    if (cual === 'fecha') this.alineacionAyudaFecha.set(window.innerWidth < 768 ? 'end' : 'start');
    this.ayudaAbierta.set(cual);
  }

  cerrarAyuda(): void {
    this.cancelarTemporizadorAyuda();
    this.ayudaAbierta.set(null);
  }

  /** Deja un instante para pasar del ícono al globo sin que se cierre. */
  cerrarAyudaConDemora(): void {
    this.cancelarTemporizadorAyuda();
    this.temporizadorAyuda = setTimeout(() => this.ayudaAbierta.set(null), 150);
  }

  private cancelarTemporizadorAyuda(): void {
    if (this.temporizadorAyuda) clearTimeout(this.temporizadorAyuda);
    this.temporizadorAyuda = null;
  }

  readonly camposContratacion = computed<SummaryCardField[]>(() => {
    const c = this.contratacion();
    if (!c) return [];
    return [
      { label: 'Código', value: c.codigo },
      { label: 'Descripción', value: c.descripcion.toUpperCase() },
      { label: 'Objeto de contratación', value: c.objeto.toUpperCase() },
      { label: 'Origen', value: origenTexto(c) },
    ];
  });

  readonly llevaCantidad = llevaCantidadAproximada;

  cantidadTexto(c: ContratacionSegmentada): string {
    return c.cantidadAproximada.toLocaleString('en-US');
  }

  /** Confirmación al quitar la contratación elegida: se pierden alcance, plazo y fecha. */
  readonly modalQuitar = signal(false);

  quitarContratacion(): void {
    this.contratacion.set(null);
    this.alcance.set('');
    this.plazoEntrega.set('');
    this.tipoProcedimientoCmn.set('');
    this.fechaConvocatoria.set('');
    this.cerrarAyuda();
  }

  // ── Anuncios registrados (grilla) ──────────────────────────────────
  readonly items = signal<AnuncioItemDatos[]>([]);
  readonly busquedaItems = signal('');
  readonly paginaItems = signal(1);
  readonly filasPorPaginaItems = signal(25);
  readonly seleccionItems = signal<string[]>([]);

  readonly itemsFiltrados = computed(() => {
    const texto = this.busquedaItems().trim().toLowerCase();
    if (!texto) return this.items();
    return this.items().filter((i) =>
      [i.contratacionCodigo, i.descripcion, i.objeto, i.alcance, this.fechaCorta(i.fechaConvocatoria)].some((v) => v.toLowerCase().includes(texto)),
    );
  });
  readonly totalPaginasItems = computed(() => Math.max(1, Math.ceil(this.itemsFiltrados().length / this.filasPorPaginaItems())));
  readonly itemsPagina = computed(() => {
    const desde = (this.paginaItems() - 1) * this.filasPorPaginaItems();
    return this.itemsFiltrados().slice(desde, desde + this.filasPorPaginaItems());
  });
  readonly todosSeleccionados = computed(() => this.itemsPagina().length > 0 && this.itemsPagina().every((i) => this.estaSeleccionado(i.id)));
  readonly algunoSeleccionado = computed(() => !this.todosSeleccionados() && this.itemsPagina().some((i) => this.estaSeleccionado(i.id)));

  fechaCorta(iso: string): string {
    return iso.split('-').reverse().join('/');
  }

  estaSeleccionado(id: string): boolean {
    return this.seleccionItems().includes(id);
  }

  alternarSeleccion(id: string): void {
    this.seleccionItems.update((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  /** La casilla de la barra marca o desmarca las filas de la página que se ve. */
  seleccionarTodos(marcar: boolean): void {
    const visibles = this.itemsPagina().map((i) => i.id);
    this.seleccionItems.update((ids) => (marcar ? [...new Set([...ids, ...visibles])] : ids.filter((id) => !visibles.includes(id))));
  }

  /** Solo el creador y mientras la solicitud admite cambios (nueva, elaborada u observada). */
  readonly puedeModificar = computed(() => this.headerRole() === 'creator' && this.esAutor() && ['NUEVO', 'ELABORADO', 'OBSERVADO'].includes(this.estado()));

  /** Anuncio de la grilla que se está editando en el registro; sin él, «Aceptar» agrega uno nuevo. */
  private readonly itemEnEdicion = signal<string | null>(null);

  /** Lápiz: lleva el anuncio marcado al registro para corregirlo (solo con la solicitud en edición). */
  editarSeleccionado(): void {
    const [id] = this.seleccionItems();
    const item = this.items().find((i) => i.id === id);
    if (!item || this.seleccionItems().length !== 1) return;

    this.itemEnEdicion.set(item.id);
    this.contratacion.set(CONTRATACIONES_SEGMENTADAS.find((c) => c.codigo === item.contratacionCodigo) ?? null);
    this.alcance.set(item.alcance);
    this.plazoEntrega.set(String(item.plazoEntrega));
    this.tipoProcedimientoCmn.set(item.origen === 'CMN' ? item.tipoProcedimiento : '');
    this.fechaConvocatoria.set(item.fechaConvocatoria);
    this.registrando.set(true);
  }

  /** Confirmación de la papelera: «¿Borrar item?» antes de quitar los anuncios marcados. */
  readonly modalBorrarItem = signal(false);

  confirmarBorrarItem(): void {
    this.modalBorrarItem.set(false);
    const varios = this.seleccionItems().length > 1;
    this.quitarSeleccionados();
    this.avisarLista(varios ? 'Se han borrado de la lista con éxito.' : 'Se ha borrado de la lista con éxito.');
  }

  /** Quita de la grilla los anuncios marcados (se aplica al grabar). */
  quitarSeleccionados(): void {
    const quitar = new Set(this.seleccionItems());
    this.items.update((lista) => lista.filter((i) => !quitar.has(i.id)));
    this.seleccionItems.set([]);
    this.paginaItems.set(Math.min(this.paginaItems(), this.totalPaginasItems()));
  }

  buscarItems(texto: string): void {
    this.busquedaItems.set(String(texto ?? ''));
    this.paginaItems.set(1);
  }

  cambiarFilasItems(filas: number): void {
    this.filasPorPaginaItems.set(filas);
    this.paginaItems.set(1);
  }

  /** «Aceptar»: agrega el registro armado a la grilla y vuelve al estado «sin registrar» para poder agregar otro. */
  agregarItem(): void {
    const c = this.contratacion();
    if (!c || !this.registroCompleto()) return;

    const editado = this.itemEnEdicion();
    const nuevo: AnuncioItemDatos = {
      id: editado ?? crypto.randomUUID(),
      contratacionCodigo: c.codigo,
      descripcion: c.descripcion,
      objeto: c.objeto,
      origen: c.origen,
      tipoProcedimiento: c.origen === 'CMN' ? this.tipoProcedimientoCmn() : c.tipoProcedimiento,
      cantidadAproximada: llevaCantidadAproximada(c.objeto) ? c.cantidadAproximada : null,
      alcance: this.alcance().trim(),
      plazoEntrega: Number(this.plazoEntrega()),
      fechaConvocatoria: this.fechaConvocatoria(),
    };
    // Al editar, el anuncio conserva su lugar en la lista; si no, se suma al final.
    this.items.update((lista) => (editado ? lista.map((i) => (i.id === editado ? nuevo : i)) : [...lista, nuevo]));
    this.itemEnEdicion.set(null);
    this.seleccionItems.set([]);
    this.quitarContratacion();
    this.registrando.set(false);
    this.avisarLista(editado ? 'Se ha actualizado en la lista con éxito.' : 'Se ha agregado a la lista con éxito.');
  }

  /** Confirmación al cancelar el registro del anuncio en curso. */
  readonly modalCancelar = signal(false);

  cancelarRegistro(): void {
    this.itemEnEdicion.set(null);
    this.quitarContratacion();
    this.registrando.set(false);
  }

  // Filtros: `borrador` es lo que se edita en la columna «Filtrar»; `filtros` es lo ya aplicado con «Aplicar».
  readonly opcionesObjeto = OPCIONES_OBJETO;
  readonly opcionesOrigen = OPCIONES_ORIGEN;
  readonly opcionesModificacion = OPCIONES_MODIFICACION_CMN;
  readonly filtrosAbiertos = signal(false);
  readonly filtros = signal<FiltrosContratacion>({ ...SIN_FILTROS });
  readonly borrador = signal<FiltrosContratacion>({ ...SIN_FILTROS });

  readonly filtradas = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();
    const { objeto, origen, modificacionCmn } = this.filtros();
    // Una contratación segmentada ya registrada en la solicitud no se ofrece otra vez (la que se está editando sí).
    const enEdicion = this.itemEnEdicion();
    const yaRegistradas = new Set(this.items().filter((i) => i.id !== enEdicion).map((i) => i.contratacionCodigo));
    return CONTRATACIONES_SEGMENTADAS.filter((c) =>
      !yaRegistradas.has(c.codigo)
      && (!objeto || c.objeto === objeto)
      && (!origen || c.origen === origen)
      && (!modificacionCmn || c.modificacionCmn === modificacionCmn)
      && (!texto || [c.codigo, c.descripcion, c.objeto, c.origen, c.tipoProcedimiento].some((v) => v.toLowerCase().includes(texto))),
    );
  });
  readonly totalPaginas = computed(() => Math.max(1, Math.ceil(this.filtradas().length / this.filasPorPagina())));
  readonly filasPagina = computed(() => {
    const desde = (this.pagina() - 1) * this.filasPorPagina();
    return this.filtradas().slice(desde, desde + this.filasPorPagina());
  });

  abrirPanel(): void {
    this.seleccionTemporal.set(this.contratacion()?.id ?? '');
    this.panelAbierto.set(true);
  }

  abrirFiltros(): void {
    this.borrador.set({ ...this.filtros() });
    this.filtrosAbiertos.set(true);
  }

  cambiarBorrador(campo: keyof FiltrosContratacion, valor: string): void {
    this.borrador.update((b) => ({ ...b, [campo]: valor }));
  }

  /** El N° de modificación solo aplica al CMN: al cambiar de origen se limpia. */
  cambiarOrigen(valor: string): void {
    this.borrador.update((b) => ({ ...b, origen: valor, modificacionCmn: '' }));
  }

  /** Filtros aplicados, como se muestran bajo el buscador del panel («Bien», «PAC», «Mod. 1»). */
  readonly chipsFiltros = computed(() => {
    const { objeto, origen, modificacionCmn } = this.filtros();
    return [
      ...(objeto ? [{ key: 'objeto', label: objeto }] : []),
      ...(origen ? [{ key: 'origen', label: origen }] : []),
      ...(modificacionCmn ? [{ key: 'modificacionCmn', label: `Mod. ${modificacionCmn}` }] : []),
    ];
  });

  quitarFiltro(clave: string): void {
    // Sin origen CMN no hay N° de modificación.
    this.filtros.update((f) => ({ ...f, [clave]: '', ...(clave === 'origen' ? { modificacionCmn: '' } : {}) }));
    this.pagina.set(1);
  }

  borrarFiltros(): void {
    this.filtros.set({ ...SIN_FILTROS });
    this.pagina.set(1);
  }

  aplicarFiltros(): void {
    this.filtros.set({ ...this.borrador() });
    this.pagina.set(1);
    this.filtrosAbiertos.set(false);
  }

  cerrarPanel(): void {
    this.filtrosAbiertos.set(false);
    this.panelAbierto.set(false);
  }

  buscar(texto: string): void {
    this.busqueda.set(texto);
    this.pagina.set(1);
  }

  cambiarFilasPorPagina(filas: number): void {
    this.filasPorPagina.set(filas);
    this.pagina.set(1);
  }

  aceptarSeleccion(): void {
    this.contratacion.set(CONTRATACIONES_SEGMENTADAS.find((c) => c.id === this.seleccionTemporal()) ?? null);
    this.tipoProcedimientoCmn.set('');
    this.cerrarPanel();
  }

  readonly heading = NOMBRE_DOCUMENTO;
  readonly breadcrumbs: BreadcrumbItem[] = buildProcessBreadcrumbs(PROCESS_ID, PROCESS_ROUTE, 'Anuncio de contratación futura');

  /** «Fecha» vacía en una solicitud nueva: la tarjeta toma la hora en que se abrió. Si ya existe, la de su registro. */
  readonly camposEntidad = computed<SolicitudeInfoField[]>(() => {
    const registro = this.solicitud()?.fechaRegistro;
    return [
      { label: 'Fecha', value: registro ? formatearFechaHora(new Date(registro)) : '' },
      { label: 'Ente rector', value: 'MINISTERIO DE ECONOMÍA Y FINANZAS' },
      { label: 'Entidad/ U.E./ ...', value: 'DEPARTAMENTO ENCARGADO DE LAS CONTRATACIONES' },
    ];
  });

  /** Seguimiento del proceso: con el anuncio aprobado, su hito pasa a «Aprobado» con la fecha de aprobación. */
  readonly etapas = computed((): TimelineItem[] => {
    const aprobacion = [...(this.solicitud()?.historialEstados ?? [])].reverse().find((h) => (h.estadoNuevo ?? '').toUpperCase() === 'APROBADO');
    const fecha = aprobacion ? new Date(aprobacion.createdAt) : null;
    const anuncio: TimelineItem = fecha && this.estado() === 'APROBADO'
      ? {
          label: 'Anuncio de contratación futura',
          date: `${String(fecha.getDate()).padStart(2, '0')}/${String(fecha.getMonth() + 1).padStart(2, '0')}/${String(fecha.getFullYear()).slice(-2)}`,
          dateInfo: 'Aprobado',
          description: 'Anuncio aprobado',
        }
      : { label: 'Anuncio de contratación futura' };
    return [
      { label: 'Segmentación', date: '15/09/26', dateInfo: 'Aprobado', description: 'Segmentación aprobada' },
      anuncio,
      { label: 'Formulación de Requerimiento' },
      { label: 'Estrategia de contratación' },
      { label: 'Interacción con el mercado' },
      { label: 'Designación de evaluadores' },
      { label: 'Aprobación de expediente de contratación' },
      { label: 'Elaboración de bases' },
    ];
  });

  // ── Grabar solo con cambios ───────────────────────────────────────
  // La foto se toma al pulsar Editar; sin foto (documento nuevo) se asume que hay cambios.
  private readonly fotoEdicion = signal<string | null>(null);
  private readonly fotoActual = computed(() => crearSnapshotFormulario({ items: this.items() }));
  private readonly hayCambios = computed(() => hayCambiosRespectoAlSnapshot(this.fotoEdicion(), this.fotoActual()));

  readonly formValido = computed(() =>
    !this.soloLectura() && !this.registrando() && this.items().length > 0 && this.hayCambios(),
  );

  ngOnInit(): void {
    this.catalogosApi.listarTiposDocumento().subscribe((tipos) => (this.tiposDocumento = tipos));
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.cargar(id);

    const estadoNavegacion = history.state as { fromSave?: boolean } | null;
    if (estadoNavegacion?.fromSave) this.mostrarAviso('creation-elaborated');
  }

  ngOnDestroy(): void {
    this.cancelarTemporizadorAyuda();
    this.cancelarTemporizadorAviso();
  }

  /** Confirmación del «Cancelar» de la cabecera (junto a Grabar y Verificar). */
  readonly modalCancelarSolicitud = signal(false);

  regresar(): void {
    if (this.editando()) {
      // Cancelar la edición vuelve a los datos grabados.
      this.editando.set(false);
      this.restaurarFormulario(this.solicitud());
      return;
    }
    void this.router.navigate([PROCESS_ROUTE]);
  }

  editar(): void {
    this.editando.set(true);
    this.avisoAbierto.set(false);
    this.fotoEdicion.set(this.fotoActual());
  }

  // ── Grabar ────────────────────────────────────────────────────────
  onConfirmarGrabar(): void {
    this.modalGrabar.set(false);
    const items = this.items();
    const guardarYElaborar = (id: string): Observable<unknown> =>
      this.anunciosApi.guardarDetalle(id, items).pipe(
        switchMap(() => this.solicitudesApi.cambiarEstado(id, { estadoNuevo: 'ELABORADO' })),
      );

    this.saving.set(true);

    if (this.solicitudId) {
      const id = this.solicitudId;
      guardarYElaborar(id).subscribe({
        next: () => { this.editando.set(false); this.mostrarAviso('creation-elaborated'); this.cargar(id); },
        error: () => this.cargar(id),
      });
      return;
    }

    const tipo = this.tiposDocumento.find((t) => t.codigo === CODIGO_DOCUMENTO);
    if (!tipo) { this.saving.set(false); return; }
    this.solicitudesFacade.crearSolicitud({
      tipoDocumentoId: tipo.id,
      tipoAccion: 'creacion',
      fechaRequerimiento: new Date().toISOString(),
      organoLinea: this.organo(),
      justificacion: 'Anuncio de contratación futura',
      cuentas: [],
    }).pipe(
      switchMap((creada) => { this.solicitudId = creada.id; return guardarYElaborar(creada.id).pipe(map(() => creada.id)); }),
    ).subscribe({
      next: (id) => { this.saving.set(false); void this.router.navigate([PROCESS_ROUTE, REQUEST_SEGMENT, id], { state: { fromSave: true } }); },
      error: () => {
        this.saving.set(false);
        if (this.solicitudId) void this.router.navigate([PROCESS_ROUTE, REQUEST_SEGMENT, this.solicitudId]);
      },
    });
  }

  // ── Acciones de estado ────────────────────────────────────────────
  onConfirmarVerificar(): void {
    this.modalVerificar.set(false);
    this.accion((id) => this.solicitudesApi.cambiarEstado(id, { estadoNuevo: 'VERIFICADO' }), 'creation-verified');
  }

  onConfirmarEliminar(): void {
    this.modalEliminar.set(false);
    this.accion((id) => this.solicitudesApi.cambiarEstado(id, { estadoNuevo: 'ELIMINADO' }), 'creation-deleted');
  }

  abrirAprobar(): void { this.comentario.set(''); this.modalAprobar.set(true); }
  abrirObservar(): void { this.comentario.set(''); this.modalObservar.set(true); }
  abrirRechazar(): void { this.comentario.set(''); this.motivoRechazo.set(''); this.modalRechazar.set(true); }

  cerrarModalesAprobador(): void {
    this.modalAprobar.set(false);
    this.modalObservar.set(false);
    this.modalRechazar.set(false);
  }

  onConfirmarAprobar(): void {
    this.modalAprobar.set(false);
    this.accion((id) => this.solicitudesFacade.aprobar(id), 'creation-approved');
  }

  onConfirmarObservar(): void {
    if (!this.comentario().trim()) return;
    this.modalObservar.set(false);
    this.accion((id) => this.solicitudesFacade.observar(id, this.comentario()), 'creation-observed');
  }

  onConfirmarRechazar(): void {
    if (!this.comentario().trim()) return;
    this.modalRechazar.set(false);
    this.accion((id) => this.solicitudesFacade.rechazar(id, this.comentario(), this.motivoRechazo() || undefined), 'creation-rejected');
  }

  /** Verificar, eliminar, aprobar, observar y rechazar: llamar, avisar y recargar. */
  private accion(llamada: (id: string) => Observable<unknown>, aviso: SnackbarVariant): void {
    const id = this.solicitudId;
    if (!id) return;
    this.saving.set(true);
    llamada(id).subscribe({
      next: () => { this.mostrarAviso(aviso); this.cargar(id); },
      error: () => this.saving.set(false),
    });
  }

  private mostrarAviso(variante: SnackbarVariant): void {
    this.cancelarTemporizadorAviso();
    this.aviso.set(variante);
    this.avisoMensaje.set('');
    this.avisoAbierto.set(true);
  }

  /** Confirma que el anuncio entró, se actualizó o se borró de la grilla; se oculta solo a los 4 s para no tapar lo que sigue. */
  private avisarLista(mensaje: string): void {
    this.cancelarTemporizadorAviso();
    this.aviso.set('custom');
    this.avisoMensaje.set(mensaje);
    this.avisoAbierto.set(true);
    this.temporizadorAviso = setTimeout(() => this.avisoAbierto.set(false), 4000);
  }

  private cancelarTemporizadorAviso(): void {
    if (this.temporizadorAviso) clearTimeout(this.temporizadorAviso);
    this.temporizadorAviso = null;
  }

  private organo(): string {
    return (this.currentUser.user().unidad ?? this.currentUser.office ?? '').toUpperCase();
  }

  // ── Carga ─────────────────────────────────────────────────────────
  private cargar(id: string): void {
    this.cargando.set(true);
    this.solicitudesApi.obtenerDetalle(id).subscribe({
      next: (s) => {
        this.solicitudId = s.id;
        this.solicitud.set(s);
        this.editando.set(false);
        this.fotoEdicion.set(null);
        this.restaurarFormulario(s);
        this.cargando.set(false);
        this.saving.set(false);
      },
      error: () => { this.cargando.set(false); this.saving.set(false); },
    });
  }

  private restaurarFormulario(s: SolicitudResponse | null): void {
    this.items.set(s?.detalleAnuncio?.items ?? []);
    this.seleccionItems.set([]);
    this.cancelarRegistro();
  }
}

/** `dd/mm/aaaa    hh:mm:ss`, el mismo formato que muestra la tarjeta de datos al abrir una solicitud nueva. */
function formatearFechaHora(fecha: Date): string {
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${dos(fecha.getDate())}/${dos(fecha.getMonth() + 1)}/${fecha.getFullYear()}    ${dos(fecha.getHours())}:${dos(fecha.getMinutes())}:${dos(fecha.getSeconds())}`;
}
