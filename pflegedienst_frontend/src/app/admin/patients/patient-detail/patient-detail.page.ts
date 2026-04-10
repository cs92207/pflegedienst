import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Patient, createEmptyPatient, Medication, TreatingDoctor, EmergencyContact } from '../../../models/patient';
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
  activeSection: 'stammdaten' | 'pflege' | 'medikation' | 'aerzte' | 'rechtliches' = 'stammdaten';

  newDiagnosis = '';
  newAllergy = '';

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
}
