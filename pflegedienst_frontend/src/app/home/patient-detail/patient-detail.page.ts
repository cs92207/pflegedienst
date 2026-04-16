import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { createEmptyPatient, Medication, Patient, PatientDefaultTodo, PatientVisit, PatientVisitTodo } from '../../models/patient';
import { CaregiverPatientService } from '../../services/caregiver-patient.service';

type DetailSection = 'besuche' | 'stammdaten' | 'pflege' | 'medikation' | 'kontakte' | 'rechtliches' | 'leistungen' | 'standards';

@Component({
  selector: 'app-patient-detail',
  templateUrl: './patient-detail.page.html',
  styleUrls: ['./patient-detail.page.scss'],
  standalone: false
})
export class PatientDetailPage implements OnInit {

  patient: Patient = createEmptyPatient();
  isLoading = true;
  errorMessage = '';
  activeSection: DetailSection = 'besuche';

  newDefaultTodoTitle = '';
  newDefaultTodoNotes = '';

  newVisitDate = '';
  newVisitStartTime = '';
  newVisitEndTime = '';
  newVisitNotes = '';

  actionLoadingMessage = '';
  isActionLoading = false;
  isCreatingDefaultTodo = false;
  isCreatingVisit = false;
  busyDefaultTodoIds: Record<number, boolean> = {};
  busyVisitIds: Record<number, boolean> = {};

  constructor(
    private activatedRoute: ActivatedRoute,
    private caregiverPatientService: CaregiverPatientService,
    private router: Router,
    private toastController: ToastController,
  ) {}

  async ngOnInit(): Promise<void> {
    this.resetVisitDraft();

    const id = Number(this.activatedRoute.snapshot.paramMap.get('id'));
    if (!id) {
      await this.router.navigate(['/home/patients']);
      return;
    }

    await this.loadPatient(id);
  }

  get patientName(): string {
    return `${this.patient.firstName} ${this.patient.lastName}`.trim();
  }

  get sortedVisits(): PatientVisit[] {
    return [...this.patient.visits].sort((left, right) => {
      const leftKey = `${left.visitDate} ${left.startTime}`;
      const rightKey = `${right.visitDate} ${right.startTime}`;
      return rightKey.localeCompare(leftKey);
    });
  }

  async loadPatient(id: number): Promise<void> {
    this.isLoading = true;
    this.errorMessage = '';

    try {
      this.patient = await this.caregiverPatientService.getMyPatient(id);
    } catch (error: any) {
      this.errorMessage = error?.error?.message || 'Die Patientendetails konnten nicht geladen werden.';
    } finally {
      this.isLoading = false;
    }
  }

  async goBack(): Promise<void> {
    await this.router.navigate(['/home/patients']);
  }

  async createDefaultTodo(): Promise<void> {
    if (!this.newDefaultTodoTitle.trim()) {
      await this.showToast('Bitte zuerst einen Titel für das Standard-Todo eingeben.');
      return;
    }

    this.isCreatingDefaultTodo = true;

    try {
      await this.runWithActionLoading('Standard-Todo wird angelegt...', async () => {
        const todo = await this.caregiverPatientService.createDefaultTodo(this.patient.id, {
          title: this.newDefaultTodoTitle.trim(),
          notes: this.newDefaultTodoNotes.trim() || undefined,
        });

        this.patient.defaultTodos = [...this.patient.defaultTodos, todo].sort((left, right) => left.sortOrder - right.sortOrder || left.id - right.id);
        this.newDefaultTodoTitle = '';
        this.newDefaultTodoNotes = '';
      });

      await this.showToast('Standard-Todo wurde angelegt.');
    } catch (error: any) {
      await this.showToast(error?.error?.message || 'Standard-Todo konnte nicht angelegt werden.');
    } finally {
      this.isCreatingDefaultTodo = false;
    }
  }

  async saveDefaultTodo(todo: PatientDefaultTodo): Promise<void> {
    if (!todo.title.trim()) {
      await this.showToast('Ein Standard-Todo braucht einen Titel.');
      return;
    }

    this.busyDefaultTodoIds[todo.id] = true;

    try {
      await this.runWithActionLoading('Standard-Todo wird gespeichert...', async () => {
        const updated = await this.caregiverPatientService.updateDefaultTodo(this.patient.id, todo);
        this.patient.defaultTodos = this.patient.defaultTodos.map((item) => item.id === updated.id ? updated : item);
      });
      await this.showToast('Standard-Todo wurde gespeichert.');
    } catch (error: any) {
      await this.showToast(error?.error?.message || 'Standard-Todo konnte nicht gespeichert werden.');
    } finally {
      delete this.busyDefaultTodoIds[todo.id];
    }
  }

  async deleteDefaultTodo(todo: PatientDefaultTodo): Promise<void> {
    this.busyDefaultTodoIds[todo.id] = true;

    try {
      await this.runWithActionLoading('Standard-Todo wird gelöscht...', async () => {
        await this.caregiverPatientService.deleteDefaultTodo(this.patient.id, todo.id);
        this.patient.defaultTodos = this.patient.defaultTodos.filter((item) => item.id !== todo.id);
      });
      await this.showToast('Standard-Todo wurde gelöscht.');
    } catch (error: any) {
      await this.showToast(error?.error?.message || 'Standard-Todo konnte nicht gelöscht werden.');
    } finally {
      delete this.busyDefaultTodoIds[todo.id];
    }
  }

  async createVisit(): Promise<void> {
    if (!this.newVisitDate || !this.newVisitStartTime) {
      await this.showToast('Datum und Startzeit sind für einen Besuch erforderlich.');
      return;
    }

    this.isCreatingVisit = true;

    try {
      await this.runWithActionLoading('Besuch wird angelegt...', async () => {
        const visit = await this.caregiverPatientService.createVisit(this.patient.id, {
          visitDate: this.newVisitDate,
          startTime: this.newVisitStartTime,
          endTime: this.newVisitEndTime || undefined,
          notes: this.newVisitNotes.trim() || undefined,
        });

        this.patient.visits = [visit, ...this.patient.visits];
        this.resetVisitDraft();
      });
      await this.showToast('Besuch wurde angelegt.');
    } catch (error: any) {
      await this.showToast(error?.error?.message || 'Besuch konnte nicht angelegt werden.');
    } finally {
      this.isCreatingVisit = false;
    }
  }

  async saveVisit(visit: PatientVisit): Promise<void> {
    if (!visit.visitDate || !visit.startTime) {
      await this.showToast('Datum und Startzeit sind für einen Besuch erforderlich.');
      return;
    }

    this.busyVisitIds[visit.id] = true;

    try {
      await this.runWithActionLoading('Besuch wird gespeichert...', async () => {
        const updated = await this.caregiverPatientService.updateVisit(this.patient.id, visit);
        this.patient.visits = this.patient.visits.map((item) => item.id === updated.id ? updated : item);
      });
      await this.showToast('Besuch wurde gespeichert.');
    } catch (error: any) {
      await this.showToast(error?.error?.message || 'Besuch konnte nicht gespeichert werden.');
    } finally {
      delete this.busyVisitIds[visit.id];
    }
  }

  async toggleVisitRelease(visit: PatientVisit, isReleasedToAdmin: boolean): Promise<void> {
    this.busyVisitIds[visit.id] = true;

    try {
      await this.runWithActionLoading(isReleasedToAdmin ? 'Besuch wird freigegeben...' : 'Freigabe wird zurückgezogen...', async () => {
        const updated = await this.caregiverPatientService.updateVisitRelease(this.patient.id, visit.id, isReleasedToAdmin);
        this.patient.visits = this.patient.visits.map((item) => item.id === updated.id ? updated : item);
      });
      await this.showToast(isReleasedToAdmin ? 'Besuch für das Admin-Dashboard freigegeben.' : 'Admin-Freigabe wurde zurückgezogen.');
    } catch (error: any) {
      await this.showToast(error?.error?.message || 'Freigabe konnte nicht aktualisiert werden.');
    } finally {
      delete this.busyVisitIds[visit.id];
    }
  }

  async deleteVisit(visit: PatientVisit): Promise<void> {
    this.busyVisitIds[visit.id] = true;

    try {
      await this.runWithActionLoading('Besuch wird gelöscht...', async () => {
        await this.caregiverPatientService.deleteVisit(this.patient.id, visit.id);
        this.patient.visits = this.patient.visits.filter((item) => item.id !== visit.id);
      });
      await this.showToast('Besuch wurde gelöscht.');
    } catch (error: any) {
      await this.showToast(error?.error?.message || 'Besuch konnte nicht gelöscht werden.');
    } finally {
      delete this.busyVisitIds[visit.id];
    }
  }

  isDefaultTodoBusy(todoId: number): boolean {
    return !!this.busyDefaultTodoIds[todoId];
  }

  isVisitBusy(visitId: number): boolean {
    return !!this.busyVisitIds[visitId];
  }

  async openVisit(visit: PatientVisit): Promise<void> {
    await this.router.navigate(['/home/patients', this.patient.id, 'visits', visit.id]);
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

  formatMedication(medication: Medication): string {
    return [medication.dosage, medication.frequency].filter(Boolean).join(' | ') || 'Keine Zusatzangaben';
  }

  statusLabel(status: string): string {
    const labels: Record<string, string> = {
      active: 'Aktiv',
      inactive: 'Inaktiv',
      discharged: 'Entlassen',
      deceased: 'Verstorben',
    };

    return labels[status] || status;
  }

  genderLabel(gender: string): string {
    const labels: Record<string, string> = {
      male: 'Männlich',
      female: 'Weiblich',
      diverse: 'Divers',
    };

    return labels[gender] || gender || 'Nicht hinterlegt';
  }

  booleanLabel(value: boolean): string {
    return value ? 'Ja' : 'Nein';
  }

  displayValue(value: string | null | undefined, fallback = 'Nicht hinterlegt'): string {
    return value && `${value}`.trim() ? `${value}` : fallback;
  }

  trackVisit(_index: number, visit: PatientVisit): number {
    return visit.id;
  }

  trackDefaultTodo(_index: number, todo: PatientDefaultTodo): number {
    return todo.id;
  }

  private resetVisitDraft(): void {
    const now = new Date();
    const end = new Date(now.getTime() + 60 * 60 * 1000);
    this.newVisitDate = this.toDateInput(now);
    this.newVisitStartTime = this.toTimeInput(now);
    this.newVisitEndTime = this.toTimeInput(end);
    this.newVisitNotes = '';
  }

  private toDateInput(value: Date): string {
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, '0');
    const day = `${value.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private toTimeInput(value: Date): string {
    const hours = `${value.getHours()}`.padStart(2, '0');
    const minutes = `${value.getMinutes()}`.padStart(2, '0');
    return `${hours}:${minutes}`;
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