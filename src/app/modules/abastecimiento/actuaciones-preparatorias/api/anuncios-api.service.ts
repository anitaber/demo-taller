import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { APP_CONFIG } from '../../../../core/config/app.config';
import { AnuncioItemDatos, AnuncioRegistro } from '../models/anuncio-contratacion-futura.model';

/** Llamadas propias del proceso: los anuncios de una solicitud y los registros aprobados. */
@Injectable({ providedIn: 'root' })
export class AnunciosApiService {
  private readonly http = inject(HttpClient);
  private readonly base = APP_CONFIG.api.baseUrl;

  /** Reemplaza los anuncios de la solicitud (admite NUEVO, ELABORADO y OBSERVADO). */
  guardarDetalle(solicitudId: string, items: AnuncioItemDatos[]): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.base}/solicitudes/${solicitudId}/anuncio`, { items });
  }

  listarRegistros(): Observable<AnuncioRegistro[]> {
    return this.http.get<AnuncioRegistro[]>(`${this.base}/anuncios-contratacion`);
  }
}
