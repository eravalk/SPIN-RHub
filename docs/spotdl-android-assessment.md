# Интеграция spotDL в Android, 1.3.0.0

SPIN использует существующие Python 3.12 / FFmpeg / yt-dlp из Android runtime. Проверенные архивы этих движков не заменены. Добавлены отдельный пакет зависимостей spotDL, SHA256-манифест и нативный запускатель с офлайн-самопроверкой при первом использовании на устройстве.

Встроены оригинальные модули spotDL 4.6.0: types/song.py, types/result.py, utils/formatter.py, utils/matching.py, utils/logging.py. Инициализаторы заменены минимальными для исключения ненужных web/CLI-зависимостей. SpotifyClient в Python запрещён: метаданные поступают от Android-каталога. Используется чистая Python-реализация RapidFuzz вместо несовместимых нативных wheel. Версии и хеши всех зависимостей находятся в assets/spotdl-manifest.json. Поиск аудиокандидатов использует ytmusicapi; файл скачивается через yt-dlp.

Для публичного каталога рассмотрены BobbyESP/spotdl-android и поддерживаемый Eutalix/Spowlo. В последнем метаданные получает отдельный Android-код: это объясняет, почему перенос одного Python CLI не решает поиск Spotify. Протокол каталога SPIN адаптирован по этому Android-форку; код и лицензия указаны в THIRD-PARTY-NOTICES.md. Публичная сессия создаётся отдельно, не из личного аккаунта/браузера. Это неофициальный изменяемый протокол; есть резервный разбор публичных ссылок и дополнительное подключение Developer.

Host-проверки реального пакета прошли. ARM64-запуск на устройстве, текущая доступность публичного каталога и реальные аудиозагрузки нового пути ещё не подтверждены. Реализация не объявляется полностью протестированной или гарантированно работающей во всех регионах.

Источники:
- https://spotdl.readthedocs.io/en/latest/
- https://github.com/spotDL/spotify-downloader
- https://github.com/BobbyESP/spotdl-android
- https://github.com/Eutalix/Spowlo
- Spowlo: library/src/main/java/com/bobbyesp/library/SpotDLCore.kt
- Spowlo: app/src/main/java/com/bobbyesp/spowlo/features/spotify_api/data/remote/web/SpotifyWebApi.kt
- Spowlo: app/src/main/java/com/bobbyesp/spowlo/features/spotify_api/data/remote/web/SpotifyWebAuth.kt
