import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { LoadingService } from '../services/loading.service';
import { PopupService } from '../services/popup.service';
import { AuthService } from '../services/auth.service';
import { User } from '../models/user';

@Component({
  selector: 'app-change-password',
  templateUrl: './change-password.page.html',
  styleUrls: ['./change-password.page.scss'],
  standalone: false
})
export class ChangePasswordPage implements OnInit {

  user: User | null = null;
  currentPassword = '';
  newPassword = '';
  passwordConfirmation = '';

  constructor(
    private authService: AuthService,
    private popupService: PopupService,
    private loadingService: LoadingService,
    private router: Router,
  ) {}

  async ngOnInit() {
    this.user = await this.authService.getCurrentUser();
  }

  async submit() {
    if(!this.currentPassword || !this.newPassword || !this.passwordConfirmation) {
      this.popupService.showAlert('Bitte fülle alle Felder aus.');
      return;
    }

    if(this.newPassword !== this.passwordConfirmation) {
      this.popupService.showAlert('Die neuen Passwörter stimmen nicht überein.');
      return;
    }

    await this.loadingService.showPopup('Passwort wird aktualisiert...');
    const response = await this.authService.changePassword(this.currentPassword, this.newPassword, this.passwordConfirmation);
    await this.loadingService.closePopup();

    if(!response.success || !response.redirectUrl) {
      this.popupService.showAlert(response.message);
      return;
    }

    await this.popupService.showSuccess(response.message);
    await this.router.navigateByUrl(response.redirectUrl);
  }
}