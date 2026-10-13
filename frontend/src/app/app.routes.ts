import { Routes } from '@angular/router';
import { LandingPageComponent } from './Component/landing-page/landing-page.component';
import { SelectbusPageComponent } from './Component/selectbus-page/selectbus-page.component';
import { PaymentPageComponent } from './Component/payment-page/payment-page.component';
import { ProfilePageComponent } from './Component/profile-page/profile-page.component';
import { authGuard } from './guards/auth.guard';
import { CommunityPageComponent } from './Component/community/community-page/community-page.component';
import { MyTripComponent } from './Component/profile-page/my-trip/my-trip.component';
import { RoutePlannerComponent } from './Component/route-planner/route-planner.component';

export const routes: Routes = [
  // Public routes — accessible without signing in
  { path: '', component: LandingPageComponent },
  { path: 'select-bus', component: SelectbusPageComponent },
  { path: 'route-planner', component: RoutePlannerComponent },

  // Protected routes — require Google Sign-In
  { path: 'payment', component: PaymentPageComponent, canActivate: [authGuard] },
  { path: 'profile', component: ProfilePageComponent, canActivate: [authGuard] },
  { path: 'my-trips', component: MyTripComponent, canActivate: [authGuard] },
  { path: 'community', component: CommunityPageComponent },
];
