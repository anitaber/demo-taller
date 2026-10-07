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

export const OPCIONES_OBJETO: TextFieldOption[] = ['Obra', 'Bien', 'Servicio', 'Consultoría de obra'].map((v) => ({ label: v, value: v }));
export const OPCIONES_ORIGEN: TextFieldOption[] = ['PAC', 'CMN'].map((v) => ({ label: v, value: v }));
export const OPCIONES_MODIFICACION_CMN: TextFieldOption[] = ['1', '2', '3', '4'].map((v) => ({ label: v, value: v }));

// [descripción, objeto, origen, N° de modificación del CMN, tipo de procedimiento, monto]
const FILAS: Array<[string, string, string, string, string, number]> = [
  ['Construcción de almacén central para medicamentos e insumos médicos', 'Obra', 'PAC', '', 'Licitación pública de obras', 5_300_000],
  ['Adquisición de equipos de cadena de frío para establecimientos de salud', 'Bien', 'PAC', '', 'Licitación pública para bienes', 1_250_000],
  ['Servicio de limpieza integral para establecimientos de salud', 'Servicio', 'PAC', '', 'Concurso público de servicios', 850_000],
  ['Adquisición de medicamentos oncológicos para hospitales de la red asistencial', 'Bien', 'PAC', '', 'Licitación pública para bienes', 980_000],
  ['Elaboración del expediente técnico para el mejoramiento del Hospital Provincial', 'Consultoría de obra', 'PAC', '', 'Concurso público con precalificación', 750_000],
  ['Adquisición de equipos informáticos para sedes administrativas', 'Bien', 'PAC', '', 'Licitación pública para bienes', 680_000],
  ['Mejoramiento del servicio de emergencia del Hospital Provincial', 'Obra', 'PAC', '', 'Licitación pública de obras con negociación', 5_750_000],
  ['Adquisición de mobiliario clínico para establecimientos de salud', 'Bien', 'PAC', '', 'Licitación pública para bienes', 540_000],
  ['Adquisición de reactivos e insumos para laboratorio clínico', 'Bien', 'PAC', '', 'Licitación pública para bienes especializados', 1_480_000],
  ['Construcción de ambientes de hospitalización y UCI del Hospital de Cañete', 'Obra', 'PAC', '', 'Licitación pública de obras con precalificación', 8_500_000],
  ['Construcción de nueva infraestructura para el Centro de Salud San Antonio', 'Obra', 'PAC', '', 'Licitación pública de obras', 7_800_000],
  ['Adquisición de medicamentos para el abastecimiento de establecimientos de salud', 'Bien', 'CMN', '1', '-', 720_000],
  ['Mejoramiento de la infraestructura del Centro de Salud Santa Rosa', 'Obra', 'CMN', '1', '-', 5_850_000],
  ['Ampliación del servicio de emergencia del Hospital Regional', 'Obra', 'CMN', '1', '-', 7_400_000],
  ['Construcción de almacén especializado para medicamentos e insumos médicos', 'Obra', 'CMN', '1', '-', 6_100_000],
  ['Mejoramiento y ampliación del sistema de redes sanitarias del Hospital Provincial', 'Obra', 'CMN', '1', '-', 5_600_000],
  ['Construcción de ambientes para farmacia y laboratorio clínico', 'Obra', 'CMN', '1', '-', 5_250_000],
  ['Servicio de mantenimiento preventivo y correctivo de equipos biomédicos', 'Servicio', 'CMN', '2', '-', 620_000],
  ['Servicio de limpieza integral para establecimientos de salud', 'Servicio', 'CMN', '2', '-', 890_000],
  ['Servicio de seguridad y vigilancia para sedes administrativas y asistenciales', 'Servicio', 'CMN', '2', '-', 1_150_000],
  ['Servicio de mantenimiento preventivo de equipos electromecánicos hospitalarios', 'Servicio', 'CMN', '2', '-', 680_000],
  ['Servicio de mantenimiento rutinario de infraestructura hospitalaria', 'Servicio', 'CMN', '2', '-', 510_000],
  ['Supervisión de la ejecución de obra del Centro de Salud San Antonio', 'Consultoría de obra', 'CMN', '3', '-', 560_000],
  ['Servicio de mantenimiento integral de sistemas de climatización hospitalaria', 'Servicio', 'CMN', '3', '-', 540_000],
  ['Servicio de transporte y distribución de medicamentos e insumos médicos', 'Servicio', 'CMN', '3', '-', 760_000],
  ['Mejoramiento y ampliación del Centro de Salud San Miguel', 'Obra', 'CMN', '4', '-', 6_200_000],
  ['Servicio especializado de mantenimiento de equipos de diagnóstico por imágenes', 'Servicio', 'CMN', '4', '-', 925_000],
];

const CANTIDAD_APROXIMADA = 100_000;

/** Catálogo simulado: las 27 contrataciones segmentadas del diseño (Figma 21081:41749), 11 del PAC y 16 del CMN. */
export const CONTRATACIONES_SEGMENTADAS: ContratacionSegmentada[] = FILAS.map(
  ([descripcion, objeto, origen, modificacionCmn, tipoProcedimiento, monto], i) => {
    const codigo = String(i + 1).padStart(4, '0');
    return { id: codigo, codigo, descripcion, objeto, origen, modificacionCmn, tipoProcedimiento, monto, cantidadAproximada: CANTIDAD_APROXIMADA };
  },
);

export const TOTAL_CONTRATACIONES = CONTRATACIONES_SEGMENTADAS.length;

/** La cantidad aproximada solo aplica a bienes (y consultoría): las obras y los servicios no la llevan. */
export function llevaCantidadAproximada(objeto: string): boolean {
  return objeto !== 'Obra' && objeto !== 'Servicio';
}

/** Origen como se muestra: «PAC» o «CMN – Mod. 1». */
export function origenTexto(c: Pick<ContratacionSegmentada, 'origen' | 'modificacionCmn'>): string {
  return c.origen === 'CMN' && c.modificacionCmn ? `CMN – Mod. ${c.modificacionCmn}` : c.origen;
}


export const COLUMNAS_CONTRATACION: SelectionColumn<ContratacionSegmentada>[] = [
  { key: 'codigo', label: 'Código', widthClass: 'w-24' },
  { key: 'descripcion', label: 'Descripción', widthClass: 'min-w-[280px]' },
  { key: 'objeto', label: 'Objeto de contratación', widthClass: 'w-40' },
  { key: 'origen', label: 'Origen', widthClass: 'w-36', render: (fila) => origenTexto(fila) },
  { key: 'tipoProcedimiento', label: 'Tipo de procedimiento', widthClass: 'w-56' },
  {
    key: 'monto',
    label: 'Monto de contratación',
    widthClass: 'w-48',
    cellClass: 'whitespace-nowrap text-right',
    render: (fila) => `S/ ${fila.monto.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
  },
];
