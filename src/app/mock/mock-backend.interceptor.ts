import { HttpErrorResponse, HttpEvent, HttpInterceptorFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { Observable, of, throwError, timer } from 'rxjs';
import { delay, mergeMap } from 'rxjs/operators';

import type { CambiarPerfilResponse, LoginResponse, PerfilItem } from '../core/api/auth-api.service';
import type { SolicitudResponse } from '../core/api/solicitudes-api.service';
import { APP_CONFIG } from '../core/config/app.config';
import type { EstadoDocumento } from '../core/models/documento.model';
import type { AnuncioItemDatos } from '../modules/abastecimiento/actuaciones-preparatorias/models/anuncio-contratacion-futura.model';
import type { CuentaBancariaDatos } from '../modules/tesoreria/cuentas-bancarias/models/cuenta-bancaria.model';
import {
  DatosTaller,
  ENTIDAD_CREADORA,
  NotificacionMock,
  TIPOS_DOCUMENTO,
  TIPO_SACF,
  UNIDAD_CREADORA,
  filaHistorial,
  guardarDatos,
  leerDatos,
  nuevoId,
  numeroDocumento,
} from './mock-db';
import { CONTRASENA_DEMO, USUARIOS_DEMO, UsuarioDemo, buscarUsuarioPorPerfil } from './usuarios-demo';

/**
 * Backend simulado del taller.
 *
 * Responde las llamadas a `APP_CONFIG.api.baseUrl` como lo haría el backend de SIAF-RP, con los datos de `mock-db.ts`,
 * y deja pasar todo lo demás (assets). Respeta las reglas del flujo de una solicitud: quién puede hacer cada
 * transición, comentario obligatorio al observar o rechazar, el contenido obligatorio para elaborar (al menos un anuncio
 * en la SACF; datos y sustento en la SRCB), número al elaborar y registros al aprobar. Para sumar un endpoint: una
 * entrada en `RUTAS` con su manejador.
 */

interface Sesion {
  usuario: UsuarioDemo;
  perfil: PerfilItem;
}

interface Contexto {
  req: HttpRequest<unknown>;
  params: string[];
  query: URLSearchParams;
  sesion: Sesion | null;
  datos: DatosTaller;
}

interface Respuesta {
  status: number;
  body?: unknown;
}

type Manejador = (ctx: Contexto) => Respuesta;

const LATENCIA_MS = 250;

// ─── Token (JWT sin firma: la app solo lee `exp`) ──────────────────

function base64Url(objeto: object): string {
  return btoa(JSON.stringify(objeto)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function firmarToken(usuario: UsuarioDemo, perfil: PerfilItem): string {
  const ahora = Math.floor(Date.now() / 1000);
  const payload = { sub: usuario.id, perfilId: perfil.id, sesionId: 'taller', iat: ahora, exp: ahora + 8 * 3600 };
  return `${base64Url({ alg: 'none', typ: 'JWT' })}.${base64Url(payload)}.taller`;
}

function sesionDelToken(token: string | null | undefined): Sesion | null {
  if (!token) return null;
  try {
    const segmento = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(segmento)) as { perfilId?: string };
    return payload.perfilId ? buscarUsuarioPorPerfil(payload.perfilId) : null;
  } catch {
    return null;
  }
}

// ─── Respuestas ────────────────────────────────────────────────────

const ok = (body: unknown = null, status = 200): Respuesta => ({ status, body });
const error = (status: number, message: string): Respuesta => ({ status, body: { message } });

function nombreCompleto(u: { nombres: string; apellidoPaterno: string; apellidoMaterno: string }): string {
  return `${u.nombres} ${u.apellidoPaterno} ${u.apellidoMaterno}`;
}

function rolDe(perfil: PerfilItem): { codigo: string; nombre: string } {
  return { codigo: perfil.rolCodigo, nombre: perfil.rol };
}

// ─── Autenticación ─────────────────────────────────────────────────

function respuestaLogin(usuario: UsuarioDemo): LoginResponse {
  const perfilActivo = usuario.perfiles[0];
  return { accessToken: firmarToken(usuario, perfilActivo), debeCambiarPassword: false, perfilActivo, perfilesDisponibles: usuario.perfiles };
}

const login: Manejador = ({ req }) => {
  const { dni, password } = (req.body ?? {}) as { dni?: string; password?: string };
  const usuario = USUARIOS_DEMO.find((u) => u.dni === dni?.trim());
  if (!usuario || password !== CONTRASENA_DEMO) return error(401, 'DNI o contraseña incorrectos.');
  return ok(respuestaLogin(usuario));
};

const refresh: Manejador = ({ sesion }) => {
  const actual = sesion ?? sesionDelToken(localStorage.getItem('siaf_access_token'));
  if (!actual) return error(401, 'Sesión expirada.');
  return ok({ accessToken: firmarToken(actual.usuario, actual.perfil) });
};

const cambiarPerfil: Manejador = ({ req, sesion }) => {
  if (!sesion) return error(401, 'Sesión expirada.');
  const { perfilId } = (req.body ?? {}) as { perfilId?: string };
  const perfil = sesion.usuario.perfiles.find((p) => p.id === perfilId);
  if (!perfil) return error(404, 'El perfil no pertenece al usuario.');
  const respuesta: CambiarPerfilResponse = { accessToken: firmarToken(sesion.usuario, perfil), perfilActivo: perfil };
  return ok(respuesta);
};

const solicitarOtp: Manejador = ({ req }) => {
  const { email } = (req.body ?? {}) as { email?: string };
  return USUARIOS_DEMO.some((u) => u.email === email?.trim()) ? ok(null, 204) : error(404, 'El correo no está registrado.');
};

const verificarOtp: Manejador = ({ req }) => {
  const { email, codigo } = (req.body ?? {}) as { email?: string; codigo?: string };
  const usuario = USUARIOS_DEMO.find((u) => u.email === email?.trim());
  if (!usuario) return error(404, 'El correo no está registrado.');
  if (codigo !== '123456') return error(400, 'El código no es válido. En el taller es 123456.');
  return ok(respuestaLogin(usuario));
};

// ─── Catálogos ─────────────────────────────────────────────────────

/** Solo el anuncio de contratación futura se ofrece en «Crear»: el catálogo manda lo que el usuario puede crear. */
const tiposDocumento: Manejador = () => ok([
  {
    ...TIPO_SACF,
    modulo: 'abastecimiento',
    esActivo: true,
    accionesPermitidas: [{ tipoAccion: 'creacion' }],
    proceso: { codigo: 'actuaciones-preparatorias', nombre: 'Actuaciones preparatorias', modulo: 'abastecimiento' },
  },
]);

// ─── Notificaciones ────────────────────────────────────────────────

function visibles(datos: DatosTaller, sesion: Sesion): NotificacionMock[] {
  return datos.notificaciones
    .filter((n) => (n.paraUsuarioId ? n.paraUsuarioId === sesion.usuario.id : n.paraRolCodigo === sesion.perfil.rolCodigo))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

const notificaciones: Manejador = ({ datos, sesion }) => ok(sesion ? visibles(datos, sesion).slice(0, 20) : []);
const historialNotificaciones: Manejador = ({ datos, sesion }) => ok(sesion ? visibles(datos, sesion) : []);
const contadorNotificaciones: Manejador = ({ datos, sesion }) => ok({ total: sesion ? visibles(datos, sesion).filter((n) => !n.leida).length : 0 });

const marcarLeidas: Manejador = ({ datos, sesion }) => {
  if (sesion) {
    const ahora = new Date().toISOString();
    visibles(datos, sesion).forEach((n) => { n.leida = true; n.leidaEn = n.leidaEn ?? ahora; });
    guardarDatos(datos);
  }
  return ok(null, 204);
};

const marcarLeidaDocumento: Manejador = ({ datos, sesion, params }) => {
  if (sesion) {
    const ahora = new Date().toISOString();
    visibles(datos, sesion).filter((n) => n.documento?.id === params[0]).forEach((n) => { n.leida = true; n.leidaEn = n.leidaEn ?? ahora; });
    guardarDatos(datos);
  }
  return ok(null, 204);
};

function notificar(datos: DatosTaller, s: SolicitudResponse, estado: EstadoDocumento, comentario: string | null): void {
  const textos: Partial<Record<EstadoDocumento, { titulo: string; mensaje: string }>> = {
    VERIFICADO: { titulo: 'Solicitud por aprobar', mensaje: `La solicitud ${s.numero} fue verificada y espera su aprobación.` },
    APROBADO: { titulo: 'Solicitud aprobada', mensaje: `La solicitud ${s.numero} fue aprobada.` },
    OBSERVADO: { titulo: 'Solicitud observada', mensaje: `La solicitud ${s.numero} fue observada: ${comentario ?? 'revise el comentario'}.` },
    RECHAZADO: { titulo: 'Solicitud rechazada', mensaje: `La solicitud ${s.numero} fue rechazada.` },
  };
  const texto = textos[estado];
  if (!texto) return;
  const destino = estado === 'VERIFICADO' ? { paraRolCodigo: 'APROBADOR' as const } : { paraUsuarioId: s.creador?.id };
  datos.notificaciones.push({
    id: nuevoId(datos, 'not'),
    tipo: `DOCUMENTO_${estado}`,
    ...texto,
    leida: false,
    leidaEn: null,
    createdAt: new Date().toISOString(),
    documento: { id: s.id, numero: s.numero, catDocumento: TIPOS_DOCUMENTO.find((t) => t.codigo === s.catDocumento?.codigo) ?? TIPO_SACF },
    ...destino,
  });
}

// ─── Solicitudes ───────────────────────────────────────────────────

function buscarSolicitud(datos: DatosTaller, id: string): SolicitudResponse | undefined {
  return datos.solicitudes.find((s) => s.id === id);
}

/** Solo el creador de una solicitud puede editarla, verificarla o eliminarla: otro usuario con perfil creador no. */
function esAutor(s: SolicitudResponse, sesion: Sesion | null): boolean {
  return !!sesion && s.creador?.id === sesion.usuario.id;
}

const SOLO_EL_AUTOR = 'Solo el creador de la solicitud puede modificarla.';

function bandeja(ctx: Contexto, estados?: EstadoDocumento[], soloPropias = false): Respuesta {
  const { datos, sesion, query } = ctx;
  if (!sesion) return error(401, 'Sesión expirada.');
  const tipos = (query.get('tipos') ?? '').split(',').filter(Boolean);
  const busqueda = (query.get('search') ?? '').trim().toLowerCase();

  let lista = datos.solicitudes.filter((s) => s.entidadCreadora?.id === sesion.perfil.entidadId && s.estado !== 'NUEVO');
  // La bandeja del creador trae solo lo que creó él; la del aprobador, lo de toda la entidad.
  if (soloPropias) lista = lista.filter((s) => esAutor(s, sesion));
  if (estados) lista = lista.filter((s) => estados.includes(s.estado));
  if (tipos.length) lista = lista.filter((s) => tipos.includes(s.catDocumento?.codigo ?? ''));
  if (busqueda) {
    lista = lista.filter((s) =>
      [s.numero, s.asuntoMotivo, s.catDocumento?.nombre, s.creador ? nombreCompleto(s.creador) : '']
        .some((valor) => (valor ?? '').toLowerCase().includes(busqueda)),
    );
  }
  lista = [...lista].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const pagina = Number(query.get('page'));
  const limite = Number(query.get('limit'));
  if (pagina && limite) {
    return ok({ data: lista.slice((pagina - 1) * limite, pagina * limite), total: lista.length, page: pagina, limit: limite });
  }
  return ok(lista);
}

const bandejaCreador: Manejador = (ctx) => bandeja(ctx, undefined, true);
const bandejaAprobador: Manejador = (ctx) => bandeja(ctx, ['VERIFICADO', 'OBSERVADO', 'APROBADO', 'RECHAZADO']);

const detalleSolicitud: Manejador = ({ datos, params }) => {
  const s = buscarSolicitud(datos, params[0]);
  return s ? ok(s) : error(404, 'La solicitud no existe.');
};

const crearSolicitud: Manejador = ({ req, datos, sesion }) => {
  if (!sesion) return error(401, 'Sesión expirada.');
  if (sesion.perfil.rolCodigo !== 'CREADOR') return error(403, 'Solo un creador puede registrar solicitudes.');
  const dto = (req.body ?? {}) as { tipoDocumentoId?: string; tipoAccion?: string; organoLinea?: string; justificacion?: string };
  const tipo = TIPOS_DOCUMENTO.find((t) => t.id === dto.tipoDocumentoId) ?? TIPO_SACF;
  const ahora = new Date().toISOString();
  const id = nuevoId(datos, 'sol');
  const s: SolicitudResponse = {
    id,
    numero: null,
    catDocumento: tipo,
    tipoAccion: dto.tipoAccion ?? 'creacion',
    estado: 'NUEVO',
    asuntoMotivo: `[${dto.organoLinea ?? ''}] ${dto.justificacion ?? ''}`,
    entidadCreadora: ENTIDAD_CREADORA,
    unidadCreadora: UNIDAD_CREADORA,
    creador: { id: sesion.usuario.id, nombres: sesion.usuario.nombres, apellidoPaterno: sesion.usuario.apellidoPaterno, apellidoMaterno: sesion.usuario.apellidoMaterno },
    fechaRegistro: ahora,
    createdAt: ahora,
    updatedAt: ahora,
    itemsCuenta: [],
    detalleCuentaBancaria: null,
    detalleAnuncio: null,
    sustentos: [],
    historialEstados: [filaHistorial(datos, null, 'NUEVO', ahora, sesion.usuario, rolDe(sesion.perfil))],
  };
  datos.solicitudes.push(s);
  guardarDatos(datos);
  return ok(s, 201);
};

const actualizarSolicitud: Manejador = ({ req, datos, params, sesion }) => {
  const s = buscarSolicitud(datos, params[0]);
  if (!s) return error(404, 'La solicitud no existe.');
  if (sesion?.perfil.rolCodigo !== 'CREADOR') return error(403, 'Solo el creador puede editar la solicitud.');
  if (!esAutor(s, sesion)) return error(403, SOLO_EL_AUTOR);
  if (!['ELABORADO', 'OBSERVADO'].includes(s.estado)) return error(409, 'Solo se edita una solicitud elaborada u observada.');
  const dto = (req.body ?? {}) as { justificacion?: string; organoLinea?: string };
  s.asuntoMotivo = `[${dto.organoLinea ?? ''}] ${dto.justificacion ?? ''}`;
  s.updatedAt = new Date().toISOString();
  guardarDatos(datos);
  return ok(s);
};

const guardarCuentaBancaria: Manejador = ({ req, datos, params, sesion }) => {
  const s = buscarSolicitud(datos, params[0]);
  if (!s) return error(404, 'La solicitud no existe.');
  if (!esAutor(s, sesion)) return error(403, SOLO_EL_AUTOR);
  if (!['NUEVO', 'ELABORADO', 'OBSERVADO'].includes(s.estado)) return error(409, 'La solicitud ya no admite cambios.');
  const cuenta = req.body as CuentaBancariaDatos;
  if (!/^\d{10,20}$/.test(cuenta?.numeroCuenta ?? '')) return error(400, 'El número de cuenta debe tener entre 10 y 20 dígitos.');
  s.detalleCuentaBancaria = { documentoId: s.id, ...cuenta };
  s.updatedAt = new Date().toISOString();
  guardarDatos(datos);
  return ok({ message: 'Cuenta guardada' });
};

const guardarAnuncio: Manejador = ({ req, datos, params, sesion }) => {
  const s = buscarSolicitud(datos, params[0]);
  if (!s) return error(404, 'La solicitud no existe.');
  if (!esAutor(s, sesion)) return error(403, SOLO_EL_AUTOR);
  if (!['NUEVO', 'ELABORADO', 'OBSERVADO'].includes(s.estado)) return error(409, 'La solicitud ya no admite cambios.');
  const { items } = (req.body ?? {}) as { items?: AnuncioItemDatos[] };
  if (!Array.isArray(items) || !items.length) return error(400, 'Agregue al menos un anuncio de contratación futura.');
  for (const item of items) {
    if (!item.contratacionCodigo) return error(400, 'Elija la contratación segmentada de cada anuncio.');
    if (!item.alcance?.trim()) return error(400, 'Complete el alcance de cada anuncio.');
    if (!(Number(item.plazoEntrega) > 0)) return error(400, 'El plazo de entrega debe ser mayor que 0 días.');
    if (!item.fechaConvocatoria) return error(400, 'Indique la fecha aproximada de convocatoria de cada anuncio.');
  }
  s.detalleAnuncio = { documentoId: s.id, items };
  s.updatedAt = new Date().toISOString();
  guardarDatos(datos);
  return ok({ message: 'Anuncios guardados' });
};

const subirSustento: Manejador = ({ req, datos, params }) => {
  const s = buscarSolicitud(datos, params[0]);
  if (!s) return error(404, 'La solicitud no existe.');
  const formulario = req.body instanceof FormData ? req.body : null;
  const archivo = formulario?.get('archivo');
  if (!(archivo instanceof File)) return error(400, 'Adjunte un archivo.');
  const sustento = {
    id: nuevoId(datos, 'sus'),
    tipoSustento: String(formulario?.get('tipoSustento') ?? 'sustento'),
    createdAt: new Date().toISOString(),
    archivo: {
      id: nuevoId(datos, 'arc'),
      nombreOriginal: archivo.name,
      extension: archivo.name.split('.').pop() ?? '',
      mimeType: archivo.type,
      sizeBytes: String(archivo.size),
      storagePath: 'taller',
    },
  };
  // El taller guarda solo el nombre del archivo (no su contenido) y un único sustento por solicitud.
  s.sustentos = [sustento];
  guardarDatos(datos);
  return ok(sustento, 201);
};

const listarSustentos: Manejador = ({ datos, params }) => ok(buscarSolicitud(datos, params[0])?.sustentos ?? []);

const eliminarSustento: Manejador = ({ datos, params }) => {
  const s = buscarSolicitud(datos, params[0]);
  if (s) {
    s.sustentos = (s.sustentos ?? []).filter((x) => x.id !== params[1]);
    guardarDatos(datos);
  }
  return ok(null, 204);
};

const TRANSICIONES: Record<'CREADOR' | 'APROBADOR', Partial<Record<EstadoDocumento, EstadoDocumento[]>>> = {
  CREADOR: {
    NUEVO: ['ELABORADO'],
    ELABORADO: ['ELABORADO', 'VERIFICADO', 'ELIMINADO'],
    OBSERVADO: ['ELABORADO', 'VERIFICADO'],
  },
  APROBADOR: {
    VERIFICADO: ['APROBADO', 'OBSERVADO', 'RECHAZADO'],
  },
};

const cambiarEstado: Manejador = ({ req, datos, params, sesion }) => {
  if (!sesion) return error(401, 'Sesión expirada.');
  const s = buscarSolicitud(datos, params[0]);
  if (!s) return error(404, 'La solicitud no existe.');
  const dto = (req.body ?? {}) as { estadoNuevo?: EstadoDocumento; comentario?: string; motivo?: string };
  const nuevo = dto.estadoNuevo;
  const rol = sesion.perfil.rolCodigo as 'CREADOR' | 'APROBADOR';
  const permitidos = TRANSICIONES[rol]?.[s.estado] ?? [];
  // Verificar, elaborar de nuevo o eliminar es del creador de la solicitud; aprobar, observar y rechazar, de cualquier aprobador.
  if (rol === 'CREADOR' && !esAutor(s, sesion)) return error(403, SOLO_EL_AUTOR);
  if (!nuevo || !permitidos.includes(nuevo)) {
    return error(409, `No se puede pasar de ${s.estado} a ${nuevo ?? '—'} con el perfil ${sesion.perfil.rol}.`);
  }
  const comentario = dto.comentario?.trim() ?? '';
  if ((nuevo === 'OBSERVADO' || nuevo === 'RECHAZADO') && !comentario) return error(400, 'Escriba el comentario.');
  if (nuevo === 'ELIMINADO' && (s.historialEstados ?? []).some((h) => h.estadoNuevo === 'OBSERVADO')) {
    return error(409, 'No se puede eliminar una solicitud que fue observada.');
  }
  const codigoDocumento = s.catDocumento?.codigo ?? TIPO_SACF.codigo;
  const esAnuncio = codigoDocumento === TIPO_SACF.codigo;
  if (nuevo === 'ELABORADO') {
    if (esAnuncio) {
      if (!s.detalleAnuncio?.items.length) return error(400, 'Agregue al menos un anuncio de contratación futura.');
    } else {
      if (!s.detalleCuentaBancaria) return error(400, 'Registre los datos de la cuenta bancaria.');
      if (!(s.sustentos ?? []).length) return error(400, 'Adjunte el documento de sustento.');
    }
  }

  const ahora = new Date().toISOString();
  const anterior = s.estado;
  if (nuevo === 'ELABORADO' && !s.numero) {
    datos.correlativoDocumento += 1;
    s.numero = numeroDocumento(codigoDocumento, datos.correlativoDocumento, new Date());
  }
  // Volver a grabar un ELABORADO no deja fila en el historial.
  if (!(anterior === 'ELABORADO' && nuevo === 'ELABORADO')) {
    const texto = nuevo === 'RECHAZADO' && dto.motivo ? `[${dto.motivo}] ${comentario}` : comentario || null;
    s.historialEstados = [...(s.historialEstados ?? []), filaHistorial(datos, anterior, nuevo, ahora, sesion.usuario, rolDe(sesion.perfil), texto)];
  }
  s.estado = nuevo;
  s.updatedAt = ahora;
  if (nuevo === 'VERIFICADO') s.fechaEvaluacion = ahora;
  if (nuevo === 'APROBADO') s.fechaAprobacion = ahora;

  // Al aprobar, cada anuncio pasa a los registros.
  if (nuevo === 'APROBADO' && esAnuncio && s.detalleAnuncio && !datos.anuncios.some((r) => r.documentoId === s.id)) {
    for (const item of s.detalleAnuncio.items) {
      datos.correlativoAnuncio += 1;
      datos.anuncios.push({
        ...item,
        id: nuevoId(datos, 'acf'),
        codigo: `ACF-${String(datos.correlativoAnuncio).padStart(4, '0')}`,
        estado: 'Activo',
        entidadSiglas: s.entidadCreadora?.siglas ?? '',
        documentoId: s.id,
        numeroDocumento: s.numero ?? '',
        fechaRegistro: ahora,
      });
    }
  }

  // Al aprobar, la cuenta pasa a los registros (proceso de cuentas bancarias).
  if (nuevo === 'APROBADO' && s.detalleCuentaBancaria && !datos.registros.some((r) => r.documentoId === s.id)) {
    const { documentoId: _documento, ...cuenta } = s.detalleCuentaBancaria;
    datos.correlativoRegistro += 1;
    datos.registros.push({
      id: nuevoId(datos, 'cb'),
      codigo: `CB-${String(datos.correlativoRegistro).padStart(4, '0')}`,
      estado: 'Activo',
      entidadSiglas: s.entidadCreadora?.siglas ?? '',
      documentoId: s.id,
      numeroDocumento: s.numero ?? '',
      fechaRegistro: ahora,
      ...cuenta,
    });
  }

  notificar(datos, s, nuevo, comentario || null);
  guardarDatos(datos);
  return ok({ message: 'Estado actualizado', numero: s.numero });
};

// ─── Registros de los procesos ─────────────────────────────────────

const registrosAnuncios: Manejador = ({ datos, sesion }) =>
  ok(datos.anuncios.filter((r) => !sesion || r.entidadSiglas === sesion.perfil.entidadSiglas));

const registrosCuentas: Manejador = ({ datos, sesion }) =>
  ok(datos.registros.filter((r) => !sesion || r.entidadSiglas === sesion.perfil.entidadSiglas));

// ─── Enrutador ─────────────────────────────────────────────────────

const RUTAS: [string, RegExp, Manejador][] = [
  ['POST', /^\/auth\/login$/, login],
  ['POST', /^\/auth\/logout$/, () => ok(null, 204)],
  ['POST', /^\/auth\/refresh$/, refresh],
  ['PATCH', /^\/auth\/cambiar-perfil$/, cambiarPerfil],
  ['POST', /^\/auth\/cambiar-password$/, () => ok(null, 204)],
  ['POST', /^\/auth\/solicitar-otp$/, solicitarOtp],
  ['POST', /^\/auth\/verificar-otp$/, verificarOtp],
  ['POST', /^\/auth\/reenviar-otp-whatsapp$/, () => ok(null, 204)],
  ['GET', /^\/tipos-documento$/, tiposDocumento],
  ['GET', /^\/notificaciones$/, notificaciones],
  ['GET', /^\/notificaciones\/historial$/, historialNotificaciones],
  ['GET', /^\/notificaciones\/contador$/, contadorNotificaciones],
  ['PATCH', /^\/notificaciones\/marcar-leidas$/, marcarLeidas],
  ['PATCH', /^\/notificaciones\/marcar-leida-documento\/([^/]+)$/, marcarLeidaDocumento],
  ['GET', /^\/solicitudes\/bandeja-creador$/, bandejaCreador],
  ['GET', /^\/solicitudes\/bandeja-aprobador$/, bandejaAprobador],
  ['POST', /^\/solicitudes$/, crearSolicitud],
  ['PATCH', /^\/solicitudes\/([^/]+)\/estado$/, cambiarEstado],
  ['POST', /^\/solicitudes\/([^/]+)\/anuncio$/, guardarAnuncio],
  ['POST', /^\/solicitudes\/([^/]+)\/cuenta-bancaria$/, guardarCuentaBancaria],
  ['POST', /^\/solicitudes\/([^/]+)\/sustentos$/, subirSustento],
  ['GET', /^\/solicitudes\/([^/]+)\/sustentos$/, listarSustentos],
  ['DELETE', /^\/solicitudes\/([^/]+)\/sustentos\/([^/]+)$/, eliminarSustento],
  ['GET', /^\/solicitudes\/([^/]+)$/, detalleSolicitud],
  ['PATCH', /^\/solicitudes\/([^/]+)$/, actualizarSolicitud],
  ['GET', /^\/anuncios-contratacion$/, registrosAnuncios],
  ['GET', /^\/cuentas-bancarias$/, registrosCuentas],
];

export const mockBackendInterceptor: HttpInterceptorFn = (req, next): Observable<HttpEvent<unknown>> => {
  const base = APP_CONFIG.api.baseUrl;
  const url = new URL(req.url, window.location.origin);
  if (!url.pathname.startsWith(base)) return next(req);

  const ruta = url.pathname.slice(base.length) || '/';
  // Los parámetros pueden venir en la URL o en HttpParams.
  const query = new URLSearchParams(url.search);
  req.params.keys().forEach((clave) => query.set(clave, req.params.get(clave) ?? ''));

  for (const [metodo, patron, manejador] of RUTAS) {
    const coincidencia = req.method === metodo ? patron.exec(ruta) : null;
    if (!coincidencia) continue;
    const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    const respuesta = manejador({ req, params: coincidencia.slice(1), query, sesion: sesionDelToken(token), datos: leerDatos() });
    return responder(req, respuesta);
  }

  console.warn(`[mock] Endpoint no simulado: ${req.method} ${ruta}`);
  return responder(req, error(404, `El backend simulado no responde ${req.method} ${ruta}.`));
};

function responder(req: HttpRequest<unknown>, respuesta: Respuesta): Observable<HttpEvent<unknown>> {
  if (respuesta.status < 400) {
    return of(new HttpResponse({ status: respuesta.status, body: respuesta.body ?? null, url: req.url })).pipe(delay(LATENCIA_MS));
  }
  return timer(LATENCIA_MS).pipe(
    mergeMap(() => throwError(() => new HttpErrorResponse({ status: respuesta.status, error: respuesta.body, url: req.url }))),
  );
}
