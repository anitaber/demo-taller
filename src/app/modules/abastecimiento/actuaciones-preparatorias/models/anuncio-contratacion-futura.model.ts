/**
 * Proceso «Actuaciones preparatorias»: documento «Solicitud de anuncio de contratación futura» (SACF).
 *
 * Una solicitud reúne uno o más anuncios (una contratación segmentada con su alcance, plazo de entrega y fecha de
 * convocatoria). El creador la graba y la verifica; el aprobador la aprueba, la observa o la rechaza. Al aprobarse,
 * cada anuncio pasa a los registros (pestaña Registros).
 */

export type EstadoRegistro = 'Activo' | 'Inactivo';

/** Código del documento en el catálogo de documentos. */
export const CODIGO_DOCUMENTO = 'SACF';
export const NOMBRE_DOCUMENTO = 'Solicitud de anuncio de contratación futura';

/** Un anuncio dentro de la solicitud: la contratación elegida más lo que el creador completa. */
export interface AnuncioItemDatos {
  id: string;
  contratacionCodigo: string;
  descripcion: string;
  objeto: string;
  origen: string;
  tipoProcedimiento: string;
  /** Solo aplica a bienes y servicios: para una obra no se informa. */
  cantidadAproximada: number | null;
  alcance: string;
  /** Días calendario. */
  plazoEntrega: number;
  /** Fecha aproximada de convocatoria (yyyy-mm-dd). */
  fechaConvocatoria: string;
}

/** Un anuncio aprobado: la pestaña Registros. */
export interface AnuncioRegistro extends AnuncioItemDatos {
  /** Código correlativo del registro (ACF-0001). */
  codigo: string;
  estado: EstadoRegistro;
  entidadSiglas: string;
  /** Solicitud que lo creó. */
  documentoId: string;
  numeroDocumento: string;
  /** Fecha de aprobación (ISO). */
  fechaRegistro: string;
  /** Estado de la publicación; sin dato, «Publicado» (un anuncio aprobado queda publicado hasta que se despublica). */
  publicacion?: 'Publicado' | 'Despublicado';
}
