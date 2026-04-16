import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { SharedModule } from '../../shared/shared.module';
import { PatientsOverviewPageRoutingModule } from './patients-overview-routing.module';
import { PatientsOverviewPage } from './patients-overview.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    SharedModule,
    PatientsOverviewPageRoutingModule,
  ],
  declarations: [PatientsOverviewPage]
})
export class PatientsOverviewPageModule {}