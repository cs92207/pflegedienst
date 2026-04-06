import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MenuController } from '@ionic/angular';
import { User } from '../models/user';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-admin',
  templateUrl: './admin.page.html',
  styleUrls: ['./admin.page.scss'],
  standalone: false
})
export class AdminPage implements OnInit {

  readonly navigationItems = [
    {
      label: 'Übersicht',
      detail: 'Status und weitere Admin-Module',
      icon: 'grid-outline',
      url: '/admin',
    },
    {
      label: 'Accounts',
      detail: 'Konten, Rollen und Einmal-Passwörter',
      icon: 'people-outline',
      url: '/admin/accounts',
    },
    {
      label: 'Pflegekunden',
      detail: 'Patienten, Stammdaten und Gesundheitsdaten',
      icon: 'heart-outline',
      url: '/admin/patients',
    }
  ];

  user: User | null = null;

  constructor(
    private authService: AuthService,
    private router: Router,
    private menuController: MenuController,
  ) {}

  async ngOnInit() {
    this.user = await this.authService.getCurrentUser();
  }

  isActive(url: string): boolean {
    if (url === '/admin') {
      return this.router.url === '/admin';
    }

    return this.router.url.startsWith(url);
  }

  async closeMenu() {
    await this.menuController.close('admin-navigation');
  }

  async signOut() {
    await this.authService.signOut();
    await this.router.navigateByUrl('/sign-in');
  }
}