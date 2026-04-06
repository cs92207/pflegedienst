<?php
namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class GenericMail extends Mailable
{
    use Queueable, SerializesModels;

    public $subjectText;
    public $contentText;
    public $linkUrl; // 👈 neu

    /**
     * Create a new message instance.
     */
    public function __construct($subjectText, $contentText, $linkUrl = null)
    {
        $this->subjectText = $subjectText;
        $this->contentText = $contentText;
        $this->linkUrl = $linkUrl; // 👈 speichern
    }

    /**
     * Build the message.
     */
    public function build()
    {
        return $this->subject($this->subjectText)
                    ->view('emails.generic')
                    ->with([
                        'contentText' => $this->contentText,
                        'linkUrl' => $this->linkUrl, // 👈 an View übergeben
                    ]);
    }
}

