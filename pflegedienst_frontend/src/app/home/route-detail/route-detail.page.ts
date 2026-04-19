import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import * as L from 'leaflet';
import { combineLatest, Subscription } from 'rxjs';
import { DailyRoutePlanDay, DailyRoutePlanRoute, DailyRoutePlanWeek, DailyRouteStop } from '../../models/daily-route';
import { CaregiverRouteService } from '../../services/caregiver-route.service';

interface RouteTimelineEntryBase {
  type: 'start' | 'travel' | 'stop' | 'end';
}

interface RouteTimelinePointEntry extends RouteTimelineEntryBase {
  type: 'start' | 'stop' | 'end';
  title: string;
  subtitle: string;
  timeLabel: string;
  metaLabel: string;
  patientId?: number | null;
  patientName?: string;
  isClickablePatient?: boolean;
  note?: string | null;
}

interface RouteTimelineTravelEntry extends RouteTimelineEntryBase {
  type: 'travel';
  durationLabel: string;
  distanceLabel: string;
}

type RouteTimelineEntry = RouteTimelinePointEntry | RouteTimelineTravelEntry;

@Component({
  selector: 'app-route-detail',
  templateUrl: './route-detail.page.html',
  styleUrls: ['./route-detail.page.scss'],
  standalone: false
})
export class RouteDetailPage implements OnInit, OnDestroy {
  routeDetail: DailyRoutePlanRoute | null = null;
  routeDay: DailyRoutePlanDay | null = null;
  week: DailyRoutePlanWeek | null = null;
  isLoading = true;
  errorMessage = '';

  @ViewChild('routeMap') private routeMapElement?: ElementRef<HTMLDivElement>;

  private routeMap?: L.Map;
  private routeMapLayers?: L.FeatureGroup;
  private routeSubscription?: Subscription;

  constructor(
    private activatedRoute: ActivatedRoute,
    private caregiverRouteService: CaregiverRouteService,
    private router: Router,
  ) {}

  async ngOnInit(): Promise<void> {
    this.routeSubscription = combineLatest([
      this.activatedRoute.paramMap,
      this.activatedRoute.queryParamMap,
    ]).subscribe(async ([paramMap, queryParamMap]) => {
      const scope = paramMap.get('scope');
      const routeId = Number(paramMap.get('id'));
      const weekStart = queryParamMap.get('weekStart') || undefined;
      const routeDate = queryParamMap.get('routeDate');
      await this.loadRoute(scope, routeId, weekStart, routeDate);
    });
  }

  ngAfterViewInit(): void {
    this.renderRouteMap();
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
    this.destroyRouteMap();
  }

  get pageTitle(): string {
    return this.routeDetail?.routeName || 'Route ohne Namen';
  }

  get routeStops(): DailyRouteStop[] {
    return this.routeDetail?.stops ?? [];
  }

  get routeDateLabel(): string {
    const routeDate = this.routeDetail?.routeDate || this.routeDay?.date;
    if (!routeDate) {
      return 'Datum offen';
    }

    return new Intl.DateTimeFormat('de-DE', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(this.parseLocalDate(routeDate));
  }

  get totalDurationLabel(): string {
    return this.durationLabel((this.routeDetail?.totalTravelMinutes ?? 0) + (this.routeDetail?.totalServiceMinutes ?? 0));
  }

  get totalTravelLabel(): string {
    return this.durationLabel(this.routeDetail?.totalTravelMinutes ?? 0);
  }

  get totalServiceLabel(): string {
    return this.durationLabel(this.routeDetail?.totalServiceMinutes ?? 0);
  }

  get totalDistanceLabel(): string {
    return this.distanceLabel(this.routeDetail?.totalDistanceMeters ?? 0);
  }

  get endTimeLabel(): string {
    const endTime = this.routeDetail?.summary?.end_time || this.routeDetail?.stops[this.routeDetail.stops.length - 1]?.departureTime || null;
    return this.compactTime(endTime);
  }

  get timelineEntries(): RouteTimelineEntry[] {
    const route = this.routeDetail;
    if (!route) {
      return [];
    }

    const entries: RouteTimelineEntry[] = [
      {
        type: 'start',
        title: 'Start',
        subtitle: route.startAddress || 'Startadresse nicht hinterlegt',
        timeLabel: this.compactTime(route.shiftStartTime),
        metaLabel: 'Tourbeginn',
      }
    ];

    route.stops.forEach((stop, index) => {
      if (stop.travelMinutesFromPrevious > 0 || stop.travelDistanceMeters > 0) {
        entries.push({
          type: 'travel',
          durationLabel: this.durationLabel(stop.travelMinutesFromPrevious),
          distanceLabel: this.distanceLabel(stop.travelDistanceMeters),
        });
      }

      entries.push({
        type: 'stop',
        title: stop.patientName || `Stopp ${index + 1}`,
        subtitle: this.stopAddress(stop),
        timeLabel: `${this.compactTime(stop.arrivalTime || stop.scheduledFor)} - ${this.compactTime(stop.departureTime)}`,
        metaLabel: `${this.durationLabel(stop.serviceMinutes)} Pflegezeit`,
        patientId: stop.patientId,
        patientName: stop.patientName,
        isClickablePatient: !!stop.patientId,
        note: stop.notes,
      });
    });

    const finalTravelMinutes = Number(route.summary?.final_leg?.travel_minutes ?? 0);
    const finalTravelDistance = Number(route.summary?.final_leg?.distance_meters ?? 0);

    if (finalTravelMinutes > 0 || finalTravelDistance > 0) {
      entries.push({
        type: 'travel',
        durationLabel: this.durationLabel(finalTravelMinutes),
        distanceLabel: this.distanceLabel(finalTravelDistance),
      });
    }

    entries.push({
      type: 'end',
      title: 'Ende',
      subtitle: route.endAddress || 'Zieladresse nicht hinterlegt',
      timeLabel: this.endTimeLabel,
      metaLabel: 'Tourende',
    });

    return entries;
  }

  get hasMapPreview(): boolean {
    const route = this.routeDetail;
    if (!route) {
      return false;
    }

    return route.routeGeometry.length > 1 || route.stops.some((stop) => Number.isFinite(stop.latitude) && Number.isFinite(stop.longitude));
  }

  async goBack(): Promise<void> {
    const returnTo = this.activatedRoute.snapshot.queryParamMap.get('returnTo');
    const weekStart = this.activatedRoute.snapshot.queryParamMap.get('weekStart') || this.week?.startDate || undefined;
    const selectedDate = this.activatedRoute.snapshot.queryParamMap.get('selectedDate') || this.routeDay?.date || undefined;

    if (returnTo === 'home') {
      await this.router.navigate(['/home'], {
        queryParams: {
          weekStart,
          selectedDate,
        },
      });
      return;
    }

    await this.router.navigate(['/home/routes'], {
      queryParams: {
        weekStart,
      },
    });
  }

  async openPatientDetails(patientId: number | null | undefined): Promise<void> {
    if (!patientId) {
      return;
    }

    await this.router.navigate(['/home/patients', patientId]);
  }

  trackTimeline = (_index: number, entry: RouteTimelineEntry): string => {
    if (entry.type === 'travel') {
      return `travel-${_index}-${entry.durationLabel}-${entry.distanceLabel}`;
    }

    return `${entry.type}-${_index}-${entry.title}`;
  };

  travelDuration(entry: RouteTimelineEntry): string {
    return entry.type === 'travel' ? entry.durationLabel : '';
  }

  travelDistance(entry: RouteTimelineEntry): string {
    return entry.type === 'travel' ? entry.distanceLabel : '';
  }

  compactTime(value: string | null): string {
    if (!value) {
      return 'Offen';
    }

    return value.slice(0, 5);
  }

  durationLabel(totalMinutes: number): string {
    if (!totalMinutes) {
      return '0 Min';
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

  distanceLabel(distanceMeters: number): string {
    if (!distanceMeters) {
      return '0 km';
    }

    return `${(distanceMeters / 1000).toFixed(1).replace('.', ',')} km`;
  }

  stopAddress(stop: DailyRouteStop): string {
    return [stop.addressLine, [stop.zipCode, stop.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || 'Adresse wird ergänzt';
  }

  openMapSection(): void {
    window.setTimeout(() => this.renderRouteMap(), 60);
  }

  private async loadRoute(
    scope: string | null,
    routeId: number,
    weekStart?: string,
    routeDate?: string | null,
  ): Promise<void> {
    this.isLoading = true;
    this.errorMessage = '';

    if (!routeId || (scope !== 'template' && scope !== 'override')) {
      this.errorMessage = 'Die angeforderte Route ist ungültig.';
      this.isLoading = false;
      return;
    }

    const state = this.readNavigationState();
    if (state.route && this.isMatchingRoute(state.route, scope, routeId, routeDate ?? null, state.routeDayDate || state.route.routeDate || '')) {
      this.applyRouteData(state.route, state.routeDayDate || state.route.routeDate || null);
      this.isLoading = false;
    }

    try {
      this.week = await this.caregiverRouteService.getMyWeek(weekStart);

      const matchingDay = this.week.days.find((day) => day.routes.some((route) => this.isMatchingRoute(route, scope, routeId, routeDate ?? null, day.date)));
      const matchingRoute = matchingDay?.routes.find((route) => this.isMatchingRoute(route, scope, routeId, routeDate ?? null, matchingDay?.date ?? '')) ?? null;

      if (!matchingDay || !matchingRoute) {
        if (this.routeDetail) {
          return;
        }

        this.errorMessage = 'Die Route konnte in deinem aktuellen Wochenplan nicht gefunden werden.';
        return;
      }

      this.applyRouteData(matchingRoute, matchingDay.date);
    } catch (error: any) {
      if (this.routeDetail) {
        return;
      }

      this.errorMessage = error?.error?.message || 'Die Routendetails konnten nicht geladen werden.';
    } finally {
      this.isLoading = false;
    }
  }

  private applyRouteData(route: DailyRoutePlanRoute, dayDate: string | null): void {
    this.routeDay = dayDate ? {
      date: dayDate,
      label: '',
      weekday: route.weekday,
      weekdayLabel: route.weekdayLabel,
      routes: [route],
    } : this.routeDay;
    this.routeDetail = route;
    this.openMapSection();
  }

  private readNavigationState(): { route: DailyRoutePlanRoute | null; routeDayDate: string | null } {
    const navigation = this.router.getCurrentNavigation();
    const currentState = navigation?.extras.state ?? window.history.state ?? {};

    return {
      route: currentState['route'] ?? null,
      routeDayDate: currentState['routeDayDate'] ?? null,
    };
  }

  private isMatchingRoute(route: DailyRoutePlanRoute, scope: string, routeId: number, routeDate: string | null, dayDate: string): boolean {
    if (route.scope !== scope || route.id !== routeId) {
      return false;
    }

    if (!routeDate) {
      return true;
    }

    return (route.routeDate || dayDate) === routeDate;
  }

  private parseLocalDate(value: string): Date {
    const [year, month, day] = value.split('-').map((part) => Number(part));
    return new Date(year, (month || 1) - 1, day || 1);
  }

  private renderRouteMap(): void {
    const route = this.routeDetail;
    const mapHost = this.routeMapElement?.nativeElement;

    if (!route || !mapHost || !this.hasMapPreview) {
      return;
    }

    if (!this.routeMap) {
      this.routeMap = L.map(mapHost, {
        zoomControl: true,
        attributionControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap-Mitwirkende',
      }).addTo(this.routeMap);
    }

    if (this.routeMapLayers) {
      this.routeMapLayers.remove();
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

      layers.push(
        L.marker(geometryPoints[0]).bindPopup(`<strong>Start</strong><br>${route.startAddress || 'Startadresse nicht hinterlegt'}`),
        L.marker(geometryPoints[geometryPoints.length - 1]).bindPopup(`<strong>Ende</strong><br>${route.endAddress || 'Zieladresse nicht hinterlegt'}`)
      );
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
          fillColor: '#2563eb',
          fillOpacity: 1,
        }).bindPopup(`<strong>${index + 1}. ${stop.patientName}</strong><br>${this.stopAddress(stop)}<br>${this.compactTime(stop.arrivalTime || stop.scheduledFor)} - ${this.compactTime(stop.departureTime)}`)
      );
    });

    this.routeMapLayers = L.featureGroup(layers).addTo(this.routeMap);

    if (boundsPoints.length === 1) {
      this.routeMap.setView(boundsPoints[0], 14);
    } else if (boundsPoints.length > 1) {
      this.routeMap.fitBounds(L.latLngBounds(boundsPoints), { padding: [28, 28] });
    }

    this.routeMap.invalidateSize();
  }

  private destroyRouteMap(): void {
    if (this.routeMap) {
      this.routeMap.remove();
      this.routeMap = undefined;
    }

    this.routeMapLayers = undefined;
  }
}