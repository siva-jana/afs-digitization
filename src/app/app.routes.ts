import { Routes } from '@angular/router';

import { Login } from './pages/login/login';
import { Dashboard } from './pages/dashboard/dashboard';


export const routes: Routes = [
  { path: '', component: Login },
  { path: 'dashboard', component: Dashboard },
  //{ path: '**', redirectTo: '' },
  //{ path: '**', redirectTo: 'dashboard' }

];
