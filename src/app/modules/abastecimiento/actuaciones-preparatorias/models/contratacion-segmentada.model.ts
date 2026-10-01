import type { SelectionColumn } from '../../../../shared/components/selection-side-nav/selection-side-nav.component';
import type { TextFieldOption } from '../../../../shared/ui/text-field/text-field.component';

export type ContratacionSegmentada = {
  id: string;
  codigo: string;
  descripcion: string;
  objeto: string;
  origen: string;
  /** N° de modificación del CMN; vacío cuando el origen es PAC. */
  modificacionCmn: string;
  tipoProcedimiento: string;
  monto: number;
  cantidadAproximada: number;
};

export const TOTAL_CONTRATACIONES = 800;

export const OPCIONES_OBJETO: TextFieldOption[] = ['Obra', 'Bien', 'Servicio', 'Consultoría de obra'].map((v) => ({ label: v, value: v }));
export const OPCIONES_ORIGEN: TextFieldOption[] = ['PAC', 'CMN'].map((v) => ({ label: v, value: v }));
export const OPCIONES_MODIFICACION_CMN: TextFieldOption[] = ['1', '2', '3', '4'].map((v) => ({ label: v, value: v }));

type Plantilla = Pick<ContratacionSegmentada, 'descripcion' | 'objeto' | 'tipoProcedimiento' | 'monto'>;

const CANTIDAD_APROXIMADA = 100_000;

const PLANTILLAS: Plantilla[] = [
  { descripcion: 'Construcción de almacén central para medicamentos e insumos médicos', objeto: 'Obra', tipoProcedimiento: 'Licitación pública de obras', monto: 5_300_000 },
  { descripcion: 'Adquisición de equipos de cadena de frío para establecimientos de salud', objeto: 'Bien', tipoProcedimiento: 'Licitación pública para bienes', monto: 1_250_000 },
  { descripcion: 'Servicio de limpieza integral para establecimientos de salud', objeto: 'Servicio', tipoProcedimiento: 'Concurso público de servicios', monto: 850_000 },
  { descripcion: 'Adquisición de medicamentos oncológicos para hospitales de la red asistencial', objeto: 'Bien', tipoProcedimiento: 'Licitación pública para bienes', monto: 980_000 },
  { descripcion: 'Elaboración del expediente técnico para el mejoramiento del Hospital Provincial', objeto: 'Consultoría de obra', tipoProcedimiento: 'Concurso público de consultoría de obras', monto: 720_000 },
];

/**
 * Catálogo simulado. Las 4 primeras filas son las del diseño (PAC); el resto repite las plantillas con otro código y
 * monto, y una de cada 7 (desde la fila 8) es del CMN con su N° de modificación.
 */
export const CONTRATACIONES_SEGMENTADAS: ContratacionSegmentada[] = Array.from({ length: TOTAL_CONTRATACIONES }, (_, i) => {
  const plantilla = PLANTILLAS[i % PLANTILLAS.length];
  const codigo = String(i + 1).padStart(4, '0');
  const esCmn = i >= 7 && i % 7 === 0;
  return {
    ...plantilla,
    id: codigo,
    codigo,
    origen: esCmn ? 'CMN' : 'PAC',
    modificacionCmn: esCmn ? String((i % 4) + 1) : '',
    monto: i < PLANTILLAS.length ? plantilla.monto : plantilla.monto + i * 1_000,
    cantidadAproximada: CANTIDAD_APROXIMADA,
  };
});

export const COLUMNAS_CONTRATACION: SelectionColumn<ContratacionSegmentada>[] = [
  { key: 'codigo', label: 'Código', widthClass: 'w-24' },
  { key: 'descripcion', label: 'Descripción', widthClass: 'min-w-[280px]' },
  { key: 'objeto', label: 'Objeto de contratación', widthClass: 'w-40' },
  { key: 'origen', label: 'Origen', widthClass: 'w-24' },
  { key: 'tipoProcedimiento', label: 'Tipo de procedimiento', widthClass: 'w-56' },
  {
    key: 'monto',
    label: 'Monto de contratación',
    widthClass: 'w-48',
    cellClass: 'whitespace-nowrap text-right',
    render: (fila) => `S/ ${fila.monto.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
  },
];
