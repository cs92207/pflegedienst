import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { DailyRoutePlanDay, DailyRoutePlanRoute, DailyRoutePlanWeek } from '../models/daily-route';
import { PatientListItem } from '../models/patient';
import { User } from '../models/user';
import { AuthService } from '../services/auth.service';
import { CaregiverPatientService } from '../services/caregiver-patient.service';
import { CaregiverRouteService } from '../services/caregiver-route.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: false
})
export class HomePage implements OnInit {

  user: User | null = null;
  week: DailyRoutePlanWeek | null = null;
  latestPatients: PatientListItem[] = [];
  selectedDate = '';
  isLoading = true;
  errorMessage = '';

  constructor(
    private authService: AuthService,
    private caregiverRouteService: CaregiverRouteService,
    private caregiverPatientService: CaregiverPatientService,
    private router: Router,
    private toastController: ToastController
  ) {}

  async ngOnInit() {
    await this.loadDashboard();
  }

  openPrimaryAction() {
    this.router.navigateByUrl(this.authService.getDefaultRoute(this.user));
  }

  get firstName(): string {
    const name = this.user?.name?.trim() || '';
    return name.split(' ')[0] || 'Pfleger';
  }

  get greeting(): string {
    const hour = new Date().getHours();
    if (hour < 11) {
      return 'Guten Morgen';
    }
    if (hour < 17) {
      return 'Guten Tag';
    }
    return 'Guten Abend';
  }

  get weekDays(): DailyRoutePlanDay[] {
    return this.week?.days ?? [];
  }

  get selectedDay(): DailyRoutePlanDay | null {
    return this.weekDays.find((day) => day.date === this.selectedDate) ?? this.weekDays[0] ?? null;
  }

  get selectedRoutes(): DailyRoutePlanRoute[] {
    return this.selectedDay?.routes ?? [];
  }

  get selectedRouteCount(): number {
    return this.selectedRoutes.length;
  }

  get totalWeekRoutes(): number {
    return this.weekDays.reduce((sum, day) => sum + day.routes.length, 0);
  }

  get totalWeekStops(): number {
    return this.weekDays.reduce((sum, day) => sum + day.routes.reduce((routeSum, route) => routeSum + route.stops.length, 0), 0);
  }

  get totalWeekMinutes(): number {
    return this.weekDays.reduce((sum, day) => sum + day.routes.reduce((routeSum, route) => routeSum + route.totalTravelMinutes + route.totalServiceMinutes, 0), 0);
  }

  get totalWeekDurationLabel(): string {
    return this.durationFromMinutes(this.totalWeekMinutes);
  }

  get selectedDayHeadline(): string {
    if (!this.selectedDay) {
      return 'Keine Routen verfügbar';
    }

    return `${this.selectedDay.weekdayLabel}, ${this.formatDateLabel(this.selectedDay.date, { day: '2-digit', month: 'long' })}`;
  }

  get selectedDaySubline(): string {
    if (!this.selectedDay) {
      return 'Sobald Routen zugewiesen sind, erscheinen sie hier.';
    }

    if (!this.selectedRoutes.length) {
      return 'Für diesen Tag wurden dir noch keine Touren zugewiesen.';
    }

    return `${this.selectedRoutes.length} ${this.selectedRoutes.length === 1 ? 'Route' : 'Routen'} mit ${this.selectedRoutes.reduce((sum, route) => sum + route.stops.length, 0)} Pflegekunden.`;
  }

  get latestPatientsPreview(): PatientListItem[] {
    return this.latestPatients.slice(0, 4);
  }

  async navigateDay(step: number): Promise<void> {
    if (!this.selectedDate) {
      return;
    }

    const nextDate = this.addDays(this.parseLocalDate(this.selectedDate), step);
    const nextDateKey = this.toDateKey(nextDate);

    if (this.weekDays.some((day) => day.date === nextDateKey)) {
      this.selectedDate = nextDateKey;
      return;
    }

    await this.loadDashboard(this.toDateKey(this.startOfWeek(nextDate)), nextDateKey);
  }

  async openRoutesOverview(): Promise<void> {
    await this.router.navigate(['/home/routes'], {
      queryParams: this.week?.startDate ? { weekStart: this.week.startDate } : undefined,
    });
  }

  async openPatientsOverview(): Promise<void> {
    await this.router.navigate(['/home/patients']);
  }

  async openPatientDetails(patient: PatientListItem): Promise<void> {
    await this.router.navigate(['/home/patients', patient.id]);
  }

  async showRouteDetailsUnavailable(route: DailyRoutePlanRoute): Promise<void> {
    const toast = await this.toastController.create({
      message: `Details für "${route.routeName || 'diese Route'}" folgen später.`,
      duration: 2200,
      position: 'top',
      color: 'medium'
    });

    await toast.present();
  }

  isToday(date: string): boolean {
    return this.toDateKey(new Date()) === date;
  }

  isSelectedDay(date: string): boolean {
    return this.selectedDate === date;
  }

  routeDurationLabel(route: DailyRoutePlanRoute): string {
    const totalMinutes = route.totalTravelMinutes + route.totalServiceMinutes;
    return this.durationFromMinutes(totalMinutes);
  }

  private durationFromMinutes(totalMinutes: number): string {
    if (!totalMinutes) {
      return 'Ohne Dauer';
    }

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (!hours) {
      return `${minutes} Min`;
    }

    if (!minutes) {
      return `${hours} Std`;
    }

    return `${hours} Std ${minutes} Min`;
  }

  distanceLabel(route: DailyRoutePlanRoute): string {
    if (!route.totalDistanceMeters) {
      return '0 km';
    }

    return `${(route.totalDistanceMeters / 1000).toFixed(1).replace('.', ',')} km`;
  }

  compactTime(value: string | null): string {
    if (!value) {
      return 'Offen';
    }

    return value.slice(0, 5);
  }

  formatDateLabel(date: string, options: Intl.DateTimeFormatOptions): string {
    return new Intl.DateTimeFormat('de-DE', options).format(this.parseLocalDate(date));
  }

  trackDay(_index: number, day: DailyRoutePlanDay): string {
    return day.date;
  }

  trackRoute(_index: number, route: DailyRoutePlanRoute): string {
    return `${route.scope}-${route.id}-${route.routeDate ?? route.weekday}`;
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

  private async loadDashboard(weekStart?: string, preferredDate?: string): Promise<void> {
    this.isLoading = true;
    this.errorMessage = '';

    try {
      const [userResult, weekResult, patientsResult] = await Promise.allSettled([
        this.authService.getCurrentUser(),
        this.caregiverRouteService.getMyWeek(weekStart),
        this.caregiverPatientService.listMyPatients({ limit: 4 })
      ]);

      this.user = userResult.status === 'fulfilled' ? userResult.value : null;
      this.week = weekResult.status === 'fulfilled' ? weekResult.value : { startDate: '', endDate: '', label: '', days: [] };
      this.latestPatients = patientsResult.status === 'fulfilled' ? patientsResult.value : [];

      const errors = [userResult, weekResult, patientsResult]
        .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
        .map((result) => result.reason?.error?.message || result.reason?.message)
        .filter(Boolean);

      if (errors.length) {
        this.errorMessage = errors[0] || 'Das Dashboard konnte nicht vollständig geladen werden.';
      }

      const today = this.toDateKey(new Date());
      const candidateDate = preferredDate && this.week.days.some((day) => day.date === preferredDate)
        ? preferredDate
        : this.week.days.some((day) => day.date === today)
          ? today
          : this.week.days[0]?.date ?? '';

      this.selectedDate = candidateDate;
    } finally {
      this.isLoading = false;
    }
  }

  private parseLocalDate(value: string): Date {
    const [year, month, day] = value.split('-').map((part) => Number(part));
    return new Date(year, (month || 1) - 1, day || 1);
  }

  private toDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private addDays(date: Date, amount: number): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + amount);
    return next;
  }

  private startOfWeek(date: Date): Date {
    const current = new Date(date);
    const weekday = current.getDay();
    const diff = weekday === 0 ? -6 : 1 - weekday;
    current.setDate(current.getDate() + diff);
    return current;
  }

}
