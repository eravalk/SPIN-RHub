# Third-party software

SPIN Player 0.2 is distributed under GPL-3.0-or-later because it incorporates NewPipeExtractor. Full SPIN source and third-party source archives are supplied with the application. See LICENSE.

- NewPipeExtractor v0.26.5 — https://github.com/TeamNewPipe/NewPipeExtractor — GPL-3.0-or-later. Binary from https://jitpack.io/com/github/teamnewpipe/NewPipeExtractor/v0.26.5/ . Source: third-party/sources/NewPipeExtractor-sources.jar.
- NewPipe nanojson e9d656ddb49a412a5a0a5d5ef20ca7ef09549996 — https://github.com/TeamNewPipe/nanojson — Apache-2.0 / upstream notices in source archive.
- jsoup 1.22.2 — https://jsoup.org/ — MIT.
- jsr305 3.0.2 — https://github.com/findbugsproject/findbugs — Apache-2.0.
- protobuf-javalite 4.35.1 — https://github.com/protocolbuffers/protobuf — BSD-3-Clause.
- Rhino and Rhino engine 1.8.1 — https://github.com/mozilla/rhino — MPL-2.0, individual bundled files retain their notices.

All corresponding dependency source JARs are in third-party/sources. Libraries retain their embedded META-INF license notices. No source from youtubedl-android was incorporated.

Lyrics lookup: https://lrclib.net/docs . Lyrics are requested only when the user selects “Find lyrics”. No API token is stored. Source content is not bundled.

Example album covers are used only in the optional disabled-by-default demo collection; no example audio recordings are bundled.

## Diagnostics 1.3: yt-dlp runtime
- yt-dlp 2026.10.26 and yt-dlp-ejs 0.8.0: Python sources in assets/yt-engine.zip; package notices in third-party/yt-runtime/python-package-notices.
- Python / QuickJS / FFmpeg ARM64 runtime payloads from io.github.junkfood02.youtubedl-android library + ffmpeg 0.18.1, from Maven Central. Original source JARs and upstream build source snapshot in third-party/yt-runtime. Their native dependency licenses remain in runtime archives; see README for upstream locations.
- The application uses its own Java process bridge, not the Kotlin wrapper. Runtime binaries are extracted in Android's nativeLibraryDir and verified paths; no shell command interpolation. Android execution has not been tested in this build environment.

## SPIN RHub 1.3: catalog adapters

Yandex MP3 API adapter based on the protocol used by vladimir120307-droid/yandex-music-downloader, MIT, copyright (c) 2026 vladimir120307-droid. Attribution/license bundled as app/src/main/assets/licenses/yandex-music-downloader-MIT.txt.

Spotify catalog uses public embed metadata or the Spotify Web API with locally configured client credentials; audio matching is implemented by SPIN against YouTube Music. spotDL and SpotipyFree binaries/dependencies are not included. No Spotify session tokens from public pages are read or reused. Existing yt-dlp runtime archives are unchanged.
