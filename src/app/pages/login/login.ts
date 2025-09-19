import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class Login implements OnInit {
  username = '';
  password = '';
  error = '';
  loading = false;
  showPassword = false;

  constructor(private router: Router, private http: HttpClient) {}

  ngOnInit(): void {
    // ⛔ Redirect if already logged in
    const token = localStorage.getItem('token');
    if (token) {
      this.router.navigate(['/dashboard']);
      return;
    }

    // Reset state
    this.username = '';
    this.password = '';
    this.error = '';
    this.loading = false;
  }

  login() {
  this.error = '';
  this.loading = true;
  
  const body = {
    email: this.username,
    password: this.password
  };

  this.http.post<any>('https://dev.cityfinance.in/api/v1/login', body).subscribe({
    next: (response) => {
      if (response.success && response.user?.role === 'AFS_ADMIN') {
        localStorage.setItem('token', response.token);
        localStorage.setItem('loggedInUser', response.user.email);
        localStorage.setItem('userFullName', response.user.name);
        localStorage.setItem('userEmail', response.user.email);
        localStorage.setItem('userRole', response.user.role);
        localStorage.setItem('allYears', JSON.stringify(response.allYears));

        localStorage.setItem('isLoggedIn', 'true');  // 👈 add this

        const loginTime = new Date().toISOString();
        localStorage.setItem('lastLoginTime', loginTime);
        const activity = {
          username: response.user.email,
          action: 'Login',
          timestamp: loginTime
        };
        const logs = JSON.parse(localStorage.getItem('userActivityLog') || '[]');
        logs.push(activity);
        localStorage.setItem('userActivityLog', JSON.stringify(logs));

        this.router.navigate(['/dashboard']);
      } else {
        this.error = 'Access denied. Only AFS_ADMIN can login.';
      }
      this.loading = false;
    },
    error: (err) => {
      this.error = err.error?.message || 'Login failed';
      this.loading = false;
    }
  });
}

}
