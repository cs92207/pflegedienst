import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DailyRoutePlanDay, DailyRoutePlanRoute, DailyRoutePlanWeek } from '../../models/daily-route';
import { CaregiverRouteService } from '../../services/caregiver-route.service';

@Component({
  selector: 'app-routes-overview',
  templateUrl: './routes-overview.page.html',
  styleUrls: ['./routes-overview.page.scss'],
  standalone: false
})
export class RoutesOverviewPage implements OnInit {

  week: DailyRoutePlanWeek | null = null;
  isLoading = true;
  isWeekSwitching = false;
  errorMessage = '';

  constructor(
    private activatedRoute: ActivatedRoute,
    private caregiverRouteService: CaregiverRouteService,
    private router: Router,
  ) {}

  async ngOnInit(): Promise<void> {
    const weekStart = this.activatedRoute.snapshot.queryParamMap.get('weekStart') || undefined;
    await this.loadWeek(weekStart, true);
  }

  get weekDays(): DailyRoutePlanDay[] {
    return this.week?.days ?? [];
  }

  get totalRoutes(): number {
    return this.weekDays.reduce((sum, day) => sum + day.routes.length, 0);
  }

  async loadPreviousWeek(): Promise<void> {
    if (!this.week?.startDate || this.isWeekSwitching) {
      return;
    }

    await this.loadWeek(this.toDateKey(this.addDays(this.parseLocalDate(this.week.startDate), -7)), false);
  }

  async loadNextWeek(): Promise<void> {
    if (!this.week?.startDate || this.isWeekSwitching) {
      return;
    }

    await this.loadWeek(this.toDateKey(this.addDays(this.parseLocalDate(this.week.startDate), 7)), false);
  }

  get isBusy(): boolean {
    return this.isLoading || this.isWeekSwitching;
  }

  async goBack(): Promise<void> {
    await this.router.navigate(['/home'], {
      queryParams: this.week?.startDate ? { weekStart: this.week.startDate } : undefined,
    });
  }

  async openRouteDetails(route: DailyRoutePlanRoute): Promise<void> {
    await this.router.navigate(['/home/routes', route.scope, route.id], {
      queryParams: {
        weekStart: this.week?.startDate || undefined,
        routeDate: route.routeDate || undefined,
        returnTo: 'routes',
      },
      state: {
        route,
        routeDayDate: route.routeDate || undefined,
      },
    });
  }

  routeDurationLabel(route: DailyRoutePlanRoute): string {
    const totalMinutes = route.totalTravelMinutes + route.totalServiceMinutes;
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

  isToday(date: string): boolean {
    return this.toDateKey(new Date()) === date;
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

  private async loadWeek(weekStart?: string, initialLoad = false): Promise<void> {
    if (initialLoad || !this.week) {
      this.isLoading = true;
    } else {
      this.isWeekSwitching = true;
    }

    this.errorMessage = '';

    try {
      this.week = await this.caregiverRouteService.getMyWeek(weekStart);
    } catch (error: any) {
      this.errorMessage = error?.error?.message || 'Die Wochenansicht konnte nicht geladen werden.';
    } finally {
      this.isLoading = false;
      this.isWeekSwitching = false;
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
}