import { NgModule } from '@angular/core';
import { AdminOverviewPageRoutingModule } from './overview-routing.module';
import { AdminOverviewPage } from './overview.page';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  imports: [
    SharedModule,
    AdminOverviewPageRoutingModule,
  ],
  declarations: [AdminOverviewPage],
})
export class AdminOverviewPageModule {}