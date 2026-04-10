<?php

namespace App\Services;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use RuntimeException;

class OpenStreetMapRoutingService
{
    public function geocode(string $address): array
    {
        $response = $this->sendRequest(
            rtrim(config('services.openstreetmap.nominatim_url'), '/') . '/search',
            [
                'q' => $address,
                'format' => 'jsonv2',
                'limit' => 1,
                'countrycodes' => 'de',
                'addressdetails' => 1,
            ]
        );

        if ($response->failed()) {
            throw new RuntimeException('Die Adressauflösung über OpenStreetMap ist fehlgeschlagen.');
        }

        $result = $response->json();

        if (!is_array($result) || empty($result[0]['lat']) || empty($result[0]['lon'])) {
            throw new RuntimeException("Adresse konnte nicht aufgelöst werden: {$address}");
        }

        return [
            'lat' => (float) $result[0]['lat'],
            'lng' => (float) $result[0]['lon'],
            'label' => $result[0]['display_name'] ?? $address,
        ];
    }

    public function getMatrix(array $points): array
    {
        if (count($points) < 2) {
            return [
                'durations' => $this->estimateMatrix($points, 'duration'),
                'distances' => $this->estimateMatrix($points, 'distance'),
                'meta' => [
                    'used_fallback' => true,
                    'warning' => 'Die Fahrzeitmatrix wurde vereinfacht berechnet, weil zu wenige Routingpunkte vorlagen.',
                ],
            ];
        }

        $coordinateString = $this->buildCoordinateString($points);

        try {
            $response = $this->sendRequest(
                rtrim(config('services.openstreetmap.osrm_url'), '/') . "/table/v1/driving/{$coordinateString}",
                [
                    'annotations' => 'duration,distance',
                ],
                30
            );

            if ($response->failed()) {
                return $this->buildFallbackMatrix($points, $response);
            }

            $payload = $response->json();

            if (($payload['code'] ?? null) !== 'Ok') {
                return $this->buildFallbackMatrix($points, $response, $payload['message'] ?? 'OSRM lieferte keinen gueltigen Matrix-Status.');
            }

            return [
                'durations' => $payload['durations'] ?? [],
                'distances' => $payload['distances'] ?? [],
                'meta' => [
                    'used_fallback' => false,
                    'warning' => null,
                ],
            ];
        } catch (ConnectionException|RuntimeException $exception) {
            Log::warning('OSRM matrix request failed, using fallback estimate.', [
                'message' => $exception->getMessage(),
            ]);

            return [
                'durations' => $this->estimateMatrix($points, 'duration'),
                'distances' => $this->estimateMatrix($points, 'distance'),
                'meta' => [
                    'used_fallback' => true,
                    'warning' => 'Die Fahrzeitmatrix wurde vereinfacht geschaetzt, weil OSRM aktuell nicht erreichbar ist.',
                ],
            ];
        }
    }

    public function getRouteGeometry(array $points): array
    {
        if (count($points) < 2) {
            return [];
        }

        $coordinateString = $this->buildCoordinateString($points);

        try {
            $response = $this->sendRequest(
                rtrim(config('services.openstreetmap.osrm_url'), '/') . "/route/v1/driving/{$coordinateString}",
                [
                    'overview' => 'full',
                    'geometries' => 'geojson',
                    'steps' => 'false',
                ],
                30
            );

            if ($response->failed()) {
                Log::warning('OSRM route geometry request failed, using straight-line fallback.', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return $this->buildFallbackGeometry($points);
            }

            $payload = $response->json();

            if (($payload['code'] ?? null) !== 'Ok') {
                Log::warning('OSRM route geometry returned invalid code, using straight-line fallback.', [
                    'payload' => $payload,
                ]);

                return $this->buildFallbackGeometry($points);
            }

            return array_map(
                fn (array $coordinate) => ['lat' => (float) $coordinate[1], 'lng' => (float) $coordinate[0]],
                $payload['routes'][0]['geometry']['coordinates'] ?? []
            );
        } catch (ConnectionException|RuntimeException $exception) {
            Log::warning('OSRM route geometry request threw an exception, using straight-line fallback.', [
                'message' => $exception->getMessage(),
            ]);

            return $this->buildFallbackGeometry($points);
        }
    }

    private function buildCoordinateString(array $points): string
    {
        return implode(';', array_map(
            fn (array $point) => $point['lng'] . ',' . $point['lat'],
            $points
        ));
    }

    private function sendRequest(string $url, array $query, int $timeout = 20): Response
    {
        $request = Http::withHeaders([
            'User-Agent' => config('services.openstreetmap.user_agent'),
        ])
            ->acceptJson()
            ->withOptions(['verify' => $this->shouldVerifySsl()])
            ->timeout($timeout);

        try {
            return $request->get($url, $query);
        } catch (ConnectionException $exception) {
            if (!$this->isLocalCertificateProblem($exception)) {
                throw $exception;
            }

            return $request->withoutVerifying()->get($url, $query);
        }
    }

    private function isLocalCertificateProblem(ConnectionException $exception): bool
    {
        return Str::contains(Str::lower($exception->getMessage()), [
            'curl error 60',
            'ssl certificate problem',
            'unable to get local issuer certificate',
        ]);
    }

    private function shouldVerifySsl(): bool
    {
        $configuredValue = config('services.openstreetmap.verify_ssl');

        if ($configuredValue !== null && $configuredValue !== '') {
            return filter_var($configuredValue, FILTER_VALIDATE_BOOL);
        }

        if (PHP_OS_FAMILY !== 'Windows') {
            return true;
        }

        $curlCaInfo = ini_get('curl.cainfo');
        $opensslCaFile = ini_get('openssl.cafile');

        return !empty($curlCaInfo) || !empty($opensslCaFile);
    }

    private function buildFallbackMatrix(array $points, Response $response, ?string $reason = null): array
    {
        Log::warning('OSRM matrix request failed, using fallback estimate.', [
            'status' => $response->status(),
            'body' => $response->body(),
            'reason' => $reason,
        ]);

        return [
            'durations' => $this->estimateMatrix($points, 'duration'),
            'distances' => $this->estimateMatrix($points, 'distance'),
            'meta' => [
                'used_fallback' => true,
                'warning' => 'Die Fahrzeitmatrix wurde vereinfacht geschaetzt, weil OSRM aktuell keine Route liefern konnte.',
            ],
        ];
    }

    private function estimateMatrix(array $points, string $type): array
    {
        $matrix = [];

        foreach ($points as $fromIndex => $fromPoint) {
            $row = [];

            foreach ($points as $toIndex => $toPoint) {
                if ($fromIndex === $toIndex) {
                    $row[] = 0;
                    continue;
                }

                $distanceMeters = $this->calculateGreatCircleDistance($fromPoint, $toPoint);
                $row[] = $type === 'distance'
                    ? $distanceMeters
                    : $this->estimateTravelSeconds($distanceMeters);
            }

            $matrix[] = $row;
        }

        return $matrix;
    }

    private function buildFallbackGeometry(array $points): array
    {
        return array_map(
            fn (array $point) => ['lat' => (float) $point['lat'], 'lng' => (float) $point['lng']],
            $points
        );
    }

    private function calculateGreatCircleDistance(array $fromPoint, array $toPoint): int
    {
        $earthRadius = 6371000;
        $fromLat = deg2rad((float) $fromPoint['lat']);
        $toLat = deg2rad((float) $toPoint['lat']);
        $deltaLat = $toLat - $fromLat;
        $deltaLng = deg2rad((float) $toPoint['lng'] - (float) $fromPoint['lng']);

        $a = sin($deltaLat / 2) ** 2
            + cos($fromLat) * cos($toLat) * sin($deltaLng / 2) ** 2;

        return (int) round($earthRadius * 2 * atan2(sqrt($a), sqrt(1 - $a)));
    }

    private function estimateTravelSeconds(int $distanceMeters): int
    {
        $detourFactor = 1.25;
        $averageSpeedMetersPerSecond = 35 / 3.6;
        $seconds = ($distanceMeters * $detourFactor) / $averageSpeedMetersPerSecond;

        return max(60, (int) round($seconds));
    }
}