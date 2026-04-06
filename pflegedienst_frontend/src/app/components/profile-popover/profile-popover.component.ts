import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { PopoverController, NavParams } from '@ionic/angular';
import { User } from 'src/app/models/user';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-profile-popover',
  templateUrl: './profile-popover.component.html',
  styleUrls: ['./profile-popover.component.scss'],
  standalone: false
})
export class ProfilePopoverComponent  implements OnInit {

  user:User = new User;

  constructor(private router:Router, private popoverCtrl: PopoverController, private navParams:NavParams, private authService:AuthService) {}

  ngOnInit(): void {
    this.user = this.navParams.get('user');
  }

  async openAdmin() {
    await this.popoverCtrl.dismiss();
    await this.router.navigateByUrl('/admin/accounts');
  }

  async signOut() {
    await this.popoverCtrl.dismiss();
    await this.authService.signOut();
    await this.router.navigateByUrl('/sign-in');
  }

}
