import { Component, Input, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { User } from 'src/app/models/user';
import { ProfilePopoverComponent } from '../profile-popover/profile-popover.component';
import { PopoverController } from '@ionic/angular';

@Component({
  selector: 'app-profile-button',
  templateUrl: './profile-button.component.html',
  styleUrls: ['./profile-button.component.scss'],
  standalone: false
})
export class ProfileButtonComponent implements OnInit {

  @Input() user:User|null = null;

  emailShort:string = "";

  constructor(private router:Router, private popoverCtrl:PopoverController) { }

  ngOnInit() {
  }

  async openPopover(ev: Event) {
    const popover = await this.popoverCtrl.create({
      component: ProfilePopoverComponent,
      event: ev,
      translucent: true,
      componentProps: {user: this.user}
    });
    await popover.present();
  }

  goToSignIn() {
    this.router.navigate(['sign-in']);
  }

  get label(): string {
    if(!this.user) {
      return 'Anmelden';
    }
    return this.user.name || this.user.email;
  }

}
