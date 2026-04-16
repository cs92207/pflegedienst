import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomePage } from './home.page';

const routes: Routes = [
  {
    path: 'patients/:patientId/visits/:visitId',
    loadChildren: () => import('./visit-detail/visit-detail.module').then((m) => m.VisitDetailPageModule),
  },
  {
    path: 'patients/:id',
    loadChildren: () => import('./patient-detail/patient-detail.module').then((m) => m.PatientDetailPageModule),
  },
  {
    path: 'patients',
    loadChildren: () => import('./patients-overview/patients-overview.module').then((m) => m.PatientsOverviewPageModule),
  },
  {
    path: 'routes',
    loadChildren: () => import('./routes-overview/routes-overview.module').then((m) => m.RoutesOverviewPageModule),
  },
  {
    path: '',
    component: HomePage,
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class HomePageRoutingModule {}
