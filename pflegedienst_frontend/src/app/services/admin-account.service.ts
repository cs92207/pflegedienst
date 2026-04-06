import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { User } from '../models/user';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class AdminAccountService {

  constructor(private http: HttpClient, private authService: AuthService) {}

  async listAccounts(): Promise<User[]> {
    const response = await firstValueFrom(this.http.get<any>(`${this.authService.apiURL}admin/accounts`, {
      headers: await this.buildHeaders()
    }));

    return (response?.accounts || []).map((account: any) => this.normalizeUser(account));
  }

  async createAccount(payload: CreateAccountPayload): Promise<AccountMutationResponse> {
    const response = await firstValueFrom(this.http.post<any>(`${this.authService.apiURL}admin/accounts`, payload, {
      headers: await this.buildHeaders()
    }));

    return this.normalizeResponse(response);
  }

  async updateAccount(account: User): Promise<AccountMutationResponse> {
    const response = await firstValueFrom(this.http.put<any>(`${this.authService.apiURL}admin/accounts/${account.id}`, {
      name: account.name,
      email: account.email,
      role: account.role,
    }, {
      headers: await this.buildHeaders()
    }));

    return this.normalizeResponse(response);
  }

  async resetTemporaryPassword(accountId: number): Promise<AccountMutationResponse> {
    const response = await firstValueFrom(this.http.post<any>(`${this.authService.apiURL}admin/accounts/${accountId}/temporary-password`, {}, {
      headers: await this.buildHeaders()
    }));

    return this.normalizeResponse(response);
  }

  async deleteAccount(accountId: number): Promise<AccountMutationResponse> {
    const response = await firstValueFrom(this.http.delete<any>(`${this.authService.apiURL}admin/accounts/${accountId}`, {
      headers: await this.buildHeaders()
    }));

    return this.normalizeResponse(response);
  }

  private async buildHeaders(): Promise<HttpHeaders> {
    const token = await this.authService.loadAuthToken();

    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  private normalizeResponse(response: any): AccountMutationResponse {
    return {
      success: !!response?.success,
      message: response?.message || '',
      account: response?.account ? this.normalizeUser(response.account) : undefined,
      temporaryPassword: response?.temporary_password,
    };
  }

  private normalizeUser(data: any): User {
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

export interface CreateAccountPayload {
  name: string;
  email: string;
  role: 'admin' | 'user';
}

export interface AccountMutationResponse {
  success: boolean;
  message: string;
  account?: User;
  temporaryPassword?: string;
}