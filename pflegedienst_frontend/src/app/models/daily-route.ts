export interface DailyRouteEmployee {
  id: number;
  name: string;
  email: string;
}

export interface DailyRouteStop {
  id: number;
  patientId: number | null;
  stopOrder: number;
  patientName: string;
  patientNumber: string | null;
  addressLine: string;
  zipCode: string | null;
  city: string | null;
  latitude: number;
  longitude: number;
  scheduledFor: string | null;
  serviceMinutes: number;
  travelMinutesFromPrevious: number;
  travelDistanceMeters: number;
  waitingMinutes: number;
  arrivalTime: string | null;
  departureTime: string | null;
  fixedTime: boolean;
  notes: string | null;
  meta: {
    lateness_minutes?: number;
  };
}

export interface DailyRoutePlanRoute {
  id: number;
  templateId: number;
  overrideId: number | null;
  scope: 'template' | 'override';
  routeName: string;
  routeDate: string | null;
  weekday: number;
  weekdayLabel: string;
  shiftStartTime: string | null;
  startAddress: string | null;
  endAddress: string | null;
  totalTravelMinutes: number;
  totalServiceMinutes: number;
  totalDistanceMeters: number;
  routeGeometry: Array<{ lat: number; lng: number }>;
  summary: {
    warnings?: string[];
    used_estimated_travel_data?: boolean;
    final_leg?: {
      travel_minutes: number;
      distance_meters: number;
      arrival_time: string;
    };
    end_time?: string;
  };
  employee: DailyRouteEmployee | null;
  planner: DailyRouteEmployee | null;
  stops: DailyRouteStop[];
  createdAt: string;
  updatedAt: string;
  hasOverride: boolean;
}

export interface DailyRoutePlanDay {
  date: string;
  label: string;
  weekday: number;
  weekdayLabel: string;
  routes: DailyRoutePlanRoute[];
}

export interface DailyRoutePlanWeek {
  startDate: string;
  endDate: string;
  label: string;
  days: DailyRoutePlanDay[];
}

export interface DailyRoutePlanResponse {
  templates: DailyRoutePlanRoute[];
  week: DailyRoutePlanWeek;
}

export interface CreateDailyRouteStopPayload {
  patient_id: number;
  service_minutes: number;
  fixed_time?: string | null;
  notes?: string | null;
}

export interface WeeklyRouteTemplatePayload {
  weekday: number;
  route_name?: string | null;
  employee_id: number;
  shift_start_time?: string | null;
  start_address?: string | null;
  end_address?: string | null;
  auto_assign_responsible_employee?: boolean;
  stops: CreateDailyRouteStopPayload[];
}

export interface WeeklyRouteOverridePayload {
  route_name?: string | null;
  employee_id: number;
  shift_start_time?: string | null;
  start_address?: string | null;
  end_address?: string | null;
  auto_assign_responsible_employee?: boolean;
  stops: CreateDailyRouteStopPayload[];
}

export interface MissingResponsibleAssignmentResponse {
  code: 'missing_responsible_employee_assignment';
  message: string;
  employee: DailyRouteEmployee;
  patients: Array<{
    id: number;
    patient_number: string;
    full_name: string;
  }>;
}
