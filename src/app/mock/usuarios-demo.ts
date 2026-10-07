import type { PerfilItem } from '../core/api/auth-api.service';

/**
 * Usuarios de demostración del taller. Entran con su DNI y la contraseña común.
 *
 * - Ana (creador) registra y verifica solicitudes.
 * - Luis (aprobador) aprueba, observa o rechaza lo verificado.
 * - Carla tiene los dos perfiles: sirve para mostrar el cambio de perfil desde el menú del usuario.
 *
 * Son datos de ejemplo: no hay contraseñas reales ni se validan contra un servidor.
 */
export const CONTRASENA_DEMO = 'Taller2026*';

export interface UsuarioDemo {
  id: string;
  dni: string;
  email: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  /** Qué muestra en el panel de usuarios del login. */
  descripcion: string;
  perfiles: PerfilItem[];
}

const ENTIDAD = {
  entidad: 'Ministerio de Economía y Finanzas',
  entidadId: 'ent-mef',
  entidadCodigo: '0001',
  entidadSiglas: 'MEF',
  // La barra superior muestra solo «DEC»: Unidad Ejecutora como identidad y sin sigla de unidad orgánica.
  ue: 'Departamento Encargado de las Contrataciones',
  ueId: 'ue-dec',
  ueSiglas: 'DEC',
  unidad: 'Departamento Encargado de las Contrataciones',
  unidadSigla: '',
  unidadId: 'uo-dec',
  procedimiento: 'Actuaciones preparatorias',
  procedimientoCodigo: 'ACP',
  nivelAmbito: 'UE' as const,
  entidadAmbitoId: 'amb-gn',
  entidadAmbitoCodigo: 'GN',
};

function perfil(id: string, usuarioId: string, rolCodigo: 'CREADOR' | 'APROBADOR', rol: string, perfilFuncional: string): PerfilItem {
  return { id, usuarioId, ...ENTIDAD, rol, rolCodigo, perfilFuncional };
}

export const USUARIOS_DEMO: UsuarioDemo[] = [
  {
    id: 'usr-ana',
    dni: '11111111',
    email: 'ana.torres@taller.pe',
    nombres: 'Ana',
    apellidoPaterno: 'Torres',
    apellidoMaterno: 'Díaz',
    descripcion: 'Creador: registra y verifica solicitudes',
    perfiles: [perfil('perfil-ana-creador', 'usr-ana', 'CREADOR', 'Creador', 'Operador de contrataciones')],
  },
  {
    id: 'usr-luis',
    dni: '22222222',
    email: 'luis.ramirez@taller.pe',
    nombres: 'Luis',
    apellidoPaterno: 'Ramírez',
    apellidoMaterno: 'Soto',
    descripcion: 'Aprobador: aprueba, observa o rechaza',
    perfiles: [perfil('perfil-luis-aprobador', 'usr-luis', 'APROBADOR', 'Aprobador', 'Aprobador de contrataciones')],
  },
  {
    id: 'usr-carla',
    dni: '33333333',
    email: 'carla.mendoza@taller.pe',
    nombres: 'Carla',
    apellidoPaterno: 'Mendoza',
    apellidoMaterno: 'Ríos',
    descripcion: 'Dos perfiles: creador y aprobador (cambia de perfil)',
    perfiles: [
      perfil('perfil-carla-creador', 'usr-carla', 'CREADOR', 'Creador', 'Operador de contrataciones'),
      perfil('perfil-carla-aprobador', 'usr-carla', 'APROBADOR', 'Aprobador', 'Aprobador de contrataciones'),
    ],
  },
];

export function buscarUsuarioPorPerfil(perfilId: string): { usuario: UsuarioDemo; perfil: PerfilItem } | null {
  for (const usuario of USUARIOS_DEMO) {
    const encontrado = usuario.perfiles.find((p) => p.id === perfilId);
    if (encontrado) return { usuario, perfil: encontrado };
  }
  return null;
}
