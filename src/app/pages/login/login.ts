import { Component ,OnInit} from '@angular/core';
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

  constructor(private router: Router, private http: HttpClient) {}
  ngOnInit(): void {
    //  Reset state when component loads
    this.username = '';
    this.password = '';
    this.error = '';
    this.loading = false;
  }
  login() {
    this.error = '';
    this.loading = true;

    const body = {
      username: this.username,
      password: this.password
    };

    this.http.post<any>('http://localhost:8080/api/v1/afs-login', body).subscribe({
      next: (response) => {
        // Save token and user info
        localStorage.setItem('token', response.token);
        localStorage.setItem('loggedInUser', response.user.username);
        localStorage.setItem('userFullName', response.user.name);
        localStorage.setItem('userEmail', response.user.email);
        localStorage.setItem('userRole', response.user.role);


 
        // Log activity
        const loginTime = new Date().toISOString();
        localStorage.setItem('lastLoginTime', loginTime);
        const activity = {
          username: response.user.username,
          action: 'Login',
          timestamp: loginTime
        };
        const logs = JSON.parse(localStorage.getItem('userActivityLog') || '[]');
        logs.push(activity);
        localStorage.setItem('userActivityLog', JSON.stringify(logs));

        // Navigate to dashboard
        this.router.navigate(['/dashboard']);
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error.message || 'Login failed';
        this.loading = false;
      }
    });
  }
}
