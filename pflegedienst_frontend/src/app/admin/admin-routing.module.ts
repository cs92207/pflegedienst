import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AdminPage } from './admin.page';

const routes: Routes = [
  {
    path: '',
    component: AdminPage,
    children: [
      {
        path: '',
        loadChildren: () => import('./overview/overview.module').then(m => m.AdminOverviewPageModule)
      },
      {
        path: 'accounts',
        loadChildren: () => import('./accounts/accounts.module').then(m => m.AccountsPageModule)
      },
      {
        path: 'patients',
        loadChildren: () => import('./patients/patients.module').then(m => m.PatientsPageModule)
      },
      {
        path: 'daily-routes',
        loadChildren: () => import('./daily-routes/daily-routes.module').then(m => m.DailyRoutesPageModule)
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AdminPageRoutingModule {}