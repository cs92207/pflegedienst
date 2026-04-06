<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <title>{{ $subjectText }}</title>
</head>
<body style="font-family: Arial, sans-serif; background-color:#f7f7f7; margin:0; padding:20px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; margin:0 auto; background:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 2px 6px rgba(0,0,0,0.1);">
        <tr>
            <td style="background:#4f46e5; color:#ffffff; padding:20px; text-align:center; font-size:20px; font-weight:bold;">
                {{ $subjectText }}
            </td>
        </tr>
        <tr>
            <td style="padding:20px; color:#333333; font-size:16px; line-height:1.5;">
                <p>{{ $contentText }}</p>

                @if(!empty($linkUrl))
                    <p style="margin-top:30px; text-align:center;">
                        <a href="{{ $linkUrl }}" 
                           style="background:#4f46e5; color:#ffffff; text-decoration:none; padding:12px 20px; border-radius:6px; display:inline-block; font-weight:bold;">
                            Jetzt öffnen
                        </a>
                    </p>
                @endif
            </td>
        </tr>
        <tr>
            <td style="background:#f1f1f1; padding:10px; text-align:center; font-size:12px; color:#888;">
                Diese E-Mail wurde automatisch von TeamSwap gesendet.
            </td>
        </tr>
    </table>
</body>
</html>
