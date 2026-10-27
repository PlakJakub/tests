# Camera PWA

Minimalistyczna aplikacja PWA z zegarem i aparatem. Cała logika działa w przeglądarce; zdjęcie pozostaje w pamięci jako `Blob` i nie jest wysyłane automatycznie.

## Wymagania

- Node.js 20.19+ lub 22.12+
- npm

## Instalacja i uruchomienie

W katalogu `camera-pwa` uruchom:

```sh
npm install
npm run dev
```

Build produkcyjny i podgląd:

```sh
npm run build
npm run preview
```

## Android

1. Zbuduj aplikację poleceniem `npm run build`.
2. Opublikuj zawartość katalogu `dist` na serwerze obsługującym HTTPS.
3. Otwórz adres HTTPS w Chrome na Androidzie i zezwól stronie na dostęp do kamery.
4. W Chrome wybierz menu ⋮ → **Zainstaluj aplikację** lub **Dodaj do ekranu głównego**. Po instalacji aplikacja uruchamia się jako PWA na pełnym ekranie.

Kamera wymaga bezpiecznego kontekstu: HTTPS albo `localhost`. Adres serwera deweloperskiego dostępny w telefonie przez zwykłe HTTP w sieci lokalnej nie umożliwi użycia kamery. Do testów na urządzeniu użyj hostingu HTTPS lub lokalnego serwera HTTPS.

## Sterowanie i zdjęcie

- Przytrzymaj ekran zegara przez 700 ms, nie przesuwając palca, aby otworzyć podgląd tylnej kamery.
- Naciśnij **ZRÓB ZDJĘCIE**, aby utworzyć JPEG o jakości 0.9. Strumień kamery jest wtedy zatrzymywany.
- **POWRÓT** zamyka widok aparatu lub gotowego zdjęcia i wraca do zegara.

`uploadPhoto(photo: Blob)` znajduje się w `src/api.ts`, a `getCapturedPhoto()` udostępnia zdjęcie z pamięci po przejściu do stanu gotowego. Adres serwera można zmienić w jednym miejscu, w stałej `API_URL`. Funkcja uploadu nie jest wywoływana automatycznie.

## PWA i Capacitor

Manifest znajduje się w `public/manifest.webmanifest`, a podstawowy cache aplikacji obsługuje `public/sw.js`. Service worker cache'uje wyłącznie żądania GET do zasobów tego samego pochodzenia; nie cache'uje żądań API ani zdjęć. Kod aplikacji używa standardowych Web APIs, bez zależności od frameworka UI, dzięki czemu można go później zaadaptować do Capacitor.
