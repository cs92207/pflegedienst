import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PatientsOverviewPage } from './patients-overview.page';

const routes: Routes = [
  {
    path: '',
    component: PatientsOverviewPage,
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PatientsOverviewPageRoutingModule {}