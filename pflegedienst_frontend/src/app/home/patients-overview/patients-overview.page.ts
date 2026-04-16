import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { PatientListItem } from '../../models/patient';
import { CaregiverPatientService } from '../../services/caregiver-patient.service';

@Component({
  selector: 'app-patients-overview',
  templateUrl: './patients-overview.page.html',
  styleUrls: ['./patients-overview.page.scss'],
  standalone: false
})
export class PatientsOverviewPage implements OnInit {

  patients: PatientListItem[] = [];
  isLoading = true;
  searchTerm = '';
  statusFilter = '';
  errorMessage = '';

  constructor(
    private caregiverPatientService: CaregiverPatientService,
    private router: Router,
    private toastController: ToastController
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadPatients();
  }

  get totalCount(): number {
    return this.patients.length;
  }

  async loadPatients(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = '';

    try {
      this.patients = await this.caregiverPatientService.listMyPatients({
        search: this.searchTerm || undefined,
        status: this.statusFilter || undefined,
      });
    } catch (error: any) {
      this.errorMessage = error?.error?.message || 'Die Pflegekunden konnten nicht geladen werden.';
    } finally {
      this.isLoading = false;
    }
  }

  async onSearch(): Promise<void> {
    await this.loadPatients();
  }

  async onStatusChange(): Promise<void> {
    await this.loadPatients();
  }

  async goBack(): Promise<void> {
    await this.router.navigate(['/home']);
  }

  async openPatientDetails(patient: PatientListItem): Promise<void> {
    await this.router.navigate(['/home/patients', patient.id]);
  }

  trackPatient(_index: number, patient: PatientListItem): number {
    return patient.id;
  }

  patientInitials(patient: PatientListItem): string {
    return `${patient.firstName.charAt(0)}${patient.lastName.charAt(0)}`.toUpperCase();
  }

  patientName(patient: PatientListItem): string {
    return `${patient.firstName} ${patient.lastName}`.trim();
  }

  patientAddress(patient: PatientListItem): string {
    const addressParts = [
      [patient.street, patient.houseNumber].filter(Boolean).join(' '),
      [patient.zipCode, patient.city].filter(Boolean).join(' ')
    ].filter(Boolean);

    return addressParts.join(', ') || 'Adresse wird noch ergänzt';
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
    if (!level) {
      return 'Pflegegrad offen';
    }

    return `Pflegegrad ${level}`;
  }
}