import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import * as L from 'leaflet';
import {
  CreateDailyRouteStopPayload,
  DailyRouteStop,
  DailyRoutePlanDay,
  DailyRoutePlanRoute,
  WeeklyRouteOverridePayload,
  WeeklyRouteTemplatePayload,
} from '../../models/daily-route';
import { PatientListItem } from '../../models/patient';
import { User } from '../../models/user';
import { AdminDailyRouteService } from '../../services/admin-daily-route.service';
import { AdminAccountService } from '../../services/admin-account.service';
import { AdminPatientService } from '../../services/admin-patient.service';
import { LoadingService } from '../../services/loading.service';
import { PopupService } from '../../services/popup.service';

interface RouteStopDraft {
  patientId: number;
  serviceMinutes: number;
  fixedTime: string;
  notes: string;
}

type PlannerMode = 'create-template' | 'edit-template' | 'edit-override';
type PlanView = 'week-plan' | 'duty-plan';

interface WeekdayOption {
  value: number;
  label: string;
}

interface RefreshPlanOptions {
  preserveSelection?: boolean;
  preferredDate?: string;
  preferredWeekday?: number;
  preferredTemplateId?: number;
  preferredOverrideId?: number | null;
}

interface WeekdayTemplateGroup {
  weekday: number;
  label: string;
  routes: DailyRoutePlanRoute[];
}

interface RouteDetailLine {
  label: string;
  title: string;
  meta?: string;
}

@Component({
  selector: 'app-daily-routes',
  templateUrl: './daily-routes.page.html',
  styleUrls: ['./daily-routes.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
})
export class DailyRoutesPage implements OnInit {
  readonly weekdays: WeekdayOption[] = [
    { value: 1, label: 'Montag' },
    { value: 2, label: 'Dienstag' },
    { value: 3, label: 'Mittwoch' },
    { value: 4, label: 'Donnerstag' },
    { value: 5, label: 'Freitag' },
    { value: 6, label: 'Samstag' },
    { value: 7, label: 'Sonntag' },
  ];
  readonly weekDaySkeletons = Array.from({ length: 7 }, (_, index) => index);
  readonly routeSkeletons = Array.from({ length: 3 }, (_, index) => index);
  readonly templateColumnSkeletons = Array.from({ length: 6 }, (_, index) => index);
  readonly plannerFieldSkeletons = Array.from({ length: 6 }, (_, index) => index);
  readonly patientSkeletons = Array.from({ length: 4 }, (_, index) => index);

  employees: User[] = [];
  patients: PatientListItem[] = [];
  templates: DailyRoutePlanRoute[] = [];
  templateGroups: WeekdayTemplateGroup[] = [];
  weekDays: DailyRoutePlanDay[] = [];
  weekLabel = '';
  selectedWeekStart = '';
  selectedDate = '';
  selectedRouteKey = '';
  activePlanView: PlanView = 'week-plan';

  plannerMode: PlannerMode = 'create-template';
  editingTemplateId: number | null = null;
  plannerWeekday = 1;
  routeName = '';
  employeeId: number | null = null;
  shiftStartTime = '08:00';
  startAddress = '';
  endAddress = '';
  patientSearchTerm = '';
  stopDrafts: Record<number, RouteStopDraft> = {};
  isReferenceDataLoading = false;
  isPlanLoading = false;
  isRouteDetailsOpen = false;
  routeDetailsRoute: DailyRoutePlanRoute | null = null;

  @ViewChild('routeDetailMap') private routeDetailMapElement?: ElementRef<HTMLDivElement>;

  private routeDetailMap?: L.Map;
  private routeDetailMapLayers?: L.FeatureGroup;

  constructor(
    private adminDailyRouteService: AdminDailyRouteService,
    private adminAccountService: AdminAccountService,
    private adminPatientService: AdminPatientService,
    private loadingService: LoadingService,
    private popupService: PopupService,
  ) {}

  async ngOnInit() {
    await Promise.all([
      this.loadPlannerData(),
      this.refreshPlan(),
    ]);
  }

  get selectedDay(): DailyRoutePlanDay | null {
    return this.weekDays.find((day) => day.date === this.selectedDate) ?? null;
  }

  get selectedDayRoutes(): DailyRoutePlanRoute[] {
    return this.selectedDay?.routes ?? [];
  }

  get selectedRoute(): DailyRoutePlanRoute | null {
    return this.selectedDayRoutes.find((route) => this.routeKey(route) === this.selectedRouteKey) ?? this.selectedDayRoutes[0] ?? null;
  }

  get filteredPatients(): PatientListItem[] {
    const term = this.patientSearchTerm.trim().toLowerCase();

    if (!term) {
      return this.patients;
    }

    return this.patients.filter((patient) => {
      const haystack = [
        patient.firstName,
        patient.lastName,
        patient.patientNumber,
        this.formatPatientAddress(patient),
      ].join(' ').toLowerCase();

      return haystack.includes(term);
    });
  }

  get selectedPatientCount(): number {
    return Object.keys(this.stopDrafts).length;
  }

  get isPlannerLoading(): boolean {
    return this.isReferenceDataLoading;
  }

  get plannerTitle(): string {
    switch (this.plannerMode) {
      case 'edit-template':
        return 'Langfristigen Dienstplan bearbeiten';
      case 'edit-override':
        return 'Einmalige Wochenänderung bearbeiten';
      default:
        return 'Neue feste Route erstellen';
    }
  }

  get plannerDescription(): string {
    switch (this.plannerMode) {
      case 'edit-template':
        return 'Diese Änderungen gelten für alle kommenden Wochen, bis du den langfristigen Dienstplan erneut anpasst.';
      case 'edit-override':
        return 'Diese Änderung gilt nur für das ausgewählte Datum. Danach greift wieder der langfristige Dienstplan.';
      default:
        return 'Lege fest, welche Route an diesem Wochentag dauerhaft gefahren wird und welcher Pfleger sie übernimmt.';
    }
  }

  get plannerActionLabel(): string {
    switch (this.plannerMode) {
      case 'edit-template':
        return 'Dienstplan speichern';
      case 'edit-override':
        return 'Einmalige Änderung speichern';
      default:
        return 'Feste Route speichern';
    }
  }

  get activeViewTitle(): string {
    return this.activePlanView === 'week-plan' ? 'Wochenplan' : 'Dienstplan';
  }

  get activeViewDescription(): string {
    if (this.activePlanView === 'week-plan') {
      return 'Hier siehst du die aktuelle Woche, die Routen pro Tag und kannst einmalige Änderungen für einzelne Daten vornehmen.';
    }

    return 'Hier pflegst du den langfristigen Dienstplan mit den dauerhaft geplanten Routen von Montag bis Sonntag.';
  }

  get selectedDayLabel(): string {
    return this.selectedDay?.label ?? '';
  }

  get plannerBadgeLabel(): string {
    if (this.plannerMode === 'edit-override') {
      return this.selectedDayLabel || 'Einmalige Änderung';
    }

    return this.weekdays.find((weekday) => weekday.value === this.plannerWeekday)?.label || 'Wochenroute';
  }

  get totalPlannedRoutes(): number {
    return this.weekDays.reduce((sum, day) => sum + day.routes.length, 0);
  }

  async previousWeek() {
    const preferredWeekday = this.selectedDay?.weekday ?? this.plannerWeekday;
    this.selectedWeekStart = this.shiftDate(this.selectedWeekStart, -7);
    await this.refreshPlan({ preserveSelection: true, preferredWeekday });
  }

  async nextWeek() {
    const preferredWeekday = this.selectedDay?.weekday ?? this.plannerWeekday;
    this.selectedWeekStart = this.shiftDate(this.selectedWeekStart, 7);
    await this.refreshPlan({ preserveSelection: true, preferredWeekday });
  }

  selectDay(day: DailyRoutePlanDay) {
    this.selectedDate = day.date;
    if (!this.selectedDayRoutes.some((route) => this.routeKey(route) === this.selectedRouteKey)) {
      this.selectedRouteKey = this.selectedDayRoutes[0] ? this.routeKey(this.selectedDayRoutes[0]) : '';
    }
    if (this.plannerMode === 'create-template') {
      this.plannerWeekday = day.weekday;
    }
  }

  selectRoute(route: DailyRoutePlanRoute) {
    this.selectedRouteKey = this.routeKey(route);
  }

  switchPlanView(view: PlanView) {
    this.activePlanView = view;

    if (view === 'duty-plan' && this.plannerMode === 'edit-override') {
      this.prepareTemplatePlanner(this.selectedDay?.weekday ?? this.plannerWeekday);
    }
  }

  startCreateTemplate(weekday = this.selectedDay?.weekday ?? this.plannerWeekday) {
    this.activePlanView = 'duty-plan';
    this.prepareTemplatePlanner(weekday);
  }

  editTemplate(route: DailyRoutePlanRoute) {
    this.activePlanView = 'duty-plan';
    this.plannerMode = 'edit-template';
    this.editingTemplateId = route.templateId;
    this.applyRouteToPlanner(route);
  }

  editOverride(route: DailyRoutePlanRoute) {
    this.activePlanView = 'week-plan';
    this.plannerMode = 'edit-override';
    this.editingTemplateId = route.templateId;
    this.selectedDate = route.routeDate || this.selectedDate;
    this.selectedRouteKey = this.routeKey(route);
    this.applyRouteToPlanner(route);
  }

  openRouteDetails(route: DailyRoutePlanRoute, event?: Event) {
    event?.stopPropagation();
    this.routeDetailsRoute = route;
    this.isRouteDetailsOpen = true;
  }

  closeRouteDetails() {
    this.isRouteDetailsOpen = false;
  }

  onRouteDetailsDidPresent() {
    window.setTimeout(() => this.renderRouteDetailMap(), 60);
  }

  onRouteDetailsDidDismiss() {
    this.destroyRouteDetailMap();
    this.routeDetailsRoute = null;
    this.isRouteDetailsOpen = false;
  }

  async deleteTemplate(route: DailyRoutePlanRoute, event?: Event) {
    event?.stopPropagation();

    const confirmed = await this.popupService.showConfirm(
      `Die globale Wochenroute "${route.routeName}" wird vollständig gelöscht.`,
      'Wochenroute löschen',
      'Löschen',
      'Abbrechen'
    );

    if (!confirmed) {
      return;
    }

    await this.loadingService.showPopup('Wochenroute wird gelöscht...');

    try {
      const response = await this.adminDailyRouteService.deleteTemplate(route.templateId);
      this.popupService.showSuccess(response.message);
      await this.refreshPlan({ preserveSelection: true });
      if (this.editingTemplateId === route.templateId) {
        this.startCreateTemplate(route.weekday);
      }
    } catch (error: any) {
      this.popupService.showAlert(error?.error?.message || 'Wochenroute konnte nicht gelöscht werden.');
    } finally {
      await this.loadingService.closePopup();
    }
  }

  async resetOverride(route: DailyRoutePlanRoute, event?: Event) {
    event?.stopPropagation();

    if (!route.routeDate) {
      return;
    }

    const confirmed = await this.popupService.showConfirm(
      `Die einmalige Änderung für ${this.formatDate(route.routeDate)} wird entfernt und der globale Wochenplan gilt wieder.`,
      'Einmalige Änderung zurücksetzen',
      'Zurücksetzen',
      'Abbrechen'
    );

    if (!confirmed) {
      return;
    }

    await this.loadingService.showPopup('Einmalige Änderung wird entfernt...');

    try {
      const response = await this.adminDailyRouteService.deleteOverride(route.templateId, route.routeDate);
      this.popupService.showSuccess(response.message);
      await this.refreshPlan({ preserveSelection: true });
      if (this.plannerMode === 'edit-override' && this.editingTemplateId === route.templateId) {
        const template = this.templates.find((item) => item.templateId === route.templateId);
        if (template) {
          this.editTemplate(template);
        } else {
          this.startCreateTemplate(route.weekday);
        }
      }
    } catch (error: any) {
      this.popupService.showAlert(error?.error?.message || 'Einmalige Änderung konnte nicht entfernt werden.');
    } finally {
      await this.loadingService.closePopup();
    }
  }

  isSelected(patientId: number): boolean {
    return !!this.stopDrafts[patientId];
  }

  togglePatient(patient: PatientListItem) {
    if (!this.hasCompleteAddress(patient)) {
      return;
    }

    if (this.isSelected(patient.id)) {
      delete this.stopDrafts[patient.id];
      return;
    }

    this.stopDrafts[patient.id] = {
      patientId: patient.id,
      serviceMinutes: 30,
      fixedTime: '',
      notes: '',
    };
  }

  async savePlanner() {
    await this.savePlannerInternal(false);
  }

  private async savePlannerInternal(autoAssignResponsibleEmployee: boolean) {
    if (!this.employeeId) {
      this.popupService.showAlert('Bitte zuerst einen Pfleger auswählen.');
      return;
    }

    const stops = Object.values(this.stopDrafts);
    if (!stops.length) {
      this.popupService.showAlert('Bitte mindestens einen Pflegekunden auswählen.');
      return;
    }

    await this.loadingService.showPopup('Dienstplan wird gespeichert...');
    let suppressErrorAlert = false;

    try {
      if (this.plannerMode === 'edit-override') {
        if (!this.editingTemplateId || !this.selectedDate) {
          throw new Error('Für die einmalige Änderung fehlt die Template- oder Datumszuordnung.');
        }

        const payload: WeeklyRouteOverridePayload = {
          ...this.buildCommonPayload(),
          auto_assign_responsible_employee: autoAssignResponsibleEmployee,
        };
        const response = await this.adminDailyRouteService.saveOverride(this.editingTemplateId, this.selectedDate, payload);
        this.popupService.showSuccess(response.message);
        await this.refreshPlan({
          preserveSelection: true,
          preferredDate: response.override.routeDate || this.selectedDate,
          preferredTemplateId: response.override.templateId,
          preferredOverrideId: response.override.overrideId,
        });
        return;
      }

      const payload: WeeklyRouteTemplatePayload = {
        weekday: this.plannerWeekday,
        ...this.buildCommonPayload(),
        auto_assign_responsible_employee: autoAssignResponsibleEmployee,
      };

      if (this.plannerMode === 'edit-template' && this.editingTemplateId) {
        const response = await this.adminDailyRouteService.updateTemplate(this.editingTemplateId, payload);
        this.popupService.showSuccess(response.message);
        await this.refreshPlan({
          preserveSelection: true,
          preferredWeekday: response.template.weekday,
          preferredTemplateId: response.template.templateId,
        });
      } else {
        const response = await this.adminDailyRouteService.createTemplate(payload);
        this.popupService.showSuccess(response.message);
        await this.refreshPlan({
          preserveSelection: true,
          preferredWeekday: response.template.weekday,
          preferredTemplateId: response.template.templateId,
        });
      }
    } catch (error: any) {
      if (!autoAssignResponsibleEmployee && this.adminDailyRouteService.isMissingResponsibleAssignmentError(error)) {
        suppressErrorAlert = true;
        await this.loadingService.closePopup();
        const employee = error.error.employee;
        const patientNames = error.error.patients.map((patient: any) => patient.full_name).join(', ');
        const confirmed = await this.popupService.showConfirm(
          `${employee.name} ist bei folgenden Pflegekunden noch nicht als zuständig eingetragen: ${patientNames}. Möchtest du den Pfleger automatisch bei diesen Pflegekunden ergänzen und die Route danach speichern?`,
          'Zuständige Pfleger ergänzen',
          'Automatisch ergänzen',
          'Abbrechen'
        );

        if (confirmed) {
          await this.savePlannerInternal(true);
          return;
        }

        return;
      }

      if (!suppressErrorAlert) {
        this.popupService.showAlert(error?.error?.message || error?.message || 'Dienstplan konnte nicht gespeichert werden.');
      }
    } finally {
      await this.loadingService.closePopup();
    }
  }

  formatDate(date: string): string {
    return new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(date));
  }

  formatShortDate(date: string): string {
    return new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: '2-digit',
    }).format(new Date(date));
  }

  formatDistance(meters: number): string {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
    }

    return `${Math.round(meters)} m`;
  }

  formatRouteDuration(minutes: number): string {
    if (!minutes) {
      return '0 Min';
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (!hours) {
      return `${remainingMinutes} Min`;
    }

    if (!remainingMinutes) {
      return `${hours} Std`;
    }

    return `${hours} Std ${remainingMinutes} Min`;
  }

  getRouteDetailTitle(route: DailyRoutePlanRoute): string {
    return this.getRouteDisplayName(route, route.weekdayLabel);
  }

  getRouteDetailDateLabel(route: DailyRoutePlanRoute): string {
    if (route.routeDate) {
      return `${route.weekdayLabel} · ${this.formatDate(route.routeDate)}`;
    }

    return route.weekdayLabel;
  }

  getRouteScopeLabel(route: DailyRoutePlanRoute): string {
    return route.scope === 'override' ? 'Einmalige Änderung' : 'Langfristiger Dienstplan';
  }

  getRouteDetailLines(route: DailyRoutePlanRoute): RouteDetailLine[] {
    const lines: RouteDetailLine[] = [
      {
        label: 'Start',
        title: route.startAddress || 'Kein separater Startpunkt hinterlegt',
        meta: route.shiftStartTime ? `Ab ${route.shiftStartTime}` : undefined,
      },
    ];

    route.stops.forEach((stop, index) => {
      lines.push({
        label: `Stopp ${index + 1}`,
        title: stop.patientName,
        meta: [stop.addressLine, stop.arrivalTime && stop.departureTime ? `${stop.arrivalTime} - ${stop.departureTime}` : null]
          .filter(Boolean)
          .join(' · '),
      });
    });

    lines.push({
      label: 'Ende',
      title: route.endAddress || 'Kein separater Zielpunkt hinterlegt',
      meta: route.summary.end_time ? `Ankunft ${route.summary.end_time}` : undefined,
    });

    return lines;
  }

  getTravelLabel(stop: DailyRouteStop): string {
    const parts: string[] = [];

    if (stop.travelMinutesFromPrevious) {
      parts.push(`${stop.travelMinutesFromPrevious} Min Anfahrt`);
    }

    if (stop.travelDistanceMeters) {
      parts.push(this.formatDistance(stop.travelDistanceMeters));
    }

    if (stop.waitingMinutes) {
      parts.push(`${stop.waitingMinutes} Min Wartezeit`);
    }

    return parts.join(' · ') || 'Direkter Start';
  }

  hasMapPreview(route: DailyRoutePlanRoute): boolean {
    return route.routeGeometry.length > 1 || route.stops.length > 0;
  }

  formatPatientAddress(patient: PatientListItem): string {
    return [
      [patient.street, patient.houseNumber].filter(Boolean).join(' ').trim(),
      [patient.zipCode, patient.city].filter(Boolean).join(' ').trim(),
    ].filter(Boolean).join(', ');
  }

  hasCompleteAddress(patient: PatientListItem): boolean {
    return !!patient.street && !!patient.houseNumber && !!patient.zipCode && !!patient.city;
  }

  trackByDay(_index: number, day: DailyRoutePlanDay): string {
    return day.date;
  }

  trackByRoute = (_index: number, route: DailyRoutePlanRoute): string => this.routeKey(route);

  trackByPatientId(_index: number, patient: PatientListItem): number {
    return patient.id;
  }

  getRouteDisplayName(route: DailyRoutePlanRoute, weekdayLabel?: string): string {
    const trimmedName = route.routeName?.trim();

    if (trimmedName) {
      return trimmedName;
    }

    const employeeName = route.employee?.name?.trim();
    if (employeeName && weekdayLabel) {
      return `${weekdayLabel} · ${employeeName}`;
    }

    if (employeeName) {
      return employeeName;
    }

    return weekdayLabel ? `${weekdayLabel} Route` : 'Unbenannte Route';
  }

  private async loadPlannerData() {
    this.isReferenceDataLoading = true;

    try {
      const [accounts, patients] = await Promise.all([
        this.adminAccountService.listAccounts(),
        this.adminPatientService.listPatients(),
      ]);

      this.employees = accounts;
      this.patients = patients;

      if (!this.employeeId && this.employees[0]) {
        this.employeeId = this.employees[0].id;
      }
    } finally {
      this.isReferenceDataLoading = false;
    }
  }

  private async refreshPlan(options: RefreshPlanOptions = {}) {
    const {
      preserveSelection = false,
      preferredDate,
      preferredWeekday,
      preferredTemplateId,
      preferredOverrideId,
    } = options;

    this.isPlanLoading = true;

    try {
      const response = await this.adminDailyRouteService.getPlan(this.selectedWeekStart || undefined);
      this.templates = (response.templates ?? [])
        .map((route) => this.normalizeRouteRecord(route))
        .filter((route): route is DailyRoutePlanRoute => !!route);
      this.templateGroups = this.buildTemplateGroups(this.templates);
      this.weekDays = response.week.days.map((day) => ({
        ...day,
        routes: (day.routes ?? [])
          .map((route) => this.normalizeRouteRecord(route, day.weekdayLabel))
          .filter((route): route is DailyRoutePlanRoute => !!route),
      }));
      this.weekLabel = response.week.label;
      this.selectedWeekStart = response.week.startDate;

      const resolvedPreferredDate = preferredDate
        || this.findDateForWeekday(preferredWeekday)
        || (preserveSelection
        ? this.selectedDate
        : this.pickInitialDate(response.week.days.map((day) => day.date)));

      this.selectedDate = this.weekDays.some((day) => day.date === resolvedPreferredDate)
        ? resolvedPreferredDate
        : this.weekDays[0]?.date ?? '';

      const currentRoutes = this.selectedDayRoutes;
      const preferredRoute = currentRoutes.find((route) => {
        if (preferredOverrideId && route.overrideId === preferredOverrideId) {
          return true;
        }

        return preferredTemplateId ? route.templateId === preferredTemplateId : false;
      });

      if (preferredRoute) {
        this.selectedRouteKey = this.routeKey(preferredRoute);
      } else if (!currentRoutes.some((route) => this.routeKey(route) === this.selectedRouteKey)) {
        this.selectedRouteKey = currentRoutes[0] ? this.routeKey(currentRoutes[0]) : '';
      }

      if (!preserveSelection && this.plannerMode === 'create-template' && this.selectedDay) {
        this.plannerWeekday = this.selectedDay.weekday;
      }
    } catch (error: any) {
      this.templates = [];
      this.templateGroups = this.buildTemplateGroups([]);
      this.weekDays = [];
      this.weekLabel = '';
      this.popupService.showAlert(error?.error?.message || 'Dienstplan konnte nicht geladen werden.');
    } finally {
      this.isPlanLoading = false;
    }
  }

  private syncSelectedDateToWeekday(weekday: number) {
    const matchingDay = this.weekDays.find((day) => day.weekday === weekday);
    if (matchingDay) {
      this.selectedDate = matchingDay.date;
    }
  }

  private findDateForWeekday(weekday?: number): string {
    if (!weekday) {
      return '';
    }

    return this.weekDays.find((day) => day.weekday === weekday)?.date ?? '';
  }

  private buildTemplateGroups(routes: DailyRoutePlanRoute[]): WeekdayTemplateGroup[] {
    return this.weekdays.map((weekday) => ({
      weekday: weekday.value,
      label: weekday.label,
      routes: routes.filter((route) => route.weekday === weekday.value),
    }));
  }

  private normalizeRouteRecord(route: Partial<DailyRoutePlanRoute> | null | undefined, weekdayLabel?: string): DailyRoutePlanRoute | null {
    if (!route) {
      return null;
    }

    const templateId = Number(route.templateId ?? route.id ?? 0);
    if (!templateId) {
      return null;
    }

    return {
      ...route,
      id: Number(route.id ?? templateId),
      templateId,
      overrideId: route.overrideId ?? null,
      scope: route.scope === 'override' ? 'override' : 'template',
      routeName: route.routeName ?? '',
      routeDate: route.routeDate ?? null,
      weekday: Number(route.weekday ?? 1),
      weekdayLabel: route.weekdayLabel || weekdayLabel || this.weekdayLabel(Number(route.weekday ?? 1)),
      shiftStartTime: route.shiftStartTime ?? null,
      startAddress: route.startAddress ?? null,
      endAddress: route.endAddress ?? null,
      totalTravelMinutes: Number(route.totalTravelMinutes ?? 0),
      totalServiceMinutes: Number(route.totalServiceMinutes ?? 0),
      totalDistanceMeters: Number(route.totalDistanceMeters ?? 0),
      routeGeometry: Array.isArray(route.routeGeometry) ? route.routeGeometry : [],
      stops: Array.isArray(route.stops) ? route.stops : [],
      summary: route.summary ?? {},
      employee: route.employee ?? null,
      planner: route.planner ?? null,
      createdAt: route.createdAt ?? '',
      updatedAt: route.updatedAt ?? '',
      hasOverride: !!route.hasOverride,
    };
  }

  private weekdayLabel(weekday: number): string {
    return this.weekdays.find((item) => item.value === weekday)?.label ?? '';
  }

  private prepareTemplatePlanner(weekday: number) {
    this.plannerMode = 'create-template';
    this.editingTemplateId = null;
    this.plannerWeekday = weekday;
    this.syncSelectedDateToWeekday(weekday);
    this.selectedRouteKey = '';
    this.routeName = '';
    this.shiftStartTime = '08:00';
    this.startAddress = '';
    this.endAddress = '';
    this.patientSearchTerm = '';
    this.stopDrafts = {};

    if (!this.employeeId && this.employees[0]) {
      this.employeeId = this.employees[0].id;
    }
  }

  private applyRouteToPlanner(route: DailyRoutePlanRoute) {
    this.plannerWeekday = route.weekday;
    this.routeName = route.routeName;
    this.employeeId = route.employee?.id ?? this.employeeId;
    this.shiftStartTime = route.shiftStartTime || '08:00';
    this.startAddress = route.startAddress || '';
    this.endAddress = route.endAddress || '';
    this.patientSearchTerm = '';
    this.stopDrafts = route.stops.reduce<Record<number, RouteStopDraft>>((drafts, stop) => {
      if (stop.patientId === null) {
        return drafts;
      }

      drafts[stop.patientId] = {
        patientId: stop.patientId,
        serviceMinutes: stop.serviceMinutes,
        fixedTime: stop.scheduledFor || '',
        notes: stop.notes || '',
      };

      return drafts;
    }, {});
  }

  private buildCommonPayload(): Omit<WeeklyRouteTemplatePayload, 'weekday'> {
    const stops: CreateDailyRouteStopPayload[] = Object.values(this.stopDrafts).map((stop) => ({
      patient_id: stop.patientId,
      service_minutes: Number(stop.serviceMinutes),
      fixed_time: stop.fixedTime || null,
      notes: stop.notes.trim() || null,
    }));

    return {
      route_name: this.routeName.trim() || null,
      employee_id: this.employeeId!,
      shift_start_time: this.shiftStartTime || null,
      start_address: this.startAddress.trim() || null,
      end_address: this.endAddress.trim() || null,
      stops,
    };
  }

  routeKey(route: DailyRoutePlanRoute): string {
    return `${route.templateId}-${route.routeDate || route.weekday}-${route.overrideId || 'base'}`;
  }

  private pickInitialDate(dates: string[]): string {
    const today = this.toDateKey(new Date());
    return dates.includes(today) ? today : (dates[0] || today);
  }

  private shiftDate(date: string, amount: number): string {
    const base = this.resolveBaseDate(date);
    base.setDate(base.getDate() + amount);
    return this.toDateKey(base);
  }

  private resolveBaseDate(date: string): Date {
    const parsed = date ? this.parseDateKey(date) : new Date();

    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }

    return new Date();
  }

  private parseDateKey(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);

    if (!year || !month || !day) {
      return new Date(value);
    }

    return new Date(year, month - 1, day);
  }

  private toDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  private renderRouteDetailMap() {
    const route = this.routeDetailsRoute;
    const mapHost = this.routeDetailMapElement?.nativeElement;

    if (!route || !mapHost || !this.hasMapPreview(route)) {
      return;
    }

    if (!this.routeDetailMap) {
      this.routeDetailMap = L.map(mapHost, {
        zoomControl: true,
        attributionControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap-Mitwirkende',
      }).addTo(this.routeDetailMap);
    }

    if (this.routeDetailMapLayers) {
      this.routeDetailMapLayers.remove();
    }

    const layers: L.Layer[] = [];
    const boundsPoints: L.LatLngTuple[] = [];
    const geometryPoints = route.routeGeometry
      .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng))
      .map((point) => [point.lat, point.lng] as L.LatLngTuple);

    if (geometryPoints.length > 1) {
      layers.push(L.polyline(geometryPoints, {
        color: '#0f766e',
        weight: 5,
        opacity: 0.86,
      }));
      boundsPoints.push(...geometryPoints);
    }

    route.stops.forEach((stop, index) => {
      if (!Number.isFinite(stop.latitude) || !Number.isFinite(stop.longitude)) {
        return;
      }

      const point: L.LatLngTuple = [stop.latitude, stop.longitude];
      boundsPoints.push(point);
      layers.push(
        L.circleMarker(point, {
          radius: 10,
          color: '#ffffff',
          weight: 3,
          fillColor: '#0f766e',
          fillOpacity: 1,
        }).bindPopup(`<strong>${index + 1}. ${stop.patientName}</strong><br>${stop.addressLine}<br>${stop.arrivalTime || '--:--'} - ${stop.departureTime || '--:--'}`)
      );
    });

    if (!boundsPoints.length && geometryPoints.length) {
      boundsPoints.push(...geometryPoints);
    }

    this.routeDetailMapLayers = L.featureGroup(layers).addTo(this.routeDetailMap);

    if (boundsPoints.length === 1) {
      this.routeDetailMap.setView(boundsPoints[0], 14);
    } else if (boundsPoints.length > 1) {
      this.routeDetailMap.fitBounds(L.latLngBounds(boundsPoints), { padding: [28, 28] });
    }

    this.routeDetailMap.invalidateSize();
  }

  private destroyRouteDetailMap() {
    if (this.routeDetailMap) {
      this.routeDetailMap.remove();
      this.routeDetailMap = undefined;
    }

    this.routeDetailMapLayers = undefined;
  }
}
