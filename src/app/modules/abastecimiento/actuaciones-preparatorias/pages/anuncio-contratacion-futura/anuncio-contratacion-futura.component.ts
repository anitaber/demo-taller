import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { BreadcrumbItem } from '../../../../../shared/components/breadcrumb/breadcrumb.component';
import { SelectionSideNavComponent } from '../../../../../shared/components/selection-side-nav/selection-side-nav.component';
import { SolicitudeFormCardComponent } from '../../../../../shared/components/solicitude-form-card/solicitude-form-card.component';
import { SolicitudeInfoCardComponent, SolicitudeInfoField } from '../../../../../shared/components/solicitude-info-card/solicitude-info-card.component';
import { SolicitudePageLayoutComponent } from '../../../../../shared/components/solicitude-page-layout/solicitude-page-layout.component';
import { TimelineComponent } from '../../../../../shared/components/timeline/timeline.component';
import { TimelineItem } from '../../../../../shared/components/timeline/timeline.model';
import { ButtonComponent } from '../../../../../shared/ui/button/button.component';
import { DateTimePickerComponent } from '../../../../../shared/ui/date-time-picker/date-time-picker.component';
import { IconComponent } from '../../../../../shared/ui/icon/icon.component';
import { PopoverComponent } from '../../../../../shared/ui/popover/popover.component';
import { ReadonlyFieldComponent } from '../../../../../shared/ui/readonly-field/readonly-field.component';
import { SummaryCardComponent, SummaryCardField } from '../../../../../shared/ui/summary-card/summary-card.component';
import { TableComponent } from '../../../../../shared/ui/table/table.component';
import { DataTableColumn, DataTableRow } from '../../../../../shared/components/data-table/data-table.component';
import { TextAreaControlComponent } from '../../../../../shared/ui/text-area-control/text-area-control.component';
import { TextFieldComponent } from '../../../../../shared/ui/text-field/text-field.component';
import { buildProcessBreadcrumbs } from '../../../../../shared/utils/breadcrumbs.util';
import { NOMBRE_DOCUMENTO, PROCESS_ID, PROCESS_ROUTE } from '../../config/anuncio-contratacion-futura.rutas';
import {
  COLUMNAS_CONTRATACION,
  CONTRATACIONES_SEGMENTADAS,
  ContratacionSegmentada,
  OPCIONES_MODIFICACION_CMN,
  OPCIONES_OBJETO,
  OPCIONES_ORIGEN,
} from '../../models/contratacion-segmentada.model';

type FiltrosContratacion = { objeto: string; origen: string; modificacionCmn: string };
const SIN_FILTROS: FiltrosContratacion = { objeto: '', origen: '', modificacionCmn: '' };

/** Un anuncio de contratación futura ya aceptado: la foto del registro al pulsar «Aceptar». */
interface AnuncioItem {
  id: string;
  contratacion: ContratacionSegmentada;
  alcance: string;
  plazoEntrega: string;
  fechaConvocatoria: string;
}

const COLUMNAS_ITEMS: DataTableColumn[] = [
  { key: 'codigo', label: 'Código' },
  { key: 'descripcion', label: 'Descripción' },
  { key: 'objeto', label: 'Objeto de contratación' },
  { key: 'tipoProcedimiento', label: 'Tipo de procedimiento' },
  { key: 'plazoEntrega', label: 'Plazo entrega (días)' },
  { key: 'fechaConvocatoria', label: 'Fecha aproximada de convocatoria' },
];

/**
 * Solicitud de anuncio de contratación futura: pantalla inicial (solo frontend, sin backend simulado todavía).
 * Muestra la cabecera de la solicitud nueva, el seguimiento del proceso y la sección vacía a la espera de elegir
 * una opción con el botón «+», que muestra el registro con «Contratación segmentada». La lupa abre el panel
 * «Contrataciones segmentadas 2026» (catálogo simulado con búsqueda, paginación y filtros por objeto, origen y N° de
 * modificación del CMN). «Aceptar» de la sección se habilita al completar el registro (contratación, alcance, plazo de
 * entrega y fecha de convocatoria); todavía no ejecuta ninguna acción.
 */
@Component({
  selector: 'siaf-anuncio-contratacion-futura',
  standalone: true,
  imports: [
    ButtonComponent,
    DateTimePickerComponent,
    IconComponent,
    PopoverComponent,
    ReadonlyFieldComponent,
    SelectionSideNavComponent,
    SolicitudeFormCardComponent,
    SolicitudeInfoCardComponent,
    SolicitudePageLayoutComponent,
    SummaryCardComponent,
    TableComponent,
    TextAreaControlComponent,
    TextFieldComponent,
    TimelineComponent,
  ],
  template: `
    <div class="min-h-[calc(100vh-56px)] bg-[var(--sys-color-bg-surfaces-surface-lowest)] text-text">
      <siaf-solicitude-page-layout
        [breadcrumbs]="breadcrumbs"
        role="creator"
        state="new"
        [heading]="heading"
        secondaryText="Creación"
        [showReturn]="true"
        [saveDisabled]="true"
        [verifyDisabled]="true"
        (returned)="regresar()"
        (canceled)="regresar()"
      >
        <siaf-solicitude-info-card [fields]="camposEntidad" [captureOpenDate]="true" />

        <siaf-timeline
          title="Seguimiento del proceso de Actuaciones preparatorias"
          processName="Actuaciones preparatorias"
          itemLabel="etapa"
          itemsLabel="etapas"
          [items]="etapas"
          [current]="0"
        />

        <siaf-solicitude-form-card [title]="registrando() ? 'Registro de anuncio de contratación futura' : 'Anuncio de contratación futura'">
          <div card-actions class="flex items-center gap-siaf-sm">
            @if (registrando()) {
              <siaf-button variant="outline" size="md" (click)="cancelarRegistro()">Cancelar</siaf-button>
              <siaf-button variant="filled" size="md" [disabled]="!registroCompleto()" (click)="agregarItem()">Aceptar</siaf-button>
            } @else {
              <siaf-button variant="accent" size="md" icon="add" [iconOnly]="true" ariaLabel="Agregar anuncio de contratación futura" (click)="registrando.set(true)" />
            }
          </div>

          @if (registrando()) {
            <div class="flex flex-col gap-siaf-sm">
              <div class="flex min-h-10 items-center justify-between gap-siaf-md">
                <h3 class="m-0 text-sm font-bold uppercase text-text">Contratación segmentada</h3>
                <siaf-button variant="accent" size="md" icon="search" [iconOnly]="true" ariaLabel="Seleccionar tipo de contratación" (click)="abrirPanel()" />
              </div>
              @if (contratacion()) {
                <siaf-summary-card
                  [fields]="camposContratacion()"
                  [bordered]="true"
                  closeLabel="Quitar contratación segmentada"
                  (closed)="quitarContratacion()"
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
                <readonly-field caption="Tipo de procedimiento" [value]="c.tipoProcedimiento" />
                <text-area-control
                  placeholder="Alcance (Especificaciones Técnicas Preliminares)"
                  [maxlength]="1000"
                  [value]="alcance()"
                  (valueChange)="alcance.set($event)"
                />
                <div class="grid items-center gap-siaf-md md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <div class="relative">
                    <siaf-input
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
                  @if (c.objeto !== 'Obra') {
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
                </div>
              </div>
            }
          } @else if (items().length > 0) {
            <h3 class="m-0 text-sm font-bold uppercase text-text">Anuncios registrados</h3>
            <siaf-table [columns]="columnasItems" [rows]="filasItems()" />
          } @else {
            <div class="flex min-h-[49px] items-center rounded-siaf-md bg-[var(--sys-color-bg-surfaces-surface-low)] px-siaf-md py-siaf-sm">
              <p class="m-0 text-sm text-[var(--sys-color-text-neutral-medium)]">Por favor, haga clic en el botón (+) para seleccionar una opción.</p>
            </div>
          }
        </siaf-solicitude-form-card>
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
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnuncioContratacionFuturaComponent {
  private readonly router = inject(Router);

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
  readonly fechaConvocatoria = signal('');
  /** El registro está completo cuando hay contratación elegida, alcance, un plazo de entrega válido y la fecha de convocatoria. */
  readonly registroCompleto = computed(() =>
    !!this.contratacion()
    && !!this.alcance().trim()
    && Number(this.plazoEntrega()) > 0
    && !!this.fechaConvocatoria(),
  );

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
      { label: 'Origen', value: c.origen },
    ];
  });

  cantidadTexto(c: ContratacionSegmentada): string {
    return c.cantidadAproximada.toLocaleString('en-US');
  }

  quitarContratacion(): void {
    this.contratacion.set(null);
    this.alcance.set('');
    this.plazoEntrega.set('');
    this.fechaConvocatoria.set('');
    this.cerrarAyuda();
  }

  // ── Anuncios registrados (grilla) ──────────────────────────────────
  readonly items = signal<AnuncioItem[]>([]);
  readonly columnasItems = COLUMNAS_ITEMS;
  readonly filasItems = computed<DataTableRow[]>(() =>
    this.items().map((item) => ({
      id: item.id,
      codigo: item.contratacion.codigo,
      descripcion: item.contratacion.descripcion,
      objeto: item.contratacion.objeto,
      tipoProcedimiento: item.contratacion.tipoProcedimiento,
      plazoEntrega: item.plazoEntrega,
      fechaConvocatoria: item.fechaConvocatoria.split('-').reverse().join('/'),
    })),
  );

  /** «Aceptar»: agrega el registro armado a la grilla y vuelve al estado «sin registrar» para poder agregar otro. */
  agregarItem(): void {
    const c = this.contratacion();
    if (!c || !this.registroCompleto()) return;

    this.items.update((lista) => [
      ...lista,
      { id: crypto.randomUUID(), contratacion: c, alcance: this.alcance(), plazoEntrega: this.plazoEntrega(), fechaConvocatoria: this.fechaConvocatoria() },
    ]);
    this.quitarContratacion();
    this.registrando.set(false);
  }

  cancelarRegistro(): void {
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
    return CONTRATACIONES_SEGMENTADAS.filter((c) =>
      (!objeto || c.objeto === objeto)
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
    this.cerrarPanel();
  }

  readonly heading = NOMBRE_DOCUMENTO;
  readonly breadcrumbs: BreadcrumbItem[] = buildProcessBreadcrumbs(PROCESS_ID, PROCESS_ROUTE, 'Anuncio de contratación futura');

  readonly camposEntidad: SolicitudeInfoField[] = [
    { label: 'Fecha', value: '' },
    { label: 'Ente rector', value: 'MINISTERIO DE ECONOMÍA Y FINANZAS' },
    { label: 'Entidad/ U.E./ ...', value: 'DEPARTAMENTO ENCARGADO DE LAS CONTRATACIONES' },
  ];

  readonly etapas: TimelineItem[] = [
    { label: 'Anuncio de contratación futura' },
    { label: 'Segmentación' },
    { label: 'Formulación de Requerimiento' },
    { label: 'Estrategia de contratación' },
    { label: 'Interacción con el mercado' },
    { label: 'Designación de evaluadores' },
    { label: 'Aprobación de expediente de contratación' },
    { label: 'Elaboración de bases' },
  ];

  regresar(): void {
    void this.router.navigate(['/panel']);
  }
}
