import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  DailyRoutePlanDay,
  DailyRoutePlanResponse,
  DailyRoutePlanRoute,
  DailyRoutePlanWeek,
  DailyRouteStop,
  MissingResponsibleAssignmentResponse,
  WeeklyRouteOverridePayload,
  WeeklyRouteTemplatePayload,
} from '../models/daily-route';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class AdminDailyRouteService {

  constructor(private http: HttpClient, private authService: AuthService) {}

  async getPlan(weekStart?: string): Promise<DailyRoutePlanResponse> {
    let url = `${this.authService.apiURL}admin/weekly-route-plan`;
    if (weekStart) {
      url += `?week_start=${encodeURIComponent(weekStart)}`;
    }

    const response = await firstValueFrom(this.http.get<any>(url, {
      headers: await this.buildHeaders()
    }));

    return {
      templates: (response?.templates || []).map((route: any) => this.normalizeRoute(route)),
      week: this.normalizeWeek(response?.week),
    };
  }

  async createTemplate(payload: WeeklyRouteTemplatePayload): Promise<{ message: string; template: DailyRoutePlanRoute }> {
    const response = await firstValueFrom(this.http.post<any>(`${this.authService.apiURL}admin/weekly-route-plan/templates`, payload, {
      headers: await this.buildHeaders()
    }));

    return {
      message: response?.message || 'Wochenroute wurde gespeichert.',
      template: this.normalizeRoute(response?.template),
    };
  }

  async updateTemplate(templateId: number, payload: WeeklyRouteTemplatePayload): Promise<{ message: string; template: DailyRoutePlanRoute }> {
    const response = await firstValueFrom(this.http.put<any>(`${this.authService.apiURL}admin/weekly-route-plan/templates/${templateId}`, payload, {
      headers: await this.buildHeaders()
    }));

    return {
      message: response?.message || 'Wochenroute wurde aktualisiert.',
      template: this.normalizeRoute(response?.template),
    };
  }

  async deleteTemplate(templateId: number): Promise<{ message: string }> {
    const response = await firstValueFrom(this.http.delete<any>(`${this.authService.apiURL}admin/weekly-route-plan/templates/${templateId}`, {
      headers: await this.buildHeaders()
    }));

    return {
      message: response?.message || 'Wochenroute wurde gelöscht.',
    };
  }

  async saveOverride(templateId: number, date: string, payload: WeeklyRouteOverridePayload): Promise<{ message: string; override: DailyRoutePlanRoute }> {
    const response = await firstValueFrom(this.http.put<any>(`${this.authService.apiURL}admin/weekly-route-plan/templates/${templateId}/overrides/${date}`, payload, {
      headers: await this.buildHeaders()
    }));

    return {
      message: response?.message || 'Wochenänderung wurde gespeichert.',
      override: this.normalizeRoute(response?.override),
    };
  }

  async deleteOverride(templateId: number, date: string): Promise<{ message: string }> {
    const response = await firstValueFrom(this.http.delete<any>(`${this.authService.apiURL}admin/weekly-route-plan/templates/${templateId}/overrides/${date}`, {
      headers: await this.buildHeaders()
    }));

    return {
      message: response?.message || 'Wochenänderung wurde entfernt.',
    };
  }

  isMissingResponsibleAssignmentError(error: any): error is { error: MissingResponsibleAssignmentResponse; status: number } {
    return error?.status === 409 && error?.error?.code === 'missing_responsible_employee_assignment';
  }

  private async buildHeaders(): Promise<HttpHeaders> {
    const token = await this.authService.loadAuthToken();

    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  private normalizeWeek(week: any): DailyRoutePlanWeek {
    return {
      startDate: week?.start_date ?? '',
      endDate: week?.end_date ?? '',
      label: week?.label ?? '',
      days: (week?.days ?? []).map((day: any) => this.normalizeDay(day)),
    };
  }

  private normalizeDay(day: any): DailyRoutePlanDay {
    return {
      date: day?.date ?? '',
      label: day?.label ?? '',
      weekday: Number(day?.weekday ?? 1),
      weekdayLabel: day?.weekday_label ?? '',
      routes: (day?.routes ?? []).map((route: any) => this.normalizeRoute(route)),
    };
  }

  private normalizeRoute(route: any): DailyRoutePlanRoute {
    return {
      id: route?.id ?? 0,
      templateId: route?.template_id ?? route?.id ?? 0,
      overrideId: route?.override_id ?? null,
      scope: route?.scope === 'override' ? 'override' : 'template',
      routeName: route?.route_name ?? '',
      routeDate: route?.route_date ?? null,
      weekday: Number(route?.weekday ?? 1),
      weekdayLabel: route?.weekday_label ?? '',
      shiftStartTime: route?.shift_start_time ?? null,
      startAddress: route?.start_address ?? null,
      endAddress: route?.end_address ?? null,
      totalTravelMinutes: Number(route?.total_travel_minutes ?? 0),
      totalServiceMinutes: Number(route?.total_service_minutes ?? 0),
      totalDistanceMeters: Number(route?.total_distance_meters ?? 0),
      routeGeometry: (route?.route_geometry ?? []).map((point: any) => ({
        lat: Number(point?.lat ?? 0),
        lng: Number(point?.lng ?? 0),
      })),
      summary: route?.summary ?? {},
      employee: route?.employee ? {
        id: route.employee.id ?? 0,
        name: route.employee.name ?? '',
        email: route.employee.email ?? '',
      } : null,
      planner: route?.planner ? {
        id: route.planner.id ?? 0,
        name: route.planner.name ?? '',
        email: route.planner.email ?? '',
      } : null,
      stops: (route?.stops ?? []).map((stop: any) => this.normalizeStop(stop)),
      createdAt: route?.created_at ?? '',
      updatedAt: route?.updated_at ?? '',
      hasOverride: !!route?.has_override || route?.scope === 'override',
    };
  }

  private normalizeStop(stop: any): DailyRouteStop {
    return {
      id: stop?.id ?? 0,
      patientId: stop?.patient_id ?? null,
      stopOrder: stop?.stop_order ?? 0,
      patientName: stop?.patient_name ?? '',
      patientNumber: stop?.patient_number ?? null,
      addressLine: stop?.address_line ?? '',
      zipCode: stop?.zip_code ?? null,
      city: stop?.city ?? null,
      latitude: Number(stop?.latitude ?? 0),
      longitude: Number(stop?.longitude ?? 0),
      scheduledFor: stop?.scheduled_for ?? null,
      serviceMinutes: Number(stop?.service_minutes ?? 0),
      travelMinutesFromPrevious: Number(stop?.travel_minutes_from_previous ?? 0),
      travelDistanceMeters: Number(stop?.travel_distance_meters ?? 0),
      waitingMinutes: Number(stop?.waiting_minutes ?? 0),
      arrivalTime: stop?.arrival_time ?? null,
      departureTime: stop?.departure_time ?? null,
      fixedTime: !!stop?.fixed_time,
      notes: stop?.notes ?? null,
      meta: stop?.meta ?? {},
    };
  }
}
