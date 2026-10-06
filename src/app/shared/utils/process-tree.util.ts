/**
 * Árbol maestro de procesos + utilidad de búsqueda de ruta.
 * Vive en shared/utils/ (no en layout/) porque lo consumen tanto piezas
 * del shell (layout/process-menu-tree, layout/create-document) como
 * utilidades transversales de shared (breadcrumbs.util) — shared no debe
 * depender de layout, así que la fuente de verdad va acá.
 */
export interface ProcessMenuNode {
  id: string;
  label: string;
  selected?: boolean;
  // Arranca la rama abierta (root o anidado).
  expanded?: boolean;
  // Ruta de la página principal del módulo (documentos y registros)
  moduleRoute?: string;
  // Si un nodo tiene estas propiedades, Crear documento puede completar documento/tipo y navegar.
  createRoute?: string;
  documentOptions?: string[];
  documentCreateOptions?: Array<{
    label: string;
    route?: string;
    actionTypes?: string[];
  }>;
  actionTypeOptions?: string[];
  /**
   * Marca un nodo como módulo planificado pero aún no implementado.
   * El menú lo renderiza con texto atenuado y badge "Próximamente",
   * y el click no navega (solo expande si tiene hijos).
   */
  comingSoon?: boolean;
  children?: ProcessMenuNode[];
}

/**
 * Árbol de procesos del taller. Solo «Actuaciones preparatorias» está implementado (su `moduleRoute` abre Documentos
 * y registros, y de ahí se llega a la solicitud de anuncio de contratación futura); el resto son ejemplos de cómo se
 * ve un proceso planificado («Próximamente»). Para sumar un proceso: un nodo con `moduleRoute` (Documentos y
 * registros) y, si hace falta, otro para sus consultas, y sus rutas en `app.routes.ts`.
 *
 * El proceso «Registro de cuentas bancarias» (`modules/tesoreria/`) ya no está en el árbol ni en las rutas.
 */
export const DEFAULT_PROCESS_TREE: ProcessMenuNode[] = [
  {
    id: 'gestion-abastecimiento',
    label: 'Gestión de Abastecimiento',
    comingSoon: true,
    expanded: true,
    children: [
      {
        id: 'actuaciones-preparatorias',
        label: 'Actuaciones preparatorias',
        moduleRoute: '/procesos/actuaciones-preparatorias',
        expanded: true,
        selected: true,
        children: [
          { id: 'segmentacion', label: 'Segmentación', comingSoon: true },
          { id: 'formulacion-requerimiento', label: 'Formulación de Requerimiento', comingSoon: true },
          { id: 'estrategia-contratacion', label: 'Estrategia de contratación', comingSoon: true },
          { id: 'interaccion-mercado', label: 'Interacción con el mercado', comingSoon: true },
          { id: 'designacion-evaluadores', label: 'Designación de evaluadores', comingSoon: true },
          { id: 'aprobacion-expediente-contratacion', label: 'Aprobación de expediente de contratación', comingSoon: true },
          { id: 'elaboracion-bases', label: 'Elaboración de bases', comingSoon: true },
        ],
      },
      { id: 'clasificadores-catalogos', label: 'Clasificadores y catálogos', comingSoon: true },
      { id: 'consultas-reportes-abastecimiento', label: 'Consultas y reportes', comingSoon: true },
    ],
  },
];

export function findProcessPathById(id: string, nodes: readonly ProcessMenuNode[] = DEFAULT_PROCESS_TREE): ProcessMenuNode[] {
  for (const node of nodes) {
    if (node.id === id) {
      return [node];
    }

    const childPath = findProcessPathById(id, node.children || []);

    if (childPath.length > 0) {
      return [node, ...childPath];
    }
  }

  return [];
}

/**
 * Árbol del menú "Ajustes" (módulo de administración). Lo pinta el mismo `siaf-process-menu-tree`
 * que el menú de procesos, con otros textos. En el taller no hay módulo de administración: las hojas
 * van como «Próximamente» y no navegan.
 */
export const ADMIN_MENU_TREE: ProcessMenuNode[] = [
  {
    id: 'administracion',
    label: 'Administración',
    expanded: true,
    children: [
      {
        id: 'usuarios-accesos',
        label: 'Usuarios y accesos',
        expanded: true,
        children: [
          { id: 'gestion-usuarios', label: 'Gestión de usuarios', comingSoon: true },
          { id: 'perfiles-funcionales', label: 'Perfiles funcionales', comingSoon: true },
        ],
      },
      {
        id: 'organizacion',
        label: 'Organización',
        children: [
          { id: 'entidades', label: 'Entidades', comingSoon: true },
          { id: 'unidades', label: 'Unidades orgánicas', comingSoon: true },
        ],
      },
    ],
  },
];
