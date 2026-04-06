import { NgModule } from '@angular/core';
import { PatientsPageRoutingModule } from './patients-routing.module';
import { PatientsPage } from './patients.page';
import { PatientDetailPage } from './patient-detail/patient-detail.page';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  imports: [
    SharedModule,
    PatientsPageRoutingModule,
  ],
  declarations: [
    PatientsPage,
    PatientDetailPage,
  ]
})
export class PatientsPageModule {}
