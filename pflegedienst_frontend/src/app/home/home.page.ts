import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { User } from '../models/user';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: false
})
export class HomePage implements OnInit {

  user: User | null = null;

  constructor(private authService: AuthService, private router: Router) {}

  async ngOnInit() {
    this.user = await this.authService.getCurrentUser();
  }

  openPrimaryAction() {
    this.router.navigateByUrl(this.authService.getDefaultRoute(this.user));
  }

}
