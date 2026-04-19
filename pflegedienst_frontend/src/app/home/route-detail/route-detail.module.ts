import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { SharedModule } from '../../shared/shared.module';
import { RouteDetailPageRoutingModule } from './route-detail-routing.module';
import { RouteDetailPage } from './route-detail.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    SharedModule,
    RouteDetailPageRoutingModule,
  ],
  declarations: [RouteDetailPage]
})
export class RouteDetailPageModule {}