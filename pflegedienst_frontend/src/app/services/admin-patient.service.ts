import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Patient, PatientListItem, ResponsibleEmployee } from '../models/patient';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class AdminPatientService {

  constructor(private http: HttpClient, private authService: AuthService) {}

  async listPatients(search?: string, status?: string): Promise<PatientListItem[]> {
    let url = `${this.authService.apiURL}admin/patients`;
    const params: string[] = [];
    if (search) params.push(`search=${encodeURIComponent(search)}`);
    if (status) params.push(`status=${encodeURIComponent(status)}`);
    if (params.length) url += '?' + params.join('&');

    const response = await firstValueFrom(this.http.get<any>(url, {
      headers: await this.buildHeaders()
    }));

    return (response?.patients || []).map((p: any) => this.normalizeListItem(p));
  }

  async getPatient(id: number): Promise<Patient> {
    const response = await firstValueFrom(this.http.get<any>(
      `${this.authService.apiURL}admin/patients/${id}`,
      { headers: await this.buildHeaders() }
    ));

    return this.normalizePatient(response?.patient);
  }

  async createPatient(patient: Partial<Patient>): Promise<{ message: string; patient: Patient }> {
    const response = await firstValueFrom(this.http.post<any>(
      `${this.authService.apiURL}admin/patients`,
      this.toPayload(patient),
      { headers: await this.buildHeaders() }
    ));

    return {
      message: response?.message || 'Patient wurde angelegt.',
      patient: this.normalizePatient(response?.patient),
    };
  }

  async updatePatient(patient: Patient): Promise<{ message: string; patient: Patient }> {
    const response = await firstValueFrom(this.http.put<any>(
      `${this.authService.apiURL}admin/patients/${patient.id}`,
      this.toPayload(patient),
      { headers: await this.buildHeaders() }
    ));

    return {
      message: response?.message || 'Patient wurde aktualisiert.',
      patient: this.normalizePatient(response?.patient),
    };
  }

  async deletePatient(id: number): Promise<{ message: string }> {
    const response = await firstValueFrom(this.http.delete<any>(
      `${this.authService.apiURL}admin/patients/${id}`,
      { headers: await this.buildHeaders() }
    ));

    return { message: response?.message || 'Patient wurde gelöscht.' };
  }

  private async buildHeaders(): Promise<HttpHeaders> {
    const token = await this.authService.loadAuthToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  private toPayload(p: Partial<Patient>): any {
    return {
      first_name: p.firstName,
      last_name: p.lastName,
      date_of_birth: p.dateOfBirth,
      gender: p.gender,
      status: p.status,
      email: p.email || null,
      phone: p.phone || null,
      mobile_phone: p.mobilePhone || null,
      street: p.street || null,
      house_number: p.houseNumber || null,
      zip_code: p.zipCode || null,
      city: p.city || null,
      insurance_type: p.insuranceType || null,
      insurance_provider: p.insuranceProvider || null,
      insurance_number: p.insuranceNumber || null,
      care_level: p.careLevel || null,
      care_level_since: p.careLevelSince || null,
      diagnoses: p.diagnoses?.length ? p.diagnoses : null,
      allergies: p.allergies?.length ? p.allergies : null,
      medications: p.medications?.length ? p.medications : null,
      care_notes: p.careNotes || null,
      living_situation: p.livingSituation || null,
      mobility: p.mobility || null,
      nutrition: p.nutrition || null,
      communication_ability: p.communicationAbility || null,
      treating_doctors: p.treatingDoctors?.length ? p.treatingDoctors : null,
      emergency_contacts: p.emergencyContacts?.length ? p.emergencyContacts : null,
      legal_guardian: p.legalGuardian?.name ? p.legalGuardian : null,
      has_advance_directive: p.hasAdvanceDirective ?? false,
      advance_directive_notes: p.advanceDirectiveNotes || null,
      has_power_of_attorney: p.hasPowerOfAttorney ?? false,
      power_of_attorney_notes: p.powerOfAttorneyNotes || null,
      has_dnr_order: p.hasDnrOrder ?? false,
      responsible_employee_ids: p.responsibleEmployeeIds ?? p.responsibleEmployees?.map((employee) => employee.id) ?? [],
    };
  }

  private normalizeListItem(d: any): PatientListItem {
    return {
      id: d?.id ?? 0,
      patientNumber: d?.patient_number ?? '',
      firstName: d?.first_name ?? '',
      lastName: d?.last_name ?? '',
      dateOfBirth: d?.date_of_birth ?? '',
      gender: d?.gender ?? '',
      status: d?.status ?? 'active',
      careLevel: d?.care_level ?? null,
      street: d?.street ?? null,
      houseNumber: d?.house_number ?? null,
      zipCode: d?.zip_code ?? null,
      city: d?.city ?? null,
      phone: d?.phone ?? null,
      responsibleEmployees: (d?.responsible_users ?? []).map((user: any) => this.normalizeResponsibleEmployee(user)),
      createdAt: d?.created_at ?? '',
    };
  }

  private normalizePatient(d: any): Patient {
    return {
      id: d?.id ?? 0,
      patientNumber: d?.patient_number ?? '',
      status: d?.status ?? 'active',
      firstName: d?.first_name ?? '',
      lastName: d?.last_name ?? '',
      dateOfBirth: d?.date_of_birth ?? '',
      gender: d?.gender ?? 'diverse',
      email: d?.email ?? '',
      phone: d?.phone ?? '',
      mobilePhone: d?.mobile_phone ?? '',
      street: d?.street ?? '',
      houseNumber: d?.house_number ?? '',
      zipCode: d?.zip_code ?? '',
      city: d?.city ?? '',
      insuranceType: d?.insurance_type ?? '',
      insuranceProvider: d?.insurance_provider ?? '',
      insuranceNumber: d?.insurance_number ?? '',
      careLevel: d?.care_level ?? '',
      careLevelSince: d?.care_level_since ?? '',
      diagnoses: d?.diagnoses ?? [],
      allergies: d?.allergies ?? [],
      medications: (d?.medications ?? []).map((m: any) => ({
        name: m?.name ?? '', dosage: m?.dosage ?? '', frequency: m?.frequency ?? '', notes: m?.notes ?? ''
      })),
      careNotes: d?.care_notes ?? '',
      livingSituation: d?.living_situation ?? '',
      mobility: d?.mobility ?? '',
      nutrition: d?.nutrition ?? '',
      communicationAbility: d?.communication_ability ?? '',
      treatingDoctors: (d?.treating_doctors ?? []).map((doc: any) => ({
        name: doc?.name ?? '', specialty: doc?.specialty ?? '', phone: doc?.phone ?? ''
      })),
      emergencyContacts: (d?.emergency_contacts ?? []).map((c: any) => ({
        name: c?.name ?? '', relationship: c?.relationship ?? '', phone: c?.phone ?? ''
      })),
      legalGuardian: d?.legal_guardian ? {
        name: d.legal_guardian.name ?? '',
        phone: d.legal_guardian.phone ?? '',
        relationship: d.legal_guardian.relationship ?? '',
      } : null,
      hasAdvanceDirective: !!d?.has_advance_directive,
      advanceDirectiveNotes: d?.advance_directive_notes ?? '',
      hasPowerOfAttorney: !!d?.has_power_of_attorney,
      powerOfAttorneyNotes: d?.power_of_attorney_notes ?? '',
      hasDnrOrder: !!d?.has_dnr_order,
      responsibleEmployees: (d?.responsible_users ?? []).map((user: any) => this.normalizeResponsibleEmployee(user)),
      responsibleEmployeeIds: (d?.responsible_users ?? []).map((user: any) => Number(user?.id ?? 0)).filter((id: number) => id > 0),
      createdAt: d?.created_at ?? '',
      updatedAt: d?.updated_at ?? '',
    };
  }

  private normalizeResponsibleEmployee(data: any): ResponsibleEmployee {
    return {
      id: Number(data?.id ?? 0),
      name: data?.name ?? '',
      email: data?.email ?? '',
    };
  }
}
