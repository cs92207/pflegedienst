import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { createEmptyPatient, Patient, PatientVisit, PatientVisitTodo } from '../../models/patient';
import { CaregiverPatientService } from '../../services/caregiver-patient.service';

@Component({
  selector: 'app-visit-detail',
  templateUrl: './visit-detail.page.html',
  styleUrls: ['./visit-detail.page.scss'],
  standalone: false
})
export class VisitDetailPage implements OnInit {

  patient: Patient = createEmptyPatient();
  visit: PatientVisit | null = null;
  isLoading = true;
  errorMessage = '';
  actionLoadingMessage = '';
  isActionLoading = false;
  busyVisit = false;
  busyVisitTodoIds: Record<number, boolean> = {};
  busyVisitDraft = false;
  visitTodoDraft = { title: '', notes: '' };
  selectedTodoId: number | null = null;

  constructor(
    private activatedRoute: ActivatedRoute,
    private caregiverPatientService: CaregiverPatientService,
    private router: Router,
    private toastController: ToastController,
  ) {}

  async ngOnInit(): Promise<void> {
    const patientId = Number(this.activatedRoute.snapshot.paramMap.get('patientId'));
    const visitId = Number(this.activatedRoute.snapshot.paramMap.get('visitId'));

    if (!patientId || !visitId) {
      await this.router.navigate(['/home/patients']);
      return;
    }

    await this.loadVisit(patientId, visitId);
  }

  get patientName(): string {
    return `${this.patient.firstName} ${this.patient.lastName}`.trim();
  }

  async loadVisit(patientId: number, visitId: number): Promise<void> {
    this.isLoading = true;
    this.errorMessage = '';

    try {
      this.patient = await this.caregiverPatientService.getMyPatient(patientId);
      this.visit = this.patient.visits.find((item) => item.id === visitId) || null;

      if (!this.visit) {
        this.errorMessage = 'Der Besuch konnte nicht gefunden werden.';
      } else {
        this.selectedTodoId = null;
      }
    } catch (error: any) {
      this.errorMessage = error?.error?.message || 'Die Besuchsdetails konnten nicht geladen werden.';
    } finally {
      this.isLoading = false;
    }
  }

  async goBack(): Promise<void> {
    await this.router.navigate(['/home/patients', this.patient.id]);
  }

  async saveVisit(): Promise<void> {
    if (!this.visit) {
      return;
    }

    if (!this.visit.visitDate || !this.visit.startTime) {
      await this.showToast('Datum und Startzeit sind für einen Besuch erforderlich.');
      return;
    }

    this.busyVisit = true;

    try {
      await this.runWithActionLoading('Besuch wird gespeichert...', async () => {
        this.visit = await this.caregiverPatientService.updateVisit(this.patient.id, this.visit as PatientVisit);
      });
      await this.showToast('Besuch wurde gespeichert.');
    } catch (error: any) {
      await this.showToast(error?.error?.message || 'Besuch konnte nicht gespeichert werden.');
    } finally {
      this.busyVisit = false;
    }
  }

  async toggleVisitRelease(isReleasedToAdmin: boolean): Promise<void> {
    if (!this.visit) {
      return;
    }

    this.busyVisit = true;

    try {
      await this.runWithActionLoading(isReleasedToAdmin ? 'Besuch wird freigegeben...' : 'Freigabe wird zurückgezogen...', async () => {
        this.visit = await this.caregiverPatientService.updateVisitRelease(this.patient.id, this.visit!.id, isReleasedToAdmin);
      });
      await this.showToast(isReleasedToAdmin ? 'Besuch für das Admin-Dashboard freigegeben.' : 'Admin-Freigabe wurde zurückgezogen.');
    } catch (error: any) {
      await this.showToast(error?.error?.message || 'Freigabe konnte nicht aktualisiert werden.');
    } finally {
      this.busyVisit = false;
    }
  }

  async deleteVisit(): Promise<void> {
    if (!this.visit) {
      return;
    }

    this.busyVisit = true;

    try {
      await this.runWithActionLoading('Besuch wird gelöscht...', async () => {
        await this.caregiverPatientService.deleteVisit(this.patient.id, this.visit!.id);
      });
      await this.showToast('Besuch wurde gelöscht.');
      await this.goBack();
    } catch (error: any) {
      await this.showToast(error?.error?.message || 'Besuch konnte nicht gelöscht werden.');
    } finally {
      this.busyVisit = false;
    }
  }

  async addVisitTodo(): Promise<void> {
    if (!this.visit) {
      return;
    }

    if (!this.visitTodoDraft.title.trim()) {
      await this.showToast('Bitte zuerst einen Todo-Titel eingeben.');
      return;
    }

    this.busyVisitDraft = true;

    try {
      await this.runWithActionLoading('Besuchs-Todo wird angelegt...', async () => {
        const todo = await this.caregiverPatientService.createVisitTodo(this.patient.id, this.visit!.id, {
          title: this.visitTodoDraft.title.trim(),
          notes: this.visitTodoDraft.notes.trim() || undefined,
        });

        this.visit!.todos = [...this.visit!.todos, todo].sort((left, right) => left.sortOrder - right.sortOrder || left.id - right.id);
        this.visitTodoDraft = { title: '', notes: '' };
      });
      await this.showToast('Besuchs-Todo wurde angelegt.');
    } catch (error: any) {
      await this.showToast(error?.error?.message || 'Besuchs-Todo konnte nicht angelegt werden.');
    } finally {
      this.busyVisitDraft = false;
    }
  }

  async saveVisitTodo(todo: PatientVisitTodo): Promise<void> {
    if (!this.visit) {
      return;
    }

    if (!todo.title.trim()) {
      await this.showToast('Ein Todo braucht einen Titel.');
      return;
    }

    this.busyVisitTodoIds[todo.id] = true;

    try {
      await this.runWithActionLoading('Besuchs-Todo wird gespeichert...', async () => {
        const updated = await this.caregiverPatientService.updateVisitTodo(this.patient.id, this.visit!.id, todo);
        this.visit!.todos = this.visit!.todos.map((item) => item.id === updated.id ? updated : item);
      });
      await this.showToast('Besuchs-Todo wurde gespeichert.');
    } catch (error: any) {
      await this.showToast(error?.error?.message || 'Besuchs-Todo konnte nicht gespeichert werden.');
    } finally {
      delete this.busyVisitTodoIds[todo.id];
    }
  }

  async toggleVisitTodo(todo: PatientVisitTodo, isCompleted: boolean): Promise<void> {
    todo.isCompleted = isCompleted;
    await this.saveVisitTodo(todo);
  }

  async deleteVisitTodo(todo: PatientVisitTodo): Promise<void> {
    if (!this.visit) {
      return;
    }

    this.busyVisitTodoIds[todo.id] = true;

    try {
      await this.runWithActionLoading('Besuchs-Todo wird gelöscht...', async () => {
        await this.caregiverPatientService.deleteVisitTodo(this.patient.id, this.visit!.id, todo.id);
        this.visit!.todos = this.visit!.todos.filter((item) => item.id !== todo.id);
        if (this.selectedTodoId === todo.id) {
          this.selectedTodoId = null;
        }
      });
      await this.showToast('Besuchs-Todo wurde gelöscht.');
    } catch (error: any) {
      await this.showToast(error?.error?.message || 'Besuchs-Todo konnte nicht gelöscht werden.');
    } finally {
      delete this.busyVisitTodoIds[todo.id];
    }
  }

  isVisitTodoBusy(todoId: number): boolean {
    return !!this.busyVisitTodoIds[todoId];
  }

  get selectedTodo(): PatientVisitTodo | null {
    if (!this.visit || !this.selectedTodoId) {
      return null;
    }

    return this.visit.todos.find((todo) => todo.id === this.selectedTodoId) || null;
  }

  selectTodo(todo: PatientVisitTodo): void {
    this.selectedTodoId = todo.id;
  }

  closeTodoModal(): void {
    this.selectedTodoId = null;
  }

  formatDate(value: string): string {
    if (!value) {
      return 'Nicht hinterlegt';
    }

    return new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(value));
  }

  formatDateTime(value: string): string {
    if (!value) {
      return 'Noch nicht gespeichert';
    }

    return new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  }

  displayValue(value: string | null | undefined, fallback = 'Nicht hinterlegt'): string {
    return value && `${value}`.trim() ? `${value}` : fallback;
  }

  trackTodo(_index: number, todo: PatientVisitTodo): number {
    return todo.id;
  }

  private async runWithActionLoading<T>(message: string, action: () => Promise<T>): Promise<T> {
    this.isActionLoading = true;
    this.actionLoadingMessage = message;

    try {
      return await action();
    } finally {
      this.isActionLoading = false;
      this.actionLoadingMessage = '';
    }
  }

  private async showToast(message: string): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 2200,
      position: 'top',
      color: 'medium',
    });

    await toast.present();
  }
}