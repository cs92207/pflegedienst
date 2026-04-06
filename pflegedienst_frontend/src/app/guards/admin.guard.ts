import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const adminGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const user = await authService.getCurrentUser();

  if(!user) {
    return router.createUrlTree(['/sign-in']);
  }

  if(user.mustChangePassword) {
    return router.createUrlTree(['/change-password']);
  }

  if(user.role !== 'admin') {
    return router.createUrlTree(['/home']);
  }

  return true;
};