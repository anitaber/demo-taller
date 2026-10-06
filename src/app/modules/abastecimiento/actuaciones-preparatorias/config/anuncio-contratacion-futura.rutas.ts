import type { CreateDocumentProcessOption } from '../../../../shared/components/create-document/create-document.component';
import { NOMBRE_DOCUMENTO } from '../models/anuncio-contratacion-futura.model';

/** Rutas e ids de «Actuaciones preparatorias». `PROCESS_ID` es el nodo del árbol de procesos (`DEFAULT_PROCESS_TREE`). */
export const PROCESS_ID = 'actuaciones-preparatorias';
export const PROCESS_ROUTE = '/procesos/actuaciones-preparatorias';
export const REQUEST_SEGMENT = 'anuncio-contratacion-futura';
export const REQUEST_ROUTE = `${PROCESS_ROUTE}/${REQUEST_SEGMENT}`;

/** Opción del panel «Crear documento» (shell y pestaña Documentos). */
export const CREATE_DOCUMENT_OPTIONS: CreateDocumentProcessOption[] = [
  {
    id: PROCESS_ID,
    label: 'Actuaciones preparatorias',
    route: REQUEST_ROUTE,
    documents: [NOMBRE_DOCUMENTO],
    documentOptions: [{ label: NOMBRE_DOCUMENTO, route: REQUEST_ROUTE, actionTypes: ['Creación'] }],
    actionTypes: ['Creación'],
  },
];
