import { Component, OnInit } from '@angular/core';
import { LoadingService } from '../services/loading.service';
import { AuthService } from '../services/auth.service';
import { PopupService } from '../services/popup.service';

@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.page.html',
  styleUrls: ['./forgot-password.page.scss'],
  standalone: false
})
export class ForgotPasswordPage implements OnInit {

  email:string = "";

  constructor(private loading:LoadingService, private authService:AuthService, private popUp:PopupService) { }

  ngOnInit() {
  }

  async resetPassword() {
    this.loading.showPopup();
    await this.authService.forgotPassword(this.email);
    this.loading.closePopup();
    this.popUp.showAlert("Bitte bestätige den Link in deiner Email.");
  }

}
