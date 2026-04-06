import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { PopupService } from '../services/popup.service';
import { LoadingService } from '../services/loading.service';

@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.page.html',
  styleUrls: ['./reset-password.page.scss'],
  standalone: false
})
export class ResetPasswordPage implements OnInit {

  token:string|null = null;
  email:string|null = null;

  password:string = "";
  passwordConfirmed:string = "";

  constructor(
    private route: ActivatedRoute, 
    private router:Router, 
    private authService:AuthService, 
    private popUp:PopupService,
    private loading:LoadingService
  ) { }

  ngOnInit() {
    this.route.queryParamMap.subscribe(params => {
      this.token = params.get('token');
      this.email = params.get('email');
    });
    if(this.token == null || this.email == null) {
      this.router.navigate(['sign-in']);
      return;
    }
  }

  async resetPassword() {
    if(this.email == null || this.token == null || this.password == "" || this.passwordConfirmed == "") {
      this.popUp.showAlert("Bitte fülle alle Felder aus.");
      return;
    }
    if(this.password !== this.passwordConfirmed) {
      this.popUp.showAlert("Die beiden Passwörter stimmen nicht überein.");
      return;
    }
    this.loading.showPopup();
    await this.authService.resetPassword(this.email!, this.token!, this.password, this.passwordConfirmed);
    this.loading.closePopup();
    this.router.navigate(['sign-in']);
    this.popUp.showAlert("Passwort zurückgesetzt. Melde dich nun an.");
  }

}
