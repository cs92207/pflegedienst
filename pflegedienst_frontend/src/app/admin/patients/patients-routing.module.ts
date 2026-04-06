import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PatientsPage } from './patients.page';
import { PatientDetailPage } from './patient-detail/patient-detail.page';

const routes: Routes = [
  {
    path: '',
    component: PatientsPage,
  },
  {
    path: ':id',
    component: PatientDetailPage,
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PatientsPageRoutingModule {}
