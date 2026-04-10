import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DailyRoutesPage } from './daily-routes.page';

const routes: Routes = [
  {
    path: '',
    component: DailyRoutesPage,
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class DailyRoutesPageRoutingModule {}