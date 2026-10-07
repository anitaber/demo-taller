import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, ViewChild, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

import { FocoDirective } from '../../../../../shared/ui/foco/foco.directive';
import { IconComponent } from '../../../../../shared/ui/icon/icon.component';
import { AnuncioRegistro } from '../../models/anuncio-contratacion-futura.model';

const TITULO = 'ANUNCIO DE CONTRATACIÓN FUTURA';
const NOMBRE_ARCHIVO = `${TITULO}.pdf`;

// Colores del PDF (no son de la interfaz): azul del encabezado de la tabla y gris de los bordes.
const AZUL_PDF: [number, number, number] = [0, 74, 152];
const GRIS_PDF: [number, number, number] = [200, 200, 200];

const dos = (n: number): string => String(n).padStart(2, '0');
const fechaCorta = (f: Date): string => `${dos(f.getDate())}/${dos(f.getMonth() + 1)}/${f.getFullYear()}`;
const hora = (f: Date): string => `${dos(f.getHours())}:${dos(f.getMinutes())}:${dos(f.getSeconds())}`;

/**
 * Visor del documento de un anuncio aprobado (Figma: «ANUNCIO DE CONTRATACIÓN FUTURA.pdf»), que abre
 * `AnunciosDocumentsComponent` desde el ícono de archivo de la pestaña Registros.
 *
 * Arma el PDF en el navegador con los datos del `registro` (entidad, fecha y estado de la publicación y el detalle del
 * anuncio: tipo de procedimiento, objeto, descripción, alcance, cantidad, plazo y fecha de convocatoria) y lo muestra
 * a pantalla completa con una barra para cerrar, descargar e imprimir. Se cierra con la X o Escape.
 */
@Component({
  selector: 'siaf-anuncio-documento-visor',
  standalone: true,
  imports: [FocoDirective, IconComponent],
  template: `
    @if (open) {
      <section
        class="fixed inset-0 z-50 flex flex-col bg-black/60"
        role="dialog"
        aria-modal="true"
        aria-label="Documento del anuncio de contratación futura"
        [siafFoco]="open"
        (siafFocoEscape)="closed.emit()"
      >
        <header class="flex h-14 shrink-0 items-center gap-siaf-md px-siaf-md text-white">
          <button class="inline-flex size-10 items-center justify-center rounded-siaf-md transition hover:bg-white/15" type="button" aria-label="Cerrar documento" (click)="closed.emit()">
            <siaf-icon name="close" [size]="24" />
          </button>
          <h2 class="m-0 min-w-0 flex-1 truncate text-sm font-medium">{{ nombreArchivo }}</h2>
          @if (urlDescarga()) {
            <a class="inline-flex size-10 items-center justify-center rounded-siaf-md transition hover:bg-white/15" [href]="urlDescarga()" [download]="nombreArchivo" aria-label="Descargar documento">
              <siaf-icon name="download" [size]="24" />
            </a>
            <button class="inline-flex size-10 items-center justify-center rounded-siaf-md transition hover:bg-white/15" type="button" aria-label="Imprimir documento" (click)="imprimir()">
              <siaf-icon name="print" [size]="24" />
            </button>
          }
        </header>

        <div class="min-h-0 flex-1">
          @if (urlVisor(); as url) {
            <iframe #visor class="size-full border-0" title="Vista del documento" [src]="url"></iframe>
          } @else {
            <p class="m-0 p-siaf-lg text-center text-sm text-white">Generando el documento…</p>
          }
        </div>
      </section>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnuncioDocumentoVisorComponent implements OnChanges, OnDestroy {
  private readonly sanitizer = inject(DomSanitizer);

  @Input() open = false;
  @Input() registro: AnuncioRegistro | null = null;
  @Output() closed = new EventEmitter<void>();
  @ViewChild('visor') private visor?: ElementRef<HTMLIFrameElement>;

  readonly nombreArchivo = NOMBRE_ARCHIVO;
  readonly urlVisor = signal<SafeResourceUrl | null>(null);
  readonly urlDescarga = signal<string | null>(null);

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['open'] && !changes['registro']) return;
    if (this.open && this.registro) void this.generar(this.registro);
    else this.liberar();
  }

  ngOnDestroy(): void {
    this.liberar();
  }

  imprimir(): void {
    const ventana = this.visor?.nativeElement.contentWindow;
    ventana?.focus();
    ventana?.print();
  }

  private liberar(): void {
    const url = this.urlDescarga();
    if (url) URL.revokeObjectURL(url);
    this.urlDescarga.set(null);
    this.urlVisor.set(null);
  }

  /** Logo SIAF-RP a color (el del diseño), pasado de SVG a PNG para poder ponerlo en el PDF. */
  private async logoComoPng(): Promise<{ datos: string; proporcion: number } | null> {
    try {
      const svg = await (await fetch('assets/figma/logos/siaf-rp-default-color.svg')).text();
      // El SVG viene con width/height al 100%: se fija un tamaño para poder dibujarlo.
      const ancho = 960;
      const alto = Math.round((ancho * 40.8904) / 160.372);
      const fijo = svg.replace('width="100%" height="100%"', `width="${ancho}" height="${alto}"`);
      const url = URL.createObjectURL(new Blob([fijo], { type: 'image/svg+xml' }));
      const imagen = new Image();
      imagen.src = url;
      await imagen.decode();
      const lienzo = document.createElement('canvas');
      lienzo.width = ancho;
      lienzo.height = alto;
      lienzo.getContext('2d')?.drawImage(imagen, 0, 0, ancho, alto);
      URL.revokeObjectURL(url);
      return { datos: lienzo.toDataURL('image/png'), proporcion: ancho / alto };
    } catch {
      return null;
    }
  }

  private async generar(r: AnuncioRegistro): Promise<void> {
    this.liberar();
    const [{ default: jsPDF }, { default: autoTable }, logo] = await Promise.all([import('jspdf'), import('jspdf-autotable'), this.logoComoPng()]);

    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    const ancho = pdf.internal.pageSize.getWidth();
    const alto = pdf.internal.pageSize.getHeight();
    const margen = 8.5;
    const negro: [number, number, number] = [32, 32, 32];

    // Encabezado: título (más o menos 80 mm de ancho, como en el diseño) y logo SIAF-RP a la derecha.
    pdf.setFont('helvetica', 'bold').setFontSize(14).setTextColor(...negro);
    pdf.setFontSize((14 * 80) / pdf.getTextWidth(TITULO));
    pdf.text(TITULO, margen, 15);
    if (logo) {
      const anchoLogo = 34;
      pdf.addImage(logo.datos, 'PNG', ancho - margen - anchoLogo, 9, anchoLogo, anchoLogo / logo.proporcion);
    } else {
      pdf.setFontSize(16).setTextColor(...AZUL_PDF).text('SIAF-RP', ancho - margen, 15, { align: 'right' });
    }
    pdf.setDrawColor(...GRIS_PDF).setLineWidth(0.3).line(margen, 24, ancho - margen, 24);

    // Entidad y publicación.
    const publicacion = new Date(r.fechaRegistro);
    const campo = (etiqueta: string, valor: string, x: number, y: number): void => {
      pdf.setFont('helvetica', 'bold').setFontSize(7.5).setTextColor(...negro).text(etiqueta, x, y);
      pdf.setFont('helvetica', 'normal').setFontSize(9).text(valor, x, y + 4.6);
    };
    campo('Entidad', 'MINISTERIO DE ECONOMÍA Y FINANZAS', margen, 32);
    campo('Fecha de la Publicación', `${fechaCorta(publicacion)}   ${hora(publicacion)}`, margen, 47);
    campo('Estado', 'Publicado', ancho / 2 + 2, 47);

    // Detalle del anuncio.
    pdf.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...negro).text('Detalle del anuncio', margen, 68);
    const [anio, mes, dia] = r.fechaConvocatoria.split('-');
    const filas: string[][] = [
      ['TIPO DE PROCEDIMIENTO', r.tipoProcedimiento],
      ['OBJETO DE LA CONTRATACIÓN', r.objeto],
      ['DESCRIPCIÓN DEL OBJETO', r.descripcion.toUpperCase()],
      ['ALCANCE', r.alcance.toUpperCase()],
      ...(r.cantidadAproximada !== null ? [['CANTIDAD', r.cantidadAproximada.toLocaleString('en-US')]] : []),
      ['PLAZO DE ENTREGA EN DÍAS', String(r.plazoEntrega)],
      ['FECHA APROXIMADA DE LA CONVOCATORIA', `${dia}/${mes}/${anio}`],
    ];
    autoTable(pdf, {
      body: filas,
      startY: 72,
      margin: { left: margen, right: margen },
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: { top: 3, bottom: 3, left: 3, right: 3 }, lineColor: GRIS_PDF, lineWidth: 0.2, textColor: negro, valign: 'middle', minCellHeight: 9.8 },
      columnStyles: { 0: { cellWidth: 88, fillColor: AZUL_PDF, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 } },
    });

    // Pie de página.
    const creado = new Date();
    pdf.setFont('helvetica', 'italic').setFontSize(7).setTextColor(...negro);
    pdf.setDrawColor(...GRIS_PDF).setLineWidth(0.2).line(margen, alto - 9, ancho - margen, alto - 9);
    pdf.text(`Creado ${fechaCorta(creado)} - ${hora(creado)}`, margen, alto - 4.5);
    pdf.text('Página 1 de 1', ancho - margen, alto - 4.5, { align: 'right' });

    const url = URL.createObjectURL(pdf.output('blob'));
    this.urlDescarga.set(url);
    this.urlVisor.set(this.sanitizer.bypassSecurityTrustResourceUrl(`${url}#toolbar=0&navpanes=0`));
  }
}
