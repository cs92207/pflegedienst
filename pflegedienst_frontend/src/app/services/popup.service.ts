import { Injectable } from '@angular/core';
import { ToastController, AlertController } from '@ionic/angular';

@Injectable({
  providedIn: 'root'
})
export class PopupService {

  constructor(
    private toastController: ToastController,
    private alertController: AlertController
  ) {}

  async showAlert(
    message: string, 
    duration: number = 3000,
    position: 'top' | 'middle' | 'bottom' = 'bottom',
    color: string = 'primary'
  ): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration,
      position,
      color,
      buttons: [
        {
          text: 'OK',
          role: 'cancel'
        }
      ]
    });

    await toast.present();
  }

  async showSuccess(message: string, duration: number = 3000): Promise<void> {
    const toast = await this.toastController.create({
      message: `✓ ${message}`,
      duration,
      position: 'top',
      color: 'success',
      cssClass: 'modern-toast success-toast',
      buttons: [
        {
          text: 'OK',
          role: 'cancel',
          handler: () => {
            toast.dismiss();
          }
        }
      ]
    });

    await toast.present();
  }

  async showError(message: string, duration: number = 4000): Promise<void> {
    const toast = await this.toastController.create({
      message: `✕ ${message}`,
      duration,
      position: 'top',
      color: 'danger',
      cssClass: 'modern-toast error-toast',
      buttons: [
        {
          text: 'OK',
          role: 'cancel',
          handler: () => {
            toast.dismiss();
          }
        }
      ]
    });

    await toast.present();
  }

  async showWarning(message: string, duration: number = 3000): Promise<void> {
    const toast = await this.toastController.create({
      message: `⚠ ${message}`,
      duration,
      position: 'top',
      color: 'warning',
      cssClass: 'modern-toast warning-toast',
      buttons: [
        {
          text: 'OK',
          role: 'cancel',
          handler: () => {
            toast.dismiss();
          }
        }
      ]
    });

    await toast.present();
  }

  async showConfirm(
    message: string,
    header: string = 'Bestätigung',
    confirmText: string = 'Ja',
    cancelText: string = 'Abbrechen'
  ): Promise<boolean> {
    return new Promise(async (resolve) => {
      const alert = await this.alertController.create({
        header,
        message,
        buttons: [
          {
            text: cancelText,
            role: 'cancel',
            handler: () => {
              resolve(false);
            }
          },
          {
            text: confirmText,
            handler: () => {
              resolve(true);
            }
          }
        ],
        cssClass: 'modern-alert'
      });

      await alert.present();
    });
  }
}
