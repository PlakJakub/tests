# Camera PWA

Aplikacja PWA z zegarem i aparatem. Przeglądarka wysyła zdjęcia bezpośrednio do OpenAI Responses API przez oficjalny pakiet OpenAI dla JavaScript/TypeScript. Model najpierw przepisuje pytania i opcje A–D, a następnie osobne wywołanie próbuje wskazać prawidłową odpowiedź, weryfikując ją przez Web Search.

## Wymagania

- Node.js 20.19+ lub 22.12+
- npm

## Instalacja i uruchomienie

W katalogu `camera-pwa` uruchom:

```sh
npm install
npm run dev
```

`npm run dev` uruchamia aplikację Vite. Na ekranie zegara przytrzymaj ekran przez 700 ms, aby otworzyć kamerę, a następnie wybierz **ZRÓB ZDJĘCIE I ODCZYTAJ**. Zdjęcie jest przetwarzane w tle, więc możesz od razu dodać kolejne. Pytania z kolejnych zdjęć są łączone, duplikaty pomijane, a lista wyników sortowana rosnąco po numerze pytania. Po odczytaniu aplikacja próbuje rozwiązać wszystkie pytania z kompletem opcji A–D, w tym zapisane wcześniej bez rozwiązania; przy uruchomieniu ponawia też rozwiązanie zapisanych pytań. Po każdym zdjęciu aktualizuje pełną listę opcji i rozwiązań oraz wysyła ją jako powiadomienie przeglądarki, jeśli udzielono zgody. Jeśli rozwiązanie nie powiedzie się, przy pytaniu pojawi się informacja o błędzie.

Numer pytania jest odczytywany z numeracji wydrukowanej na stronie — np. pytanie oznaczone jako `12` pozostaje pytaniem `12`, nawet jeśli jest pierwszym pytaniem na zdjęciu. Na ekranie wyników wybierz **DODAJ NASTĘPNE ZDJĘCIE**, aby zeskanować kolejną kartkę, także gdy poprzednie zdjęcie jest jeszcze przetwarzane. Pytanie może pojawić się na kilku zdjęciach; odpowiedź już zapisana nie jest rozwiązywana ponownie. Dla pytań niekompletnych kolejne zdjęcie może uzupełnić brakujące odpowiedzi. Identyfikator z pierwszymi czterema znakami pytania jest dodawany wyłącznie w widoku i powiadomieniu.

Przed wyświetleniem aplikacja usuwa z treści pytania rozpoznany prefiks numeru (np. `## 12.`) i oznaczenia odpowiedzi (np. `A)`), aby numer ani litera odpowiedzi nie pojawiały się podwójnie.

Przy starcie aplikacja pobiera klucz OpenAI z `localStorage`. Jeśli klucza tam nie ma, wyświetla formularz do jego wpisania. Wpisany klucz zapisuje pod nazwą `testyv2-openai-api-key`; formularz można też pominąć i skonfigurować klucz później przez usunięcie go z pamięci przeglądarki i ponowne uruchomienie aplikacji. Klucz przechowywany w przeglądarce jest dostępny dla użytkownika urządzenia i nie jest bezpiecznym miejscem dla klucza produkcyjnego — dla wdrożenia publicznego użyj serwerowego proxy OpenAI. Klucz, który był wcześniej zapisany bezpośrednio w kodzie, należy unieważnić i zastąpić.

Build produkcyjny i podgląd frontendu:

```sh
npm run build
npm run preview
```

`npm run preview` uruchamia podgląd zbudowanej aplikacji. Nie jest wymagany osobny serwer pośredniczący — żądania SDK z przeglądarki trafiają bezpośrednio do OpenAI.

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

GitHub Pages zapewnia HTTPS, więc można tam udzielić stronie dostępu do kamery. To hosting statyczny i nie zapewnia serwerowego proxy ani bezpiecznego przechowywania kluczy API.

## Sterowanie i zdjęcie

- Przytrzymaj ekran zegara przez 700 ms, nie przesuwając palca, aby otworzyć podgląd tylnej kamery.
- Naciśnij **ZRÓB ZDJĘCIE I ODCZYTAJ**, aby utworzyć JPEG o jakości 0.9 i przesłać go do API. Wyniki są wyświetlane jako tekst pytania oraz odpowiedzi A–D.
- **POWRÓT** zamyka aparat i wraca do zegara.

Po wyświetleniu wyniku wybierz **WRÓĆ DO ZEGARA**, a następnie przytrzymaj ekran zegara, aby wykonać kolejne zdjęcie. `extractQuestionsFromPhoto(photo)` znajduje się w `src/api.ts`; funkcja serwerowa `extractQuestionsFromImage(imagePath)` jest w `server/extractQuestions.ts`.

Funkcja w `src/api.ts` przyjmuje zdjęcie JPG, PNG lub WEBP jako `Blob`. Obraz jest kodowany jako Base64 Data URL i wysyłany do Responses API modelu `gpt-4.1` z `detail: "high"` i ścisłym JSON Schema. Zdjęcia są przekazywane do OpenAI, a korzystanie z API może wiązać się z opłatami. Błędy API i nieprawidłowe dane są obsługiwane bez komunikatów i bez przerywania działania aplikacji.

## PWA i Capacitor

Manifest znajduje się w `public/manifest.webmanifest`, a podstawowy cache aplikacji obsługuje `public/sw.js`. Service worker cache'uje wyłącznie żądania GET do zasobów tego samego pochodzenia; nie cache'uje żądań API ani zdjęć. Kod aplikacji używa standardowych Web APIs, bez zależności od frameworka UI, dzięki czemu można go później zaadaptować do Capacitor.
