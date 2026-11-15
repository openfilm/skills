# Contributing to the OpenFilm Library

## Rights and attribution

Submit work you can dedicate under [CC0 1.0](LICENSE), or a work already published under CC0 whose source you can document. State the source in `item.json`. Use `{"kind":"own"}` for original work and `{"kind":"cc0","url":"https://…"}` for an existing CC0 work. A maintainer checks the evidence before release.

For this launch, submissions from generative services are outside the accepted sources. Keep third-party samples, music, trademarks and identifiable people out of your submission unless you can document all relevant permissions. Keep the asset out of Content ID and similar claiming systems.

## Prepare an item

Make one folder `<category>/<slug>/` with an [item.json](schema/item.schema.json). Give it a name in English, Simplified Chinese, Japanese, Korean and Spanish, a short description, searchable tags, your GitHub login and the actual length in milliseconds. Start at version 1 and raise the version when changing an approved item.

- **Sounds and music.** One `sound.m4a`, `sound.mp3`, `music.m4a` or `music.mp3`, with a single AAC or MP3 stream. Sounds can be up to 2 MiB and music up to 8 MiB. Listen for clipping and trim unintended silence. Studio generates the waveform at publication.
- **Transitions and effects.** `overlay.css` styles the generated page's `<div class="l"></div>`. The page may use local CSS and `@keyframes`; HTML, JavaScript, remote resources and imports are excluded. Add a JPEG poster and a silent H.264 MP4 preview of up to ten seconds and 2 MiB. See [Glitch](transition/glitch/overlay.css) for the overlay pattern. A transition plays over a cut.
- Open a [proposal issue](https://github.com/openfilm/library/issues/new) for other asset types.

## Submit and follow the review

1. Put a small file in its item folder and record the filename and byte count. To submit audio separately, run `node scripts/prepare.mjs sound.m4a` (or the matching audio filename) and paste its output into `files`. Attach a ZIP containing the one audio file to the PR or link an attachment the reviewer can download. The maintainer stages the audio under its SHA-256 and verifies its content before approving it.
2. Run `node scripts/check.mjs <category>/<slug>` with Node.js 22+ and FFmpeg installed. CI checks files in the PR. An external attachment requires the separate maintainer check.
3. Open a pull request with the source and evidence. A maintainer checks the asset and adds its reviewed fingerprint. Publication follows in a separately verified release. See [the release procedure](MAINTAINERS.md).

For a rights claim, send the item ID, the source and your basis for the claim to **legal@openfilm.dev**. Please use email for personal details or private evidence.
