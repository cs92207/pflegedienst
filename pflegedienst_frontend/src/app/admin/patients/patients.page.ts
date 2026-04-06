import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { PatientListItem, createEmptyPatient, Patient } from '../../models/patient';
import { AdminPatientService } from '../../services/admin-patient.service';
import { LoadingService } from '../../services/loading.service';
import { PopupService } from '../../services/popup.service';

@Component({
  selector: 'app-patients',
  templateUrl: './patients.page.html',
  styleUrls: ['./patients.page.scss'],
  standalone: false
})
export class PatientsPage implements OnInit {

  patients: PatientListItem[] = [];
  isBusy = false;
  searchTerm = '';
  statusFilter = '';

  showCreateForm = false;
  newPatient: Patient = createEmptyPatient();

  constructor(
    private patientService: AdminPatientService,
    private loadingService: LoadingService,
    private popupService: PopupService,
    private router: Router,
  ) {}

  async ngOnInit() {
    await this.loadPatients();
  }

  async loadPatients() {
    this.isBusy = true;
    try {
      this.patients = await this.patientService.listPatients(
        this.searchTerm || undefined,
        this.statusFilter || undefined
      );
    } catch (error: any) {
      this.popupService.showAlert(error?.error?.message || 'Patienten konnten nicht geladen werden.');
    } finally {
      this.isBusy = false;
    }
  }

  async onSearch() {
    await this.loadPatients();
  }

  async onStatusChange() {
    await this.loadPatients();
  }

  toggleCreateForm() {
    this.showCreateForm = !this.showCreateForm;
    if (this.showCreateForm) {
      this.newPatient = createEmptyPatient();
    }
  }

  async createPatient() {
    if (!this.newPatient.firstName || !this.newPatient.lastName || !this.newPatient.dateOfBirth) {
      this.popupService.showAlert('Bitte Vorname, Nachname und Geburtsdatum angeben.');
      return;
    }

    await this.loadingService.showPopup('Patient wird angelegt...');
    try {
      const response = await this.patientService.createPatient(this.newPatient);
      this.popupService.showSuccess(response.message);
      this.showCreateForm = false;
      this.newPatient = createEmptyPatient();
      await this.loadPatients();
    } catch (error: any) {
      this.popupService.showAlert(error?.error?.message || 'Patient konnte nicht angelegt werden.');
    } finally {
      await this.loadingService.closePopup();
    }
  }

  async deletePatient(patient: PatientListItem) {
    const confirmed = await this.popupService.showConfirm(
      `${patient.firstName} ${patient.lastName} wird dauerhaft gelöscht. Alle zugehörigen Daten werden unwiderruflich entfernt.`,
      'Patient löschen',
      'Löschen',
      'Abbrechen'
    );
    if (!confirmed) return;

    await this.loadingService.showPopup('Patient wird gelöscht...');
    try {
      const response = await this.patientService.deletePatient(patient.id);
      this.popupService.showSuccess(response.message);
      await this.loadPatients();
    } catch (error: any) {
      this.popupService.showAlert(error?.error?.message || 'Patient konnte nicht gelöscht werden.');
    } finally {
      await this.loadingService.closePopup();
    }
  }

  openPatient(patient: PatientListItem) {
    this.router.navigateByUrl(`/admin/patients/${patient.id}`);
  }

  get activeCount(): number {
    return this.patients.filter(p => p.status === 'active').length;
  }

  get totalCount(): number {
    return this.patients.length;
  }

  statusLabel(status: string): string {
    const labels: Record<string, string> = {
      active: 'Aktiv',
      inactive: 'Inaktiv',
      deceased: 'Verstorben',
      discharged: 'Entlassen',
    };
    return labels[status] || status;
  }

  careLevelLabel(level: string | null): string {
    if (!level) return '–';
    return `Pflegegrad ${level}`;
  }

  genderLabel(gender: string): string {
    const labels: Record<string, string> = { male: 'Männlich', female: 'Weiblich', diverse: 'Divers' };
    return labels[gender] || gender;
  }
}
