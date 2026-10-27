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

## Publikacja na GitHub Pages

Workflow GitHub Actions automatycznie buduje aplikację i publikuje ją na GitHub Pages po każdym pushu do gałęzi `main`.

1. W repozytorium GitHub otwórz **Settings → Pages**.
2. W sekcji **Build and deployment** ustaw **Source** na **GitHub Actions**.
3. Wypchnij zmiany do gałęzi `main` i poczekaj na zakończenie workflow **Deploy to GitHub Pages** w zakładce **Actions**.
4. Aplikacja będzie dostępna pod adresem `https://plakjakub.github.io/tests/`.

GitHub Pages zapewnia HTTPS, więc po otwarciu strony w przeglądarce można udzielić jej dostępu do kamery. GitHub Pages hostuje pliki statyczne; jeśli aplikacja ma kiedyś wysyłać zdjęcia, potrzebny będzie osobny backend/API. Obecnie zdjęcia nie są wysyłane automatycznie.

## Sterowanie i zdjęcie

- Przytrzymaj ekran zegara przez 700 ms, nie przesuwając palca, aby otworzyć podgląd tylnej kamery.
- Naciśnij **ZRÓB ZDJĘCIE**, aby utworzyć JPEG o jakości 0.9. Strumień kamery jest wtedy zatrzymywany, a zdjęcie zostaje tymczasowo wyświetlone jako tło zegara.
- **POWRÓT** zamyka aparat i wraca do zegara.

`uploadPhoto(photo: Blob)` znajduje się w `src/api.ts`, a `getCapturedPhoto()` udostępnia ostatnie zdjęcie z pamięci. Tymczasowe wyświetlanie zdjęcia jako tła służy wyłącznie do testów i można je usunąć po sprawdzeniu; funkcja uploadu nie jest wywoływana automatycznie.

## PWA i Capacitor

Manifest znajduje się w `public/manifest.webmanifest`, a podstawowy cache aplikacji obsługuje `public/sw.js`. Service worker cache'uje wyłącznie żądania GET do zasobów tego samego pochodzenia; nie cache'uje żądań API ani zdjęć. Kod aplikacji używa standardowych Web APIs, bez zależności od frameworka UI, dzięki czemu można go później zaadaptować do Capacitor.
