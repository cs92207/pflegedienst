import { NgModule } from '@angular/core';
import { SharedModule } from '../../shared/shared.module';
import { PatientDetailPageRoutingModule } from './patient-detail-routing.module';
import { PatientDetailPage } from './patient-detail.page';

@NgModule({
  imports: [
    SharedModule,
    PatientDetailPageRoutingModule,
  ],
  declarations: [PatientDetailPage]
})
export class PatientDetailPageModule {}