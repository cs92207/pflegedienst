import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { VisitDetailPage } from './visit-detail.page';

const routes: Routes = [
  {
    path: '',
    component: VisitDetailPage,
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class VisitDetailPageRoutingModule {}