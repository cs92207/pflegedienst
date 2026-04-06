import { Component } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { MenuController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { addOutline, appsOutline, arrowBackOutline, closeOutline, gridOutline, heartOutline, homeOutline, menuOutline, openOutline, peopleOutline, saveOutline, searchOutline, shieldCheckmarkOutline, trashOutline } from 'ionicons/icons';
import { filter } from 'rxjs';
import { User } from './models/user';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent {

  user: User | null = null;

  constructor(
    private router: Router,
    private menuController: MenuController,
    private authService: AuthService,
  ) {
    addIcons({
      addOutline,
      appsOutline,
      arrowBackOutline,
      closeOutline,
      gridOutline,
      heartOutline,
      homeOutline,
      menuOutline,
      openOutline,
      peopleOutline,
      saveOutline,
      searchOutline,
      shieldCheckmarkOutline,
      trashOutline,
    });
  }

  async ngOnInit() {
    await this.loadUser();

    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => {
        this.loadUser();
      });
  }

  get navigationItems(): Array<{ label: string; url: string; icon: string }> {
    const items = [{ label: 'Home', url: '/home', icon: 'home-outline' }];

    if (this.user?.role === 'admin') {
      items.push({ label: 'Admin Panel', url: '/admin', icon: 'shield-checkmark-outline' });
    }

    return items;
  }

  get isAdminRoute(): boolean {
    return this.router.url.startsWith('/admin');
  }

  get canUseAdminMenu(): boolean {
    return this.isAdminRoute && this.user?.role === 'admin';
  }

  isActive(url: string): boolean {
    return this.router.url === url || this.router.url.startsWith(url + '/');
  }

  async openMenu(menuId: 'app-navigation' | 'admin-navigation') {
    await this.menuController.open(menuId);
  }

  async navigateTo(url: string) {
    await this.menuController.close('app-navigation');
    await this.menuController.close('admin-navigation');
    await this.router.navigateByUrl(url);
  }

  private async loadUser() {
    this.user = await this.authService.getCurrentUser();
  }
}
