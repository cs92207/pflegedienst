import { Component, OnInit } from '@angular/core';
import { User } from '../../models/user';
import { AdminAccountService, CreateAccountPayload } from '../../services/admin-account.service';
import { AuthService } from '../../services/auth.service';
import { LoadingService } from '../../services/loading.service';
import { PopupService } from '../../services/popup.service';

@Component({
  selector: 'app-accounts',
  templateUrl: './accounts.page.html',
  styleUrls: ['./accounts.page.scss'],
  standalone: false
})
export class AccountsPage implements OnInit {

  accounts: User[] = [];
  currentUser: User | null = null;
  isBusy = false;
  createModel: CreateAccountPayload = {
    name: '',
    email: '',
    role: 'user',
  };
  temporaryPasswordNotice: { label: string; email: string; password: string } | null = null;

  constructor(
    private adminAccountService: AdminAccountService,
    private authService: AuthService,
    private loadingService: LoadingService,
    private popupService: PopupService,
  ) {}

  async ngOnInit() {
    this.currentUser = await this.authService.getCurrentUser();
    await this.loadAccounts();
  }

  async loadAccounts() {
    this.isBusy = true;
    try {
      this.accounts = await this.adminAccountService.listAccounts();
    } catch(error: any) {
      this.popupService.showAlert(error?.error?.message || 'Accounts konnten nicht geladen werden.');
    } finally {
      this.isBusy = false;
    }
  }

  async createAccount() {
    if(!this.createModel.name || !this.createModel.email) {
      this.popupService.showAlert('Bitte Name und E-Mail angeben.');
      return;
    }

    await this.loadingService.showPopup('Account wird erstellt...');

    try {
      const response = await this.adminAccountService.createAccount(this.createModel);
      this.temporaryPasswordNotice = {
        label: 'Einmal-Passwort für neuen Account',
        email: this.createModel.email,
        password: response.temporaryPassword || '',
      };
      this.createModel = { name: '', email: '', role: 'user' };
      await this.loadAccounts();
      this.popupService.showSuccess(response.message);
    } catch(error: any) {
      this.popupService.showAlert(error?.error?.message || 'Account konnte nicht erstellt werden.');
    } finally {
      await this.loadingService.closePopup();
    }
  }

  async saveAccount(account: User) {
    await this.loadingService.showPopup('Account wird aktualisiert...');

    try {
      const response = await this.adminAccountService.updateAccount(account);
      this.popupService.showSuccess(response.message);
      await this.loadAccounts();
    } catch(error: any) {
      this.popupService.showAlert(error?.error?.message || 'Account konnte nicht aktualisiert werden.');
    } finally {
      await this.loadingService.closePopup();
    }
  }

  async issueTemporaryPassword(account: User) {
    const confirmed = await this.popupService.showConfirm(
      `Für ${account.email} wird ein neues Einmal-Passwort erzeugt. Der Benutzer muss sich danach erneut anmelden.`,
      'Einmal-Passwort erzeugen',
      'Erzeugen',
      'Abbrechen'
    );

    if(!confirmed) {
      return;
    }

    await this.loadingService.showPopup('Einmal-Passwort wird erzeugt...');

    try {
      const response = await this.adminAccountService.resetTemporaryPassword(account.id);
      this.temporaryPasswordNotice = {
        label: 'Neues Einmal-Passwort',
        email: account.email,
        password: response.temporaryPassword || '',
      };
      this.popupService.showSuccess(response.message);
      await this.loadAccounts();
    } catch(error: any) {
      this.popupService.showAlert(error?.error?.message || 'Einmal-Passwort konnte nicht erzeugt werden.');
    } finally {
      await this.loadingService.closePopup();
    }
  }

  async deleteAccount(account: User) {
    const confirmed = await this.popupService.showConfirm(
      `Der Account ${account.email} wird dauerhaft gelöscht.`,
      'Account löschen',
      'Löschen',
      'Abbrechen'
    );

    if(!confirmed) {
      return;
    }

    await this.loadingService.showPopup('Account wird gelöscht...');

    try {
      const response = await this.adminAccountService.deleteAccount(account.id);
      this.popupService.showSuccess(response.message);
      await this.loadAccounts();
    } catch(error: any) {
      this.popupService.showAlert(error?.error?.message || 'Account konnte nicht gelöscht werden.');
    } finally {
      await this.loadingService.closePopup();
    }
  }

  isOwnAccount(account: User): boolean {
    return this.currentUser?.id === account.id;
  }

  get totalAdmins(): number {
    return this.accounts.filter((account) => account.role === 'admin').length;
  }

  get totalPendingPasswordChanges(): number {
    return this.accounts.filter((account) => account.mustChangePassword).length;
  }
}