import { ESTADO } from '../../../../core/models/documento.model';
import type {
  DocumentsRecordsColumn,
  DocumentsRecordsConfig,
  DocumentsRecordsFilterOption,
  DocumentsRecordsMenuOption,
} from '../../../../shared/types/documents-records.types';
import { buildProcessBreadcrumbs } from '../../../../shared/utils/breadcrumbs.util';
import { NOMBRE_DOCUMENTO } from '../models/anuncio-contratacion-futura.model';
import { CREATE_DOCUMENT_OPTIONS, PROCESS_ID, PROCESS_ROUTE, REQUEST_ROUTE } from './anuncio-contratacion-futura.rutas';

/**
 * Configuración de «Documentos y registros» de Actuaciones preparatorias. La pantalla completa la pinta
 * `siaf-documents-records-page`: aquí solo se dice qué columnas, filtros y opciones tiene.
 */

const documentColumns: DocumentsRecordsColumn[] = [
  { key: 'document', label: 'Documento', visibility: 'visible', group: 'default', widthClass: 'w-[380px]', kind: 'document-link' },
  { key: 'number', label: 'Número', visibility: 'visible', group: 'default', widthClass: 'w-[280px]' },
  { key: 'actionType', label: 'Tipo de acción', visibility: 'visible', group: 'default', widthClass: 'w-[160px]' },
  { key: 'status', label: 'Estado', visibility: 'visible', group: 'default', widthClass: 'w-[150px]', kind: 'flow-status' },
  { key: 'system', label: 'Sistemas Nacionales', visibility: 'visible', group: 'default', widthClass: 'w-[240px]' },
  { key: 'date', label: 'Fecha de registro', visibility: 'visible', group: 'default', widthClass: 'w-[170px]' },
  { key: 'creator', label: 'Creador', visibility: 'visible', group: 'more', widthClass: 'w-[220px]' },
  { key: 'subject', label: 'Asunto/Motivo', visibility: 'hidden', group: 'more', widthClass: 'w-[280px]' },
  { key: 'requesterArea', label: 'Área solicitante', visibility: 'hidden', group: 'more', widthClass: 'w-[240px]' },
  { key: 'entity', label: 'Entidad', visibility: 'visible', group: 'more', widthClass: 'w-[320px]' },
  { key: 'evaluationDate', label: 'Fecha de evaluación', visibility: 'hidden', group: 'more', widthClass: 'w-[200px]' },
  { key: 'evaluationUser', label: 'Usuario de evaluación', visibility: 'hidden', group: 'more', widthClass: 'w-[220px]' },
  { key: 'approvalDate', label: 'Fecha de aprobación', visibility: 'hidden', group: 'more', widthClass: 'w-[200px]' },
  { key: 'approvalUser', label: 'Usuario de aprobación', visibility: 'hidden', group: 'more', widthClass: 'w-[220px]' },
];

/**
 * Registros de «Anuncio de contratación futura» (Figma 21081:43212): descripción y fecha aproximada, estado del
 * registro, el documento que lo creó (agrupado), y fijos a la derecha el estado de la publicación y el ícono del
 * documento, antes del historial.
 */
const recordColumns: DocumentsRecordsColumn[] = [
  { key: 'descripcion', label: 'Descripción', visibility: 'visible', group: 'default', widthClass: 'w-[550px]' },
  { key: 'fechaConvocatoria', label: 'Fec. aprox. contratación', visibility: 'visible', group: 'default', widthClass: 'w-[220px]' },
  { key: 'status', label: 'Estado del registro', visibility: 'visible', group: 'default', widthClass: 'w-[160px]', kind: 'record-status' },
  { key: 'numero', label: 'Número', visibility: 'visible', group: 'default', widthClass: 'w-[120px]', headerGroup: 'Documento' },
  { key: 'documentoDescripcion', label: 'Descripción', visibility: 'visible', group: 'default', widthClass: 'w-[280px]', headerGroup: 'Documento' },
  { key: 'publicacion', label: 'Estado de la publicación', visibility: 'visible', group: 'default', sticky: 'right', stickyWidth: 130 },
  { key: 'verDocumento', label: '', visibility: 'visible', group: 'default', kind: 'document-icon', sticky: 'right', stickyWidth: 56 },
];

const fieldsMenuOptions: DocumentsRecordsMenuOption[] = [
  { label: 'Documento' },
  { label: 'Tipo de acción' },
  { label: 'Estado' },
  { label: 'Fecha de registro', hasChildren: true },
  { label: 'Entidad' },
];

const filterCampoOptions: DocumentsRecordsFilterOption[] = [
  { label: 'Documento', value: 'document' },
  { label: 'Número', value: 'number' },
  { label: 'Tipo de acción', value: 'actionType' },
  { label: 'Estado', value: 'status' },
  { label: 'Fecha', value: 'date' },
  { label: 'Entidad', value: 'entity' },
];

const filterValorOptions: DocumentsRecordsFilterOption[] = [
  { label: ESTADO.ELABORADO, value: ESTADO.ELABORADO },
  { label: ESTADO.VERIFICADO, value: ESTADO.VERIFICADO },
  { label: ESTADO.APROBADO, value: ESTADO.APROBADO },
  { label: 'Creación', value: 'Creación' },
];

export const ANUNCIOS_DOCUMENTS_CONFIG: DocumentsRecordsConfig = {
  title: 'Actuaciones preparatorias',
  processId: PROCESS_ID,
  defaultRequestRoute: REQUEST_ROUTE,
  createDocumentOptions: CREATE_DOCUMENT_OPTIONS,
  breadcrumbs: buildProcessBreadcrumbs(PROCESS_ID, PROCESS_ROUTE),
  documentRows: [],
  recordRows: [],
  documentColumns,
  recordColumns,
  documentTableMinWidthClass: 'min-w-[2200px]',
  recordTableMinWidthClass: 'min-w-[1500px]',
  recordsSelectable: true,
  recordTrackKey: 'recordId',
  recordHistoryDocumentLabel: NOMBRE_DOCUMENTO,
  // El historial del registro tiene su propio panel (el del anuncio, con su contratación y trazabilidad).
  recordHistoryKind: 'personalizado',
  statusFilterOptions: [ESTADO.ELABORADO, ESTADO.VERIFICADO, ESTADO.OBSERVADO, ESTADO.APROBADO, ESTADO.RECHAZADO],
  actionTypeFilterOptions: ['Creación'],
  filterCampoOptions,
  filterValorOptions,
  fieldsMenuOptions,
  recordFilter1Label: 'Estado del registro',
  recordFilter1Key: 'status',
  recordFilter1Options: ['Activo', 'Inactivo'],
  // Arranca con «Estado del registro: Activo» aplicado, como en el diseño.
  recordFilter1Default: 'Activo',
  recordFilterCampoOptions: [
    { label: 'Estado del registro', value: 'status' },
    { label: 'Descripción', value: 'descripcion' },
    { label: 'Estado de la publicación', value: 'publicacion' },
  ],
  recordFilterValorOptions: [
    { label: 'Activo', value: 'Activo' },
    { label: 'Inactivo', value: 'Inactivo' },
    { label: 'Publicado', value: 'Publicado' },
  ],
};
