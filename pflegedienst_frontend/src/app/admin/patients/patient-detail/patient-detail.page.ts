import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Patient, createEmptyPatient, Medication, TreatingDoctor, EmergencyContact, PatientAgreedService, PatientDefaultTodo } from '../../../models/patient';
import { User } from '../../../models/user';
import { AdminAccountService } from '../../../services/admin-account.service';
import { AdminPatientService } from '../../../services/admin-patient.service';
import { LoadingService } from '../../../services/loading.service';
import { PopupService } from '../../../services/popup.service';

@Component({
  selector: 'app-patient-detail',
  templateUrl: './patient-detail.page.html',
  styleUrls: ['./patient-detail.page.scss'],
  standalone: false
})
export class PatientDetailPage implements OnInit {

  patient: Patient = createEmptyPatient();
  caregivers: User[] = [];
  isLoading = true;
  isSavingAgreedServices = false;
  activeSection: 'stammdaten' | 'pflege' | 'medikation' | 'aerzte' | 'rechtliches' | 'leistungen' | 'standards' | 'besuche' = 'stammdaten';

  newDiagnosis = '';
  newAllergy = '';
  newServiceTitle = '';
  newServiceNotes = '';
  newDefaultTodoTitle = '';
  newDefaultTodoNotes = '';
  private agreedServicesSnapshot = '[]';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private accountService: AdminAccountService,
    private patientService: AdminPatientService,
    private loadingService: LoadingService,
    private popupService: PopupService,
  ) {}

  async ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) {
      this.router.navigateByUrl('/admin/patients');
      return;
    }
    await this.loadPatient(id);
  }

  async loadPatient(id: number) {
    this.isLoading = true;
    try {
      const [patient, accounts] = await Promise.all([
        this.patientService.getPatient(id),
        this.accountService.listAccounts(),
      ]);

      this.patient = patient;
      this.agreedServicesSnapshot = this.createAgreedServicesSnapshot(patient.agreedServices);
      this.caregivers = [...accounts].sort((left, right) => left.name.localeCompare(right.name, 'de'));
    } catch (error: any) {
      this.popupService.showAlert(error?.error?.message || 'Patient konnte nicht geladen werden.');
      this.router.navigateByUrl('/admin/patients');
    } finally {
      this.isLoading = false;
    }
  }

  async save() {
    await this.loadingService.showPopup('Wird gespeichert...');
    try {
      const response = await this.patientService.updatePatient(this.patient);
      this.patient = response.patient;
      this.popupService.showSuccess(response.message);
    } catch (error: any) {
      this.popupService.showAlert(error?.error?.message || 'Fehler beim Speichern.');
    } finally {
      await this.loadingService.closePopup();
    }
  }

  goBack() {
    this.router.navigateByUrl('/admin/patients');
  }

  // ── Diagnosen ─────────────────────────────────
  addDiagnosis() {
    if (this.newDiagnosis.trim()) {
      this.patient.diagnoses.push(this.newDiagnosis.trim());
      this.newDiagnosis = '';
    }
  }

  removeDiagnosis(index: number) {
    this.patient.diagnoses.splice(index, 1);
  }

  // ── Allergien ─────────────────────────────────
  addAllergy() {
    if (this.newAllergy.trim()) {
      this.patient.allergies.push(this.newAllergy.trim());
      this.newAllergy = '';
    }
  }

  removeAllergy(index: number) {
    this.patient.allergies.splice(index, 1);
  }

  // ── Medikamente ───────────────────────────────
  addMedication() {
    this.patient.medications.push({ name: '', dosage: '', frequency: '', notes: '' });
  }

  removeMedication(index: number) {
    this.patient.medications.splice(index, 1);
  }

  // ── Ärzte ─────────────────────────────────────
  addDoctor() {
    this.patient.treatingDoctors.push({ name: '', specialty: '', phone: '' });
  }

  removeDoctor(index: number) {
    this.patient.treatingDoctors.splice(index, 1);
  }

  // ── Notfallkontakte ───────────────────────────
  addEmergencyContact() {
    this.patient.emergencyContacts.push({ name: '', relationship: '', phone: '' });
  }

  removeEmergencyContact(index: number) {
    this.patient.emergencyContacts.splice(index, 1);
  }

  // ── Betreuer ──────────────────────────────────
  ensureLegalGuardian() {
    if (!this.patient.legalGuardian) {
      this.patient.legalGuardian = { name: '', phone: '', relationship: '' };
    }
  }

  clearLegalGuardian() {
    this.patient.legalGuardian = null;
  }

  async addAgreedService() {
    if (!this.newServiceTitle.trim()) {
      return;
    }

    this.patient.agreedServices = [
      ...this.patient.agreedServices,
      {
        title: this.newServiceTitle.trim(),
        notes: this.newServiceNotes.trim(),
      }
    ];

    this.newServiceTitle = '';
    this.newServiceNotes = '';

    await this.persistAgreedServices(true);
  }

  async removeAgreedService(service: PatientAgreedService) {
    this.patient.agreedServices = this.patient.agreedServices.filter((item) => item !== service);

    await this.persistAgreedServices(true);
  }

  async onAgreedServiceBlur() {
    await this.persistAgreedServices();
  }

  addDefaultTodo() {
    if (!this.newDefaultTodoTitle.trim()) {
      return;
    }

    const nextSortOrder = this.patient.defaultTodos.reduce((max, todo) => Math.max(max, todo.sortOrder), 0) + 1;
    this.patient.defaultTodos = [
      ...this.patient.defaultTodos,
      {
        id: 0,
        title: this.newDefaultTodoTitle.trim(),
        notes: this.newDefaultTodoNotes.trim(),
        sortOrder: nextSortOrder,
        source: 'admin',
        createdByUser: null,
        createdAt: '',
        updatedAt: '',
      }
    ];

    this.newDefaultTodoTitle = '';
    this.newDefaultTodoNotes = '';
  }

  removeDefaultTodo(todo: PatientDefaultTodo) {
    this.patient.defaultTodos = this.patient.defaultTodos.filter((item) => item !== todo);
  }

  isResponsibleEmployee(userId: number): boolean {
    return this.patient.responsibleEmployeeIds.includes(userId);
  }

  toggleResponsibleEmployee(user: User) {
    if (this.isResponsibleEmployee(user.id)) {
      this.patient.responsibleEmployeeIds = this.patient.responsibleEmployeeIds.filter((id) => id !== user.id);
      this.patient.responsibleEmployees = this.patient.responsibleEmployees.filter((employee) => employee.id !== user.id);
      return;
    }

    this.patient.responsibleEmployeeIds = [...this.patient.responsibleEmployeeIds, user.id];
    this.patient.responsibleEmployees = [
      ...this.patient.responsibleEmployees,
      { id: user.id, name: user.name, email: user.email },
    ];
  }

  statusLabel(status: string): string {
    const labels: Record<string, string> = {
      active: 'Aktiv', inactive: 'Inaktiv', deceased: 'Verstorben', discharged: 'Entlassen',
    };
    return labels[status] || status;
  }

  get sortedVisits() {
    return [...this.patient.visits].sort((left, right) => {
      const leftKey = `${left.visitDate} ${left.startTime}`;
      const rightKey = `${right.visitDate} ${right.startTime}`;
      return rightKey.localeCompare(leftKey);
    });
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

  private async persistAgreedServices(showSuccess = false) {
    if (!this.patient.id || this.isSavingAgreedServices) {
      return;
    }

    const normalizedServices = this.normalizeAgreedServices(this.patient.agreedServices);
    const nextSnapshot = this.createAgreedServicesSnapshot(normalizedServices);

    this.patient.agreedServices = normalizedServices;

    if (nextSnapshot === this.agreedServicesSnapshot) {
      return;
    }

    this.isSavingAgreedServices = true;

    try {
      const response = await this.patientService.updateAgreedServices(this.patient.id, normalizedServices);
      this.patient.agreedServices = response.agreedServices;
      this.agreedServicesSnapshot = this.createAgreedServicesSnapshot(response.agreedServices);

      if (showSuccess) {
        this.popupService.showSuccess(response.message);
      }
    } catch (error: any) {
      this.popupService.showAlert(error?.error?.message || 'Leistungen konnten nicht gespeichert werden.');
    } finally {
      this.isSavingAgreedServices = false;
    }
  }

  private normalizeAgreedServices(services: PatientAgreedService[]): PatientAgreedService[] {
    return services
      .map((service) => ({
        title: service.title.trim(),
        notes: service.notes.trim(),
      }))
      .filter((service) => service.title.length > 0);
  }

  private createAgreedServicesSnapshot(services: PatientAgreedService[]): string {
    return JSON.stringify(this.normalizeAgreedServices(services));
  }
}
