import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage-angular';
import { firstValueFrom } from 'rxjs';
import { User } from '../models/user';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  // Produktiv URL
  // Debug Localhost URL
  apiURL = "http://localhost:8000/api/";

  currentUser:null|User = null;
  tokenKey:string = "auth_token_antonius";
  
  constructor(private http:HttpClient, private storage:Storage) { }

  async getCurrentUser() : Promise<User|null> {
    if(this.currentUser != null) {
      return this.currentUser;
    }
    const token = await this.loadAuthToken();
    if(!token) {
      return null;
    }
    const user = await this.autoSignIn(token);
    this.currentUser = user;
    return user;
  }

  getDefaultRoute(user: User | null): string {
    if(!user) {
      return '/sign-in';
    }
    if(user.mustChangePassword) {
      return '/change-password';
    }
    if(user.role === 'admin') {
      return '/admin/accounts';
    }
    return '/home';
  }

  async getUserByID(userID:number) : Promise<User> {
    const url = this.apiURL + "user-by-id/" + userID;
    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });
    try {
      const res = await firstValueFrom(this.http.get<any>(url, { headers }));
      return this.normalizeUser(res['user']);
    } catch(error: any) {
      console.log(error);
    }
    return new User;
  }

  async signOut() {
    const token = await this.loadAuthToken();
    if(token) {
      const url = this.apiURL + 'logout';
      const headers = new HttpHeaders({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      });
      try {
        await firstValueFrom(this.http.post(url, {}, { headers }));
      } catch(error) {
        console.log(error);
      }
    }
    this.currentUser = null;
    await this.storage.create();
    await this.storage.remove(this.tokenKey);
  }

  async forgotPassword(email:string) {
    const url = this.apiURL + "password/forgot";
    const body = {
      "email" : email
    };
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
    });
    try {
      await firstValueFrom(this.http.post<any>(url, body, { headers }));
    } catch(e) {
      console.log(e);
    }
  }

  async resetPassword(email:string, token:string, password:string, password_confirmed:string) {
    const url = this.apiURL + "password/reset";
    const body = {
      "email" : email,
      "password" : password,
      "token": token,
      "password_confirmation": password_confirmed
    };
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
    });
    try {
      const res = await firstValueFrom(this.http.post<any>(url, body, { headers }));
      console.log(res);
    } catch(e) {
      console.log(e);
    }
  }

  async autoSignIn(token:string) : Promise<User|null> {
    const url = this.apiURL + "autosignin";
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}` 
    });
    try {
      const response = await firstValueFrom(this.http.get<any>(url, { headers }));
      if(!response['success'] || response['success'] == 0) {
        return null;
      }
      return this.normalizeUser(response['user']);
    } catch(e) {
      return null;
    }
  }

  async signIn(email:string, password:string) : Promise<SignInResponse> {
    const url = this.apiURL + "signin";
    const body = {
      email: email,
      password: password
    };
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
    });
    try {
      const response = await firstValueFrom(this.http.post<any>(url, body, { headers }));
      console.log(response);
      if(!response['success'] || response['success'] == 0) {
        if(response['message']) {
          return {
            success: false,
            message: response['message']
          };
        }
        return {
          success: false,
          message: "Fehler bei der Anmeldung."
        };
      }
      this.currentUser = this.normalizeUser(response['user']);
      await this.storeAuthToken(response['token']);
      return {
        success: true,
        message: response['message'],
        user: this.currentUser,
        redirectUrl: this.getDefaultRoute(this.currentUser)
      }
    } catch(e) {
      return {
        success: false,
        message: "Fehler bei der Anmeldung."
      }
    }
  }

  async storeAuthToken(token:string) {
    await this.storage.create();
    await this.storage.set(this.tokenKey, token);
  }

  async loadAuthToken() : Promise<string | null> {
    await this.storage.create();
    return await this.storage.get(this.tokenKey);
  }

  async changePassword(currentPassword:string, newPassword:string, passwordConfirmation:string) : Promise<PasswordChangeResponse> {
    const url = this.apiURL + 'password/change';
    const token = await this.loadAuthToken();
    if(!token) {
      return {
        success: false,
        message: 'Du bist nicht angemeldet.'
      };
    }

    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });

    try {
      const response = await firstValueFrom(this.http.post<any>(url, {
        current_password: currentPassword,
        password: newPassword,
        password_confirmation: passwordConfirmation
      }, { headers }));

      this.currentUser = this.normalizeUser(response['user']);
      await this.storeAuthToken(response['token']);

      return {
        success: true,
        message: response['message'],
        user: this.currentUser,
        redirectUrl: this.getDefaultRoute(this.currentUser)
      };
    } catch(error: any) {
      return {
        success: false,
        message: error?.error?.message || 'Passwort konnte nicht aktualisiert werden.'
      };
    }
  }

  private normalizeUser(data:any) : User {
    const user = new User();
    user.id = data?.id ?? 0;
    user.name = data?.name ?? '';
    user.email = data?.email ?? '';
    user.role = data?.role === 'admin' ? 'admin' : 'user';
    user.emailVerified = data?.email_verified_at != null;
    user.mustChangePassword = !!data?.must_change_password;
    return user;
  }

}

export class SignInResponse {
  success:boolean = false;
  message:string = "";
  user?: User;
  redirectUrl?: string;
}

export class PasswordChangeResponse {
  success:boolean = false;
  message:string = "";
  user?: User;
  redirectUrl?: string;
}
