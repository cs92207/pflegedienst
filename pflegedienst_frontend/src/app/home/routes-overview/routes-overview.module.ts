import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { SharedModule } from '../../shared/shared.module';
import { RoutesOverviewPageRoutingModule } from './routes-overview-routing.module';
import { RoutesOverviewPage } from './routes-overview.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    SharedModule,
    RoutesOverviewPageRoutingModule,
  ],
  declarations: [RoutesOverviewPage]
})
export class RoutesOverviewPageModule {}