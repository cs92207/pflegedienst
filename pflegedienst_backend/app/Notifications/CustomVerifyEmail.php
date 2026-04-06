<?php

namespace App\Notifications;

use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Notifications\Messages\MailMessage;

class CustomVerifyEmail extends VerifyEmail
{
    /**
     * Erstelle die Mail-Message für die Verifizierung.
     */
    protected function buildMailMessage($url)
    {
        return (new MailMessage)
            ->subject('Bitte bestätige deine E-Mail-Adresse')
            ->greeting('Hallo!')
            ->line('Danke, dass du dich registriert hast. Bitte bestätige deine E-Mail-Adresse, indem du auf den Button klickst.')
            ->action('E-Mail bestätigen', $url)
            ->line('Wenn du dich nicht registriert hast, ignoriere diese E-Mail.');
    }
}
