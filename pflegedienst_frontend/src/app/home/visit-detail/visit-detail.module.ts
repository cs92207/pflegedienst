import { NgModule } from '@angular/core';
import { SharedModule } from '../../shared/shared.module';
import { VisitDetailPageRoutingModule } from './visit-detail-routing.module';
import { VisitDetailPage } from './visit-detail.page';

@NgModule({
  imports: [
    SharedModule,
    VisitDetailPageRoutingModule,
  ],
  declarations: [VisitDetailPage]
})
export class VisitDetailPageModule {}