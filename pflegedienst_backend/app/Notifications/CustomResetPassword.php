<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class CustomResetPassword extends Notification
{
    public $token;
    public $email;

    public function __construct($token, $email)
    {
        $this->token = $token;
        $this->email = $email;
    }

    public function via($notifiable)
    {
        return ['mail'];
    }

    public function toMail($notifiable)
    {
        $url = env('FRONTEND_URL') . '/reset-password?token=' . $this->token . '&email=' . $this->email;

        return (new MailMessage)
            ->subject('Passwort zurücksetzen – RoomSense')
            ->greeting('Hallo!')
            ->line('Wir haben eine Anfrage zum Zurücksetzen Ihres Passwortes erhalten.')
            ->line('Falls du das nicht warst, kannst du diese E-Mail ignorieren.')
            ->action('Passwort jetzt zurücksetzen', $url)
            ->line('Danke und viele Grüße,')
            ->line('Dein RoomSense Team');
    }
}