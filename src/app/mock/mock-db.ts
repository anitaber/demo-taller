import type { NotificacionResponse } from '../core/api/notificaciones-api.service';
import type { HistorialItem, SolicitudResponse } from '../core/api/solicitudes-api.service';
import type { EstadoDocumento } from '../core/models/documento.model';
import {
  CODIGO_DOCUMENTO as CODIGO_SACF,
  AnuncioRegistro,
  NOMBRE_DOCUMENTO as NOMBRE_SACF,
} from '../modules/abastecimiento/actuaciones-preparatorias/models/anuncio-contratacion-futura.model';
import {
  CODIGO_DOCUMENTO as CODIGO_SRCB,
  CuentaBancariaRegistro,
  NOMBRE_DOCUMENTO as NOMBRE_SRCB,
} from '../modules/tesoreria/cuentas-bancarias/models/cuenta-bancaria.model';
import { UsuarioDemo } from './usuarios-demo';

/**
 * «Base de datos» del backend simulado: vive en el `localStorage` del navegador, así lo que hace un usuario lo ve
 * otro al iniciar sesión (en el mismo navegador). `reiniciarDatosDemo()` vuelve al estado inicial, que arranca vacío:
 * sin solicitudes ni registros.
 */

const CLAVE = 'taller-siaf-rp:datos';
/** Subirla al cambiar la forma de los datos: los guardados con otra versión se descartan. */
const VERSION = 5;

export interface NotificacionMock extends NotificacionResponse {
  /** Destinatario: un usuario puntual o, si no hay, todos los perfiles con este rol. */
  paraUsuarioId?: string;
  paraRolCodigo?: 'CREADOR' | 'APROBADOR';
}

export interface DatosTaller {
  version: number;
  solicitudes: SolicitudResponse[];
  /** Cuentas bancarias aprobadas (proceso de ejemplo desconectado del menú; el simulador aún lo atiende). */
  registros: CuentaBancariaRegistro[];
  /** Anuncios de contratación futura aprobados. */
  anuncios: AnuncioRegistro[];
  notificaciones: NotificacionMock[];
  correlativoDocumento: number;
  correlativoRegistro: number;
  correlativoAnuncio: number;
  secuencia: number;
}

export const TIPO_SRCB = { id: 'td-srcb', codigo: CODIGO_SRCB, nombre: NOMBRE_SRCB };
export const TIPO_SACF = { id: 'td-sacf', codigo: CODIGO_SACF, nombre: NOMBRE_SACF };
export const TIPOS_DOCUMENTO = [TIPO_SRCB, TIPO_SACF];

export const ENTIDAD_CREADORA = { id: 'ent-mef', codMef: '0001', siglas: 'MEF', nombre: 'Ministerio de Economía y Finanzas' };
export const UNIDAD_CREADORA = { id: 'uo-dec', sigla: 'DEC', nombre: 'Departamento Encargado de las Contrataciones' };

/** Reasigna al creador de la solicitud las filas de historial hechas con el rol creador (elaborar, verificar, eliminar). */
function atribuirAlCreador(s: SolicitudResponse): SolicitudResponse {
  const creador = s.creador;
  if (!creador) return s;
  const historialEstados = (s.historialEstados ?? []).map((h) =>
    h.perfil?.cfgPerfil?.rol?.codigo === 'CREADOR'
      ? { ...h, creador: { nombres: creador.nombres, apellidoPaterno: creador.apellidoPaterno, apellidoMaterno: creador.apellidoMaterno } }
      : h,
  );
  return { ...s, historialEstados };
}

/**
 * Versión 4 → 5: los números de la solicitud de anuncio quedaban con huecos si se eliminaba una (la primera podía ser
 * 0002 sin que existiera la 0001). Se vuelven a numerar desde 0001, en orden de creación, solo las que siguen vigentes
 * (las eliminadas conservan el suyo); el aviso, el registro y las notificaciones de cada una se actualizan con el nuevo.
 */
function renumerarSolicitudesDeAnuncio(datos: DatosTaller): DatosTaller {
  const vigentes = datos.solicitudes
    .filter((s) => s.catDocumento?.codigo === CODIGO_SACF && s.numero && s.estado !== 'ELIMINADO')
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)) || String(a.numero).localeCompare(String(b.numero)));
  const nuevoNumero = new Map(vigentes.map((s, i) => [s.id, String(i + 1).padStart(4, '0')]));

  const solicitudes = datos.solicitudes.map((s) => (nuevoNumero.has(s.id) ? { ...s, numero: nuevoNumero.get(s.id)! } : s));
  const anuncios = datos.anuncios.map((r) => (nuevoNumero.has(r.documentoId) ? { ...r, numeroDocumento: nuevoNumero.get(r.documentoId)! } : r));
  const numeroAnterior = new Map(vigentes.map((s) => [s.id, s.numero as string]));
  const notificaciones = datos.notificaciones.map((n) => {
    const id = n.documento?.id;
    const nuevo = id ? nuevoNumero.get(id) : undefined;
    const anterior = id ? numeroAnterior.get(id) : undefined;
    return nuevo && anterior && typeof n.mensaje === 'string' ? { ...n, mensaje: n.mensaje.split(anterior).join(nuevo) } : n;
  });
  return { ...datos, solicitudes, anuncios, notificaciones, correlativoDocumento: Math.max(vigentes.length, 0), version: VERSION };
}

/** Número largo de la solicitud de anuncio (versión 2 de los datos): `PAB-SACF-00001-2026-MEF-OGA` pasa a `0001`. */
const NUMERO_ANUNCIO_LARGO = /PAB-SACF-0(\d{4})-\d{4}-MEF-OGA/g;

export function leerDatos(): DatosTaller {
  try {
    const guardados = localStorage.getItem(CLAVE);
    if (guardados) {
      let datos = JSON.parse(guardados) as DatosTaller;
      if (datos.version === 2) {
        // Versión 2 → 3: solo cambia el formato del número; se conservan los datos y se reescribe.
        datos = { ...(JSON.parse(guardados.replace(NUMERO_ANUNCIO_LARGO, '$1')) as DatosTaller), version: 3 };
      }
      if (datos.version === 3) {
        // Versión 3 → 4: lo hecho con perfil creador es del creador de la solicitud (antes otro creador podía tocarla).
        datos = { ...datos, solicitudes: datos.solicitudes.map(atribuirAlCreador), version: 4 };
      }
      if (datos.version === 4) {
        datos = renumerarSolicitudesDeAnuncio(datos);
        guardarDatos(datos);
      }
      if (datos.version === VERSION) return datos;
    }
  } catch {
    // Datos corruptos o sin acceso al almacenamiento: se empieza de nuevo.
  }
  const iniciales = crearDatosIniciales();
  guardarDatos(iniciales);
  return iniciales;
}

export function guardarDatos(datos: DatosTaller): void {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(datos));
  } catch {
    // Sin almacenamiento (modo privado estricto): los cambios duran lo que dure la pestaña.
  }
}

/** Vuelve al estado inicial de la demo (sin solicitudes ni registros). */
export function reiniciarDatosDemo(): void {
  guardarDatos(crearDatosIniciales());
}

export function nuevoId(datos: DatosTaller, prefijo: string): string {
  datos.secuencia += 1;
  return `${prefijo}-${datos.secuencia}`;
}

/**
 * Número de un documento, que se genera al elaborarlo. La solicitud de anuncio lleva solo el correlativo (`0001`);
 * la de cuentas bancarias, el número largo del ejemplo original (`PCB-SRCB-00001-2026-MEF-OGA`).
 */
export function numeroDocumento(codigoDocumento: string, correlativo: number, fecha: Date): string {
  if (codigoDocumento === CODIGO_SACF) return String(correlativo).padStart(4, '0');
  return `PCB-${CODIGO_SRCB}-${String(correlativo).padStart(5, '0')}-${fecha.getFullYear()}-MEF-OGA`;
}

export function filaHistorial(
  datos: DatosTaller,
  anterior: EstadoDocumento | null,
  nuevo: EstadoDocumento,
  fecha: string,
  usuario: UsuarioDemo,
  rol: { codigo: string; nombre: string },
  comentario: string | null = null,
): HistorialItem {
  return {
    id: nuevoId(datos, 'hist'),
    estadoAnterior: anterior,
    estadoNuevo: nuevo,
    comentario,
    createdAt: fecha,
    creador: { nombres: usuario.nombres, apellidoPaterno: usuario.apellidoPaterno, apellidoMaterno: usuario.apellidoMaterno },
    perfil: { cfgPerfil: { rol } },
  };
}

function crearDatosIniciales(): DatosTaller {
  return {
    version: VERSION,
    solicitudes: [],
    registros: [],
    anuncios: [],
    notificaciones: [],
    correlativoDocumento: 0,
    correlativoRegistro: 0,
    correlativoAnuncio: 0,
    secuencia: 0,
  };
}
