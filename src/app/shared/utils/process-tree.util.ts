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
 * Árbol de procesos del taller. Solo «Actuaciones Preparatorias» está implementado (la hoja «Documentos y registros de…» tiene la `moduleRoute`
 * que abre Documentos y registros, y de ahí se llega a la solicitud de anuncio de contratación futura); el resto son ejemplos de cómo se
 * ve un proceso planificado («Próximamente»). Para sumar un proceso: un nodo con `moduleRoute` (Documentos y
 * registros) y, si hace falta, otro para sus consultas, y sus rutas en `app.routes.ts`.
 *
 * El proceso «Registro de cuentas bancarias» (`modules/tesoreria/`) ya no está en el árbol ni en las rutas.
 */
export const DEFAULT_PROCESS_TREE: ProcessMenuNode[] = [
  {
    id: 'gestion-abastecimiento',
    label: 'Gestión de abastecimiento',
    comingSoon: true,
    expanded: true,
    children: [
      {
        id: 'actuaciones-preparatorias',
        label: 'Actuaciones Preparatorias',
        expanded: true,
        children: [
          {
            id: 'documentos-registros-actuaciones-preparatorias',
            label: 'Documentos y registros de Actuaciones Preparatorias',
            moduleRoute: '/procesos/actuaciones-preparatorias',
            selected: true,
          },
          {
            id: 'consultas-reportes-actuaciones-preparatorias',
            label: 'Consultas y reportes de Actuaciones Preparatorias',
            comingSoon: true,
          },
          {
            id: 'configuracion-actuaciones-preparatorias',
            label: 'Configuración de Actuaciones Preparatorias',
            comingSoon: true,
          },
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
