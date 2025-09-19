import { Routes,  CanActivateFn ,Router} from '@angular/router';
import { inject } from '@angular/core';
import { Login } from './pages/login/login';
import { Dashboard } from './pages/dashboard/dashboard';

//inline guard function
const authGuard: CanActivateFn = () => {
  const token = localStorage.getItem('token');
  if (token) {
    return true; // allow access
  } else {
    const router = inject(Router);
    router.navigate(['/']); // 👈 redirect to login
    return false;
  }
};

export const routes: Routes = [
  { path: '', component: Login },
  { path: 'dashboard', component: Dashboard, canActivate: [authGuard] },
  { path: '**', redirectTo: '' },
  //{ path: '**', redirectTo: 'dashboard' }

];
