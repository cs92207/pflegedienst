import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Patient, PatientDefaultTodo, PatientListItem, PatientVisit, PatientVisitTodo, ResponsibleEmployee } from '../models/patient';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class CaregiverPatientService {

  constructor(private http: HttpClient, private authService: AuthService) {}

  async listMyPatients(options?: { search?: string; status?: string; limit?: number }): Promise<PatientListItem[]> {
    let url = `${this.authService.apiURL}my-patients`;
    const params: string[] = [];

    if (options?.search) {
      params.push(`search=${encodeURIComponent(options.search)}`);
    }

    if (options?.status) {
      params.push(`status=${encodeURIComponent(options.status)}`);
    }

    if (options?.limit) {
      params.push(`limit=${encodeURIComponent(String(options.limit))}`);
    }

    if (params.length) {
      url += `?${params.join('&')}`;
    }

    const response = await firstValueFrom(this.http.get<any>(url, {
      headers: await this.buildHeaders()
    }));

    return (response?.patients || []).map((patient: any) => this.normalizeListItem(patient));
  }

  async getMyPatient(id: number): Promise<Patient> {
    const response = await firstValueFrom(this.http.get<any>(`${this.authService.apiURL}my-patients/${id}`, {
      headers: await this.buildHeaders()
    }));

    return this.normalizePatient(response?.patient);
  }

  async createDefaultTodo(patientId: number, payload: { title: string; notes?: string }): Promise<PatientDefaultTodo> {
    const response = await firstValueFrom(this.http.post<any>(`${this.authService.apiURL}my-patients/${patientId}/default-todos`, {
      title: payload.title,
      notes: payload.notes || null,
    }, {
      headers: await this.buildHeaders()
    }));

    return this.normalizeDefaultTodo(response?.default_todo);
  }

  async updateDefaultTodo(patientId: number, todo: PatientDefaultTodo): Promise<PatientDefaultTodo> {
    const response = await firstValueFrom(this.http.put<any>(`${this.authService.apiURL}my-patients/${patientId}/default-todos/${todo.id}`, {
      title: todo.title,
      notes: todo.notes || null,
    }, {
      headers: await this.buildHeaders()
    }));

    return this.normalizeDefaultTodo(response?.default_todo);
  }

  async deleteDefaultTodo(patientId: number, todoId: number): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.authService.apiURL}my-patients/${patientId}/default-todos/${todoId}`, {
      headers: await this.buildHeaders()
    }));
  }

  async createVisit(patientId: number, payload: { visitDate: string; startTime: string; endTime?: string; notes?: string }): Promise<PatientVisit> {
    const response = await firstValueFrom(this.http.post<any>(`${this.authService.apiURL}my-patients/${patientId}/visits`, {
      visit_date: payload.visitDate,
      start_time: payload.startTime,
      end_time: payload.endTime || null,
      notes: payload.notes || null,
    }, {
      headers: await this.buildHeaders()
    }));

    return this.normalizeVisit(response?.visit);
  }

  async updateVisit(patientId: number, visit: PatientVisit): Promise<PatientVisit> {
    const response = await firstValueFrom(this.http.put<any>(`${this.authService.apiURL}my-patients/${patientId}/visits/${visit.id}`, {
      visit_date: visit.visitDate,
      start_time: visit.startTime,
      end_time: visit.endTime || null,
      notes: visit.notes || null,
    }, {
      headers: await this.buildHeaders()
    }));

    return this.normalizeVisit(response?.visit);
  }

  async updateVisitRelease(patientId: number, visitId: number, isReleasedToAdmin: boolean): Promise<PatientVisit> {
    const response = await firstValueFrom(this.http.put<any>(`${this.authService.apiURL}my-patients/${patientId}/visits/${visitId}/release`, {
      is_released_to_admin: isReleasedToAdmin,
    }, {
      headers: await this.buildHeaders()
    }));

    return this.normalizeVisit(response?.visit);
  }

  async deleteVisit(patientId: number, visitId: number): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.authService.apiURL}my-patients/${patientId}/visits/${visitId}`, {
      headers: await this.buildHeaders()
    }));
  }

  async createVisitTodo(patientId: number, visitId: number, payload: { title: string; notes?: string; isCompleted?: boolean }): Promise<PatientVisitTodo> {
    const response = await firstValueFrom(this.http.post<any>(`${this.authService.apiURL}my-patients/${patientId}/visits/${visitId}/todos`, {
      title: payload.title,
      notes: payload.notes || null,
      is_completed: payload.isCompleted ?? false,
    }, {
      headers: await this.buildHeaders()
    }));

    return this.normalizeVisitTodo(response?.todo);
  }

  async updateVisitTodo(patientId: number, visitId: number, todo: PatientVisitTodo): Promise<PatientVisitTodo> {
    const response = await firstValueFrom(this.http.put<any>(`${this.authService.apiURL}my-patients/${patientId}/visits/${visitId}/todos/${todo.id}`, {
      title: todo.title,
      notes: todo.notes || null,
      is_completed: todo.isCompleted,
    }, {
      headers: await this.buildHeaders()
    }));

    return this.normalizeVisitTodo(response?.todo);
  }

  async deleteVisitTodo(patientId: number, visitId: number, todoId: number): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.authService.apiURL}my-patients/${patientId}/visits/${visitId}/todos/${todoId}`, {
      headers: await this.buildHeaders()
    }));
  }

  private async buildHeaders(): Promise<HttpHeaders> {
    const token = await this.authService.loadAuthToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  private normalizeListItem(data: any): PatientListItem {
    return {
      id: data?.id ?? 0,
      patientNumber: data?.patient_number ?? '',
      firstName: data?.first_name ?? '',
      lastName: data?.last_name ?? '',
      dateOfBirth: data?.date_of_birth ?? '',
      gender: data?.gender ?? '',
      status: data?.status ?? 'active',
      careLevel: data?.care_level ?? null,
      street: data?.street ?? null,
      houseNumber: data?.house_number ?? null,
      zipCode: data?.zip_code ?? null,
      city: data?.city ?? null,
      phone: data?.phone ?? null,
      responsibleEmployees: (data?.responsible_users ?? []).map((user: any) => this.normalizeResponsibleEmployee(user)),
      createdAt: data?.created_at ?? '',
    };
  }

  private normalizePatient(data: any): Patient {
    return {
      id: data?.id ?? 0,
      patientNumber: data?.patient_number ?? '',
      status: data?.status ?? 'active',
      firstName: data?.first_name ?? '',
      lastName: data?.last_name ?? '',
      dateOfBirth: data?.date_of_birth ?? '',
      gender: data?.gender ?? 'diverse',
      email: data?.email ?? '',
      phone: data?.phone ?? '',
      mobilePhone: data?.mobile_phone ?? '',
      street: data?.street ?? '',
      houseNumber: data?.house_number ?? '',
      zipCode: data?.zip_code ?? '',
      city: data?.city ?? '',
      insuranceType: data?.insurance_type ?? '',
      insuranceProvider: data?.insurance_provider ?? '',
      insuranceNumber: data?.insurance_number ?? '',
      careLevel: data?.care_level ?? '',
      careLevelSince: data?.care_level_since ?? '',
      diagnoses: data?.diagnoses ?? [],
      allergies: data?.allergies ?? [],
      medications: (data?.medications ?? []).map((item: any) => ({
        name: item?.name ?? '',
        dosage: item?.dosage ?? '',
        frequency: item?.frequency ?? '',
        notes: item?.notes ?? '',
      })),
      careNotes: data?.care_notes ?? '',
      livingSituation: data?.living_situation ?? '',
      mobility: data?.mobility ?? '',
      nutrition: data?.nutrition ?? '',
      communicationAbility: data?.communication_ability ?? '',
      agreedServices: (data?.agreed_services ?? []).map((service: any) => ({
        title: service?.title ?? '',
        notes: service?.notes ?? '',
      })),
      treatingDoctors: (data?.treating_doctors ?? []).map((doctor: any) => ({
        name: doctor?.name ?? '',
        specialty: doctor?.specialty ?? '',
        phone: doctor?.phone ?? '',
      })),
      emergencyContacts: (data?.emergency_contacts ?? []).map((contact: any) => ({
        name: contact?.name ?? '',
        relationship: contact?.relationship ?? '',
        phone: contact?.phone ?? '',
      })),
      legalGuardian: data?.legal_guardian ? {
        name: data.legal_guardian.name ?? '',
        phone: data.legal_guardian.phone ?? '',
        relationship: data.legal_guardian.relationship ?? '',
      } : null,
      hasAdvanceDirective: !!data?.has_advance_directive,
      advanceDirectiveNotes: data?.advance_directive_notes ?? '',
      hasPowerOfAttorney: !!data?.has_power_of_attorney,
      powerOfAttorneyNotes: data?.power_of_attorney_notes ?? '',
      hasDnrOrder: !!data?.has_dnr_order,
      responsibleEmployees: (data?.responsible_users ?? []).map((user: any) => this.normalizeResponsibleEmployee(user)),
      responsibleEmployeeIds: (data?.responsible_users ?? []).map((user: any) => Number(user?.id ?? 0)).filter((id: number) => id > 0),
      defaultTodos: (data?.default_todos ?? []).map((todo: any) => this.normalizeDefaultTodo(todo)),
      visits: (data?.visits ?? []).map((visit: any) => this.normalizeVisit(visit)),
      createdAt: data?.created_at ?? '',
      updatedAt: data?.updated_at ?? '',
    };
  }

  private normalizeDefaultTodo(data: any): PatientDefaultTodo {
    return {
      id: Number(data?.id ?? 0),
      title: data?.title ?? '',
      notes: data?.notes ?? '',
      sortOrder: Number(data?.sort_order ?? 0),
      source: data?.source === 'admin' ? 'admin' : 'caregiver',
      createdByUser: data?.created_by_user ? this.normalizeResponsibleEmployee(data.created_by_user) : null,
      createdAt: data?.created_at ?? '',
      updatedAt: data?.updated_at ?? '',
    };
  }

  private normalizeVisit(data: any): PatientVisit {
    return {
      id: Number(data?.id ?? 0),
      visitDate: data?.visit_date ?? '',
      startTime: data?.start_time ?? '',
      endTime: data?.end_time ?? '',
      notes: data?.notes ?? '',
      isReleasedToAdmin: !!data?.is_released_to_admin,
      releasedToAdminAt: data?.released_to_admin_at ?? '',
      releasedToAdminByUser: data?.released_to_admin_by_user ? this.normalizeResponsibleEmployee(data.released_to_admin_by_user) : null,
      createdByUser: data?.created_by_user ? this.normalizeResponsibleEmployee(data.created_by_user) : null,
      todos: (data?.todos ?? []).map((todo: any) => this.normalizeVisitTodo(todo)),
      createdAt: data?.created_at ?? '',
      updatedAt: data?.updated_at ?? '',
    };
  }

  private normalizeVisitTodo(data: any): PatientVisitTodo {
    return {
      id: Number(data?.id ?? 0),
      patientDefaultTodoId: data?.patient_default_todo_id ?? null,
      title: data?.title ?? '',
      notes: data?.notes ?? '',
      isCompleted: !!data?.is_completed,
      completedAt: data?.completed_at ?? '',
      sortOrder: Number(data?.sort_order ?? 0),
      source: data?.source === 'default' ? 'default' : 'manual',
      createdByUser: data?.created_by_user ? this.normalizeResponsibleEmployee(data.created_by_user) : null,
      createdAt: data?.created_at ?? '',
      updatedAt: data?.updated_at ?? '',
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