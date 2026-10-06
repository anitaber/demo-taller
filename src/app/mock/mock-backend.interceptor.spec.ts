import { HttpClient, HttpErrorResponse, HttpHeaders, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Observable } from 'rxjs';

import type { LoginResponse } from '../core/api/auth-api.service';
import type { SolicitudResponse } from '../core/api/solicitudes-api.service';
import type { AnuncioItemDatos, AnuncioRegistro } from '../modules/abastecimiento/actuaciones-preparatorias/models/anuncio-contratacion-futura.model';
import { mockBackendInterceptor } from './mock-backend.interceptor';
import { leerDatos, reiniciarDatosDemo } from './mock-db';
import { CONTRASENA_DEMO } from './usuarios-demo';

/**
 * El backend simulado sigue las reglas del flujo de una solicitud. Si una clase cambia una regla, este spec dice
 * cuál se rompió.
 */
describe('mockBackendInterceptor', () => {
  const API = '/api/v1';
  const TIPO_SACF = 'td-sacf';
  let http: HttpClient;
  let red: HttpTestingController;

  const ITEM = (id: string, contratacionCodigo: string): AnuncioItemDatos => ({
    id,
    contratacionCodigo,
    descripcion: 'Adquisición de equipos de cadena de frío para establecimientos de salud',
    objeto: 'Bien',
    origen: 'PAC',
    tipoProcedimiento: 'Licitación pública para bienes',
    cantidadAproximada: 100000,
    alcance: 'Equipos para la red de frío de los establecimientos.',
    plazoEntrega: 30,
    fechaConvocatoria: '2026-12-01',
  });

  /** Resuelve la petición simulada (tiene una latencia de 250 ms) y devuelve la respuesta o el error. */
  function esperar<T>(peticion: Observable<T>): { valor?: T; error?: HttpErrorResponse } {
    const resultado: { valor?: T; error?: HttpErrorResponse } = {};
    peticion.subscribe({ next: (v) => (resultado.valor = v), error: (e: HttpErrorResponse) => (resultado.error = e) });
    tick(300);
    return resultado;
  }

  function entrar(dni: string): HttpHeaders {
    const { valor } = esperar(http.post<LoginResponse>(`${API}/auth/login`, { dni, password: CONTRASENA_DEMO }));
    return new HttpHeaders({ Authorization: `Bearer ${valor!.accessToken}` });
  }

  function crear(headers: HttpHeaders): string {
    const creada = esperar(http.post<SolicitudResponse>(`${API}/solicitudes`, { tipoDocumentoId: TIPO_SACF, tipoAccion: 'creacion', organoLinea: 'OGA', justificacion: 'Anuncio de contratación futura' }, { headers }));
    return creada.valor!.id;
  }

  /** Crea una solicitud con anuncios y la deja ELABORADA; devuelve su id. */
  function elaborar(headers: HttpHeaders, items: AnuncioItemDatos[] = [ITEM('a1', '0002')]): string {
    const id = crear(headers);
    esperar(http.post(`${API}/solicitudes/${id}/anuncio`, { items }, { headers }));
    esperar(http.patch(`${API}/solicitudes/${id}/estado`, { estadoNuevo: 'ELABORADO' }, { headers }));
    return id;
  }

  beforeEach(() => {
    reiniciarDatosDemo();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([mockBackendInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    red = TestBed.inject(HttpTestingController);
  });

  // Ninguna llamada a la API sale a la red: las responde el simulador.
  afterEach(() => red.verify());

  afterAll(() => reiniciarDatosDemo());

  it('rechaza una contraseña incorrecta con el mensaje que muestra el login', fakeAsync(() => {
    const { error } = esperar(http.post(`${API}/auth/login`, { dni: '11111111', password: 'otra' }));

    expect(error?.status).toBe(401);
    expect(error?.error.message).toContain('DNI o contraseña incorrectos');
  }));

  it('entrega los perfiles del usuario y cambia al que se elige', fakeAsync(() => {
    const { valor } = esperar(http.post<LoginResponse>(`${API}/auth/login`, { dni: '33333333', password: CONTRASENA_DEMO }));
    expect(valor?.perfilesDisponibles.map((p) => p.rolCodigo)).toEqual(['CREADOR', 'APROBADOR']);

    const headers = new HttpHeaders({ Authorization: `Bearer ${valor!.accessToken}` });
    const cambio = esperar(http.patch<{ perfilActivo: { rolCodigo: string } }>(`${API}/auth/cambiar-perfil`, { perfilId: 'perfil-carla-aprobador' }, { headers }));

    expect(cambio.valor?.perfilActivo.rolCodigo).toBe('APROBADOR');
  }));

  it('arranca sin solicitudes ni registros ni avisos', fakeAsync(() => {
    const ana = entrar('11111111');

    expect(esperar(http.get<SolicitudResponse[]>(`${API}/solicitudes/bandeja-creador`, { headers: ana })).valor).toEqual([]);
    expect(esperar(http.get<AnuncioRegistro[]>(`${API}/anuncios-contratacion`, { headers: ana })).valor).toEqual([]);
    expect(esperar(http.get<unknown[]>(`${API}/notificaciones`, { headers: ana })).valor).toEqual([]);
  }));

  it('el catálogo solo ofrece crear la solicitud de anuncio de contratación futura', fakeAsync(() => {
    const { valor } = esperar(http.get<{ codigo: string; proceso: { codigo: string } }[]>(`${API}/tipos-documento`));

    expect(valor?.map((t) => t.codigo)).toEqual(['SACF']);
    expect(valor?.[0].proceso.codigo).toBe('actuaciones-preparatorias');
  }));

  it('la bandeja no muestra solicitudes en NUEVO y pagina si se pide', fakeAsync(() => {
    const ana = entrar('11111111');
    crear(ana);

    const nueva = esperar(http.get<{ data: SolicitudResponse[]; total: number }>(`${API}/solicitudes/bandeja-creador?tipos=SACF&page=1&limit=5`, { headers: ana }));
    expect(nueva.valor?.total).toBe(0);

    for (let i = 0; i < 7; i++) elaborar(ana);
    const pagina = esperar(http.get<{ data: SolicitudResponse[]; total: number }>(`${API}/solicitudes/bandeja-creador?tipos=SACF&page=1&limit=5`, { headers: ana }));

    expect(pagina.valor?.data.length).toBe(5);
    expect(pagina.valor?.total).toBe(7);
  }));

  it('recorre el flujo completo: elaborar, verificar y aprobar crea los registros y avisa a cada rol', fakeAsync(() => {
    const ana = entrar('11111111');
    const id = crear(ana);

    // Sin anuncios no se puede grabar ni elaborar.
    expect(esperar(http.post(`${API}/solicitudes/${id}/anuncio`, { items: [] }, { headers: ana })).error?.status).toBe(400);
    expect(esperar(http.patch(`${API}/solicitudes/${id}/estado`, { estadoNuevo: 'ELABORADO' }, { headers: ana })).error?.status).toBe(400);
    // Cada anuncio exige alcance, plazo mayor que 0 y fecha de convocatoria.
    expect(esperar(http.post(`${API}/solicitudes/${id}/anuncio`, { items: [{ ...ITEM('a1', '0002'), plazoEntrega: 0 }] }, { headers: ana })).error?.status).toBe(400);

    esperar(http.post(`${API}/solicitudes/${id}/anuncio`, { items: [ITEM('a1', '0002'), ITEM('a2', '0004')] }, { headers: ana }));
    const elaborada = esperar(http.patch<{ numero: string }>(`${API}/solicitudes/${id}/estado`, { estadoNuevo: 'ELABORADO' }, { headers: ana }));
    expect(elaborada.valor?.numero).toBe('0001');

    // El creador no puede aprobar.
    expect(esperar(http.patch(`${API}/solicitudes/${id}/estado`, { estadoNuevo: 'APROBADO' }, { headers: ana })).error?.status).toBe(409);
    esperar(http.patch(`${API}/solicitudes/${id}/estado`, { estadoNuevo: 'VERIFICADO' }, { headers: ana }));

    const luis = entrar('22222222');
    const bandeja = esperar(http.get<SolicitudResponse[]>(`${API}/solicitudes/bandeja-aprobador?tipos=SACF`, { headers: luis }));
    expect(bandeja.valor?.map((s) => s.id)).toEqual([id]);
    const avisos = esperar(http.get<{ titulo: string; documento: { id: string; catDocumento: { codigo: string } } }[]>(`${API}/notificaciones`, { headers: luis }));
    expect(avisos.valor?.some((n) => n.documento.id === id && n.titulo === 'Documento por aprobar' && n.documento.catDocumento.codigo === 'SACF')).toBeTrue();

    esperar(http.patch(`${API}/solicitudes/${id}/estado`, { estadoNuevo: 'APROBADO' }, { headers: luis }));

    const registros = esperar(http.get<AnuncioRegistro[]>(`${API}/anuncios-contratacion`, { headers: luis }));
    expect(registros.valor?.map((r) => r.codigo)).toEqual(['ACF-0001', 'ACF-0002']);
    expect(registros.valor?.map((r) => r.contratacionCodigo)).toEqual(['0002', '0004']);
    expect(registros.valor?.every((r) => r.documentoId === id && r.estado === 'Activo')).toBeTrue();

    const detalle = esperar(http.get<SolicitudResponse>(`${API}/solicitudes/${id}`, { headers: luis }));
    expect(detalle.valor?.historialEstados?.map((h) => h.estadoNuevo)).toEqual(['NUEVO', 'ELABORADO', 'VERIFICADO', 'APROBADO']);
    expect(detalle.valor?.detalleAnuncio?.items.length).toBe(2);

    const avisosAna = esperar(http.get<{ titulo: string; documento: { id: string } }[]>(`${API}/notificaciones`, { headers: ana }));
    expect(avisosAna.valor?.some((n) => n.documento.id === id && n.titulo === 'Documento aprobado')).toBeTrue();
  }));

  it('observar pide comentario y una solicitud observada ya no se puede eliminar', fakeAsync(() => {
    const ana = entrar('11111111');
    const id = elaborar(ana);
    esperar(http.patch(`${API}/solicitudes/${id}/estado`, { estadoNuevo: 'VERIFICADO' }, { headers: ana }));

    const luis = entrar('22222222');
    expect(esperar(http.patch(`${API}/solicitudes/${id}/estado`, { estadoNuevo: 'OBSERVADO' }, { headers: luis })).error?.status).toBe(400);
    esperar(http.patch(`${API}/solicitudes/${id}/estado`, { estadoNuevo: 'OBSERVADO', comentario: 'Falta precisar el alcance.' }, { headers: luis }));

    esperar(http.patch(`${API}/solicitudes/${id}/estado`, { estadoNuevo: 'ELABORADO' }, { headers: ana }));
    const eliminar = esperar(http.patch(`${API}/solicitudes/${id}/estado`, { estadoNuevo: 'ELIMINADO' }, { headers: ana }));

    expect(eliminar.error?.status).toBe(409);
    expect(eliminar.error?.error.message).toContain('observada');
  }));

  it('solo el creador de una solicitud puede editarla y verificarla: otro creador ni la ve en su bandeja', fakeAsync(() => {
    const ana = entrar('11111111');
    const id = elaborar(ana);

    // Carla tiene perfil creador, pero la solicitud es de Ana.
    const carla = entrar('33333333');
    expect(esperar(http.get<SolicitudResponse[]>(`${API}/solicitudes/bandeja-creador`, { headers: carla })).valor).toEqual([]);
    expect(esperar(http.patch(`${API}/solicitudes/${id}/estado`, { estadoNuevo: 'VERIFICADO' }, { headers: carla })).error?.status).toBe(403);
    expect(esperar(http.post(`${API}/solicitudes/${id}/anuncio`, { items: [ITEM('a9', '0003')] }, { headers: carla })).error?.status).toBe(403);

    // Ana sigue pudiendo, y el historial queda con una sola persona como creadora.
    esperar(http.patch(`${API}/solicitudes/${id}/estado`, { estadoNuevo: 'VERIFICADO' }, { headers: ana }));
    const detalle = esperar(http.get<SolicitudResponse>(`${API}/solicitudes/${id}`, { headers: ana }));
    const quienes = detalle.valor?.historialEstados?.filter((h) => ['ELABORADO', 'VERIFICADO'].includes(h.estadoNuevo)).map((h) => h.creador?.nombres);
    expect(quienes).toEqual(['Ana', 'Ana']);
  }));

  it('una solicitud rechazada no genera registros', fakeAsync(() => {
    const ana = entrar('11111111');
    const id = elaborar(ana);
    esperar(http.patch(`${API}/solicitudes/${id}/estado`, { estadoNuevo: 'VERIFICADO' }, { headers: ana }));

    const luis = entrar('22222222');
    esperar(http.patch(`${API}/solicitudes/${id}/estado`, { estadoNuevo: 'RECHAZADO', comentario: 'Ya existe un anuncio igual.', motivo: 'Información incorrecta' }, { headers: luis }));

    expect(esperar(http.get<AnuncioRegistro[]>(`${API}/anuncios-contratacion`, { headers: luis })).valor).toEqual([]);
  }));

  it('migra los datos guardados con el número largo al número corto sin perder nada', () => {
    localStorage.setItem('taller-siaf-rp:datos', JSON.stringify({
      version: 2,
      solicitudes: [{ id: 'sol-1', numero: 'PAB-SACF-00002-2026-MEF-OGA' }],
      registros: [],
      anuncios: [{ id: 'acf-1', numeroDocumento: 'PAB-SACF-00002-2026-MEF-OGA' }],
      notificaciones: [{ id: 'not-1', mensaje: 'La solicitud PAB-SACF-00002-2026-MEF-OGA fue aprobada.' }],
      correlativoDocumento: 2,
      correlativoRegistro: 0,
      correlativoAnuncio: 1,
      secuencia: 7,
    }));

    const datos = leerDatos();

    expect(datos.version).toBe(4);
    expect(datos.solicitudes[0].numero).toBe('0002');
    expect(datos.anuncios[0].numeroDocumento).toBe('0002');
    expect(datos.notificaciones[0]['mensaje']).toBe('La solicitud 0002 fue aprobada.');
    expect(datos.correlativoDocumento).toBe(2);
  });

  it('migra los datos antiguos: lo hecho con perfil creador queda a nombre del creador de la solicitud', () => {
    const persona = (nombres: string) => ({ nombres, apellidoPaterno: 'Apellido', apellidoMaterno: 'Díaz' });
    const fila = (id: string, estado: string, rol: string, nombres: string) => ({
      id, estadoNuevo: estado, createdAt: '2026-10-06T10:00:00.000Z', creador: persona(nombres), perfil: { cfgPerfil: { rol: { codigo: rol, nombre: rol } } },
    });
    localStorage.setItem('taller-siaf-rp:datos', JSON.stringify({
      version: 3,
      solicitudes: [{
        id: 'sol-1',
        numero: '0001',
        creador: { id: 'usr-ana', ...persona('Ana') },
        historialEstados: [fila('h1', 'ELABORADO', 'CREADOR', 'Carla'), fila('h2', 'VERIFICADO', 'CREADOR', 'Ana'), fila('h3', 'APROBADO', 'APROBADOR', 'Carla')],
      }],
      registros: [], anuncios: [], notificaciones: [], correlativoDocumento: 1, correlativoRegistro: 0, correlativoAnuncio: 0, secuencia: 3,
    }));

    const historial = leerDatos().solicitudes[0].historialEstados!;

    expect(historial.map((h) => h.creador?.nombres)).toEqual(['Ana', 'Ana', 'Carla']);
  });

  it('deja pasar lo que no es de la API (los assets)', () => {
    http.get('assets/datos.json').subscribe();

    red.expectOne('assets/datos.json').flush({});
  });
});
