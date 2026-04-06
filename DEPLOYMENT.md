# Backend Deployment Anleitung

## Schritte zum Aktualisieren des Backends auf dem Server

### 1. Code auf den Server übertragen

**Option A: Git (empfohlen)**
```bash
# Auf dem Server im Backend-Verzeichnis
cd /pfad/zum/antonius_backend
git pull origin main  # oder master, je nach Branch
```

**Option B: Manuell via FTP/SFTP**
- Alle geänderten Dateien auf den Server hochladen
- Besonders wichtig:
  - `app/Http/Controllers/TransportRequestController.php`
  - `app/Models/TransportRequest.php`
  - `routes/api.php`
  - `database/migrations/` (neue Migrationen)

### 2. Composer Dependencies aktualisieren
```bash
cd /pfad/zum/antonius_backend
composer install --no-dev --optimize-autoloader
```

### 3. Datenbank-Migrationen ausführen
```bash
php artisan migrate --force
```

**Wichtig:** Die folgenden Migrationen müssen ausgeführt werden:
- `2025_12_19_101512_add_requested_price_to_transport_requests_table.php`
- `2025_12_19_113131_add_transport_description_to_transport_requests_table.php`
- `2025_12_29_122742_add_is_special_to_transport_requests_table.php`
- `2026_01_02_104310_add_status_to_transport_requests_table.php`

### 4. Cache leeren und neu generieren
```bash
# ⚠️ WICHTIG: Route-Cache ZUERST leeren!
# Wenn neue Routes "not found" zurückgeben, liegt es meist am Route-Cache!
php artisan route:clear

# Dann alle anderen Caches leeren
php artisan config:clear
php artisan view:clear
php artisan cache:clear

# Jetzt Caches neu generieren (optional, aber empfohlen für Performance)
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

**⚠️ WICHTIG bei neuen Routes:**
Wenn neue API-Routes "404 Not Found" zurückgeben, obwohl sie in `routes/api.php` definiert sind:
1. Route-Cache leeren: `php artisan route:clear`
2. Route-Cache neu generieren: `php artisan route:cache`
3. Oder Route-Cache komplett deaktivieren (für Entwicklung): Route-Cache nicht generieren

### 5. Optimierungen (optional, aber empfohlen)
```bash
# Autoloader optimieren
composer dump-autoload --optimize

# Opcache leeren (falls aktiv)
# Kann über php.ini oder per Script erfolgen
```

### 6. Berechtigungen prüfen
```bash
# Storage und Cache-Verzeichnisse müssen beschreibbar sein
chmod -R 775 storage bootstrap/cache
chown -R www-data:www-data storage bootstrap/cache
```

### 7. Server/Service neu starten (falls nötig)
```bash
# PHP-FPM neu starten (falls verwendet)
sudo systemctl restart php8.x-fpm

# Oder Web-Server neu starten
sudo systemctl restart nginx
# oder
sudo systemctl restart apache2
```

### 8. Testen
- API-Endpunkte testen
- Neue Features testen (Bestätigung, Ablehnung, etc.)
- Logs prüfen: `storage/logs/laravel.log`

## Checkliste vor dem Deployment

- [ ] Alle Änderungen committed/pushed
- [ ] Datenbank-Backup erstellt
- [ ] `.env` Datei auf dem Server geprüft (API-Keys, DB-Verbindung)
- [ ] Neue Migrationen getestet
- [ ] Composer Dependencies aktualisiert
- [ ] Cache geleert
- [ ] Berechtigungen korrekt gesetzt

## Wichtige Dateien die aktualisiert werden müssen

### Controller
- `app/Http/Controllers/TransportRequestController.php`
  - `confirmRequest()` Methode
  - `rejectRequest()` Methode
  - `deleteRequest()` Methode
  - `store()` Methode (Preisberechnung)

### Model
- `app/Models/TransportRequest.php`
  - `status` Feld in `$fillable`

### Routes
- `routes/api.php`
  - Route für Bestätigung: `PATCH /transport-requests/{id}/confirm`
  - Route für Ablehnung: `PATCH /transport-requests/{id}/reject`
  - Route für Löschen: `DELETE /transport-requests/{id}`

### Migrationen
- `database/migrations/2026_01_02_104310_add_status_to_transport_requests_table.php`

## Troubleshooting

### Fehler: "Class not found"
```bash
composer dump-autoload
```

### Fehler: "Migration already exists"
```bash
# Prüfe ob Migration bereits ausgeführt wurde
php artisan migrate:status
```

### Fehler: "Permission denied"
```bash
chmod -R 775 storage bootstrap/cache
chown -R www-data:www-data storage bootstrap/cache
```

### API funktioniert nicht
- Prüfe `.env` Datei (APP_URL, DB-Verbindung)
- Prüfe CORS-Einstellungen in `config/cors.php`
- Prüfe Logs: `tail -f storage/logs/laravel.log`

