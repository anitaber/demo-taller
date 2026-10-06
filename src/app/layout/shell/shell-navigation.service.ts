import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

/**
 * Canal de eventos para que cualquier página le pida al shell abrir uno de sus paneles flotantes.
 *
 * Expone tres `Subject` sin estado (menú de procesos, crear documento y una sección de la bandeja) a los que
 * `AppShellComponent` se suscribe; evita que las páginas tengan que inyectar el shell o duplicar su lógica de apertura.
 */
@Injectable({ providedIn: 'root' })
export class ShellNavigationService {
  private readonly processMenuRequestedSubject = new Subject<void>();
  private readonly createDocumentRequestedSubject = new Subject<void>();
  private readonly trayRequestedSubject = new Subject<string>();

  readonly processMenuRequested$ = this.processMenuRequestedSubject.asObservable();
  readonly createDocumentRequested$ = this.createDocumentRequestedSubject.asObservable();
  /** Sección de la bandeja que se pide abrir: Recibidos, Enviados, Borradores, Notificaciones o Papelera. */
  readonly trayRequested$ = this.trayRequestedSubject.asObservable();

  openTray(section: string): void {
    this.trayRequestedSubject.next(section);
  }

  openProcessMenu(): void {
    this.processMenuRequestedSubject.next();
  }

  openCreateDocument(): void {
    this.createDocumentRequestedSubject.next();
  }
}
