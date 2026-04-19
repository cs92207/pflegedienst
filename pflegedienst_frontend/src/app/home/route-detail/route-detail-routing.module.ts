import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { RouteDetailPage } from './route-detail.page';

const routes: Routes = [
  {
    path: '',
    component: RouteDetailPage,
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class RouteDetailPageRoutingModule {}