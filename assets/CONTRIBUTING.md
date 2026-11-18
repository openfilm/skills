# Contributing to the OpenFilm Library

## Rights and attribution

Submit work you can dedicate under [CC0 1.0](LICENSE), or a work already published under CC0 whose source you can document. State the source in `item.json`. Use `{"kind":"own"}` for original work and `{"kind":"cc0","url":"https://…"}` for an existing CC0 work. A maintainer checks the evidence before release.

Work made with generative tools is welcome: say in the pull request which parts were generated and with what, and use a tool whose terms let you dedicate the output under CC0. Keep third-party samples, music, trademarks and identifiable people out of your submission unless you can document all relevant permissions. Keep the asset out of content-claiming systems.

## Prepare an item

Make one folder `assets/<category>/<slug>/` in [openfilm/community](https://github.com/openfilm/community) with an [item.json](schema/item.schema.json). Give it a name in English, Simplified Chinese, Japanese, Korean and Spanish, a short description, searchable tags, your GitHub login and the actual length in milliseconds. Start at version 1 and raise the version when changing an approved item.

- **Media.** Plain files people keep in their own library: stock footage, pictures and sound recordings, in `assets/media/<slug>/`. Set `"media"` to `"video"`, `"image"` or `"audio"` and name the main file `media.<ext>`. Adding a media pack in OpenFilm copies its files into a folder of the person's own library.
  - A video is `media.mp4`, `media.mov` or `media.webm`: H.264, HEVC, VP9 or AV1 (VP9 or AV1 in WebM), up to 3840×2160 and 60 seconds, at most 50 MiB, with one optional audio track and no other streams. Add a JPEG `poster.jpg` of at most 1 MiB and 1920×1080.
  - An image is `media.jpg`, `media.jpeg`, `media.png` or `media.webp`, up to 8192 px a side and at most 10 MiB. Its `durationMs` is `0` or left out, and it has no poster.
  - Audio is `media.m4a` (AAC), `media.mp3` or `media.wav` (PCM), a single stream of up to 10 minutes and at most 20 MiB, with no poster.
  - Document the rights to the footage and to every identifiable person, place or work in it: releases for people, permission for private property and artwork. A maintainer checks them before release.
- **Sounds and music.** One `sound.m4a`, `sound.mp3`, `music.m4a` or `music.mp3`, with a single AAC or MP3 stream. Sounds can be up to 2 MiB and music up to 8 MiB. Listen for clipping and trim unintended silence. Studio generates the waveform at publication.
- **Transitions and effects.** `overlay.css` styles the generated page's `<div class="l"></div>`. The page may use local CSS and `@keyframes`; HTML, JavaScript, remote resources and imports are excluded. Add a JPEG poster and a silent H.264 MP4 preview of up to ten seconds and 2 MiB. See [Glitch](scripts/fixtures/transition/glitch/overlay.css) for the overlay pattern. A transition plays over a cut.
- **Text styles.** One `style.json`, `{"vars": {...}}`: 1–24 variables of OpenFilm's text component (`--font`, `--weight`, `--color`, `--stroke`, `--shadow`…), each a plain CSS value with nothing loaded. Leave `durationMs` out. The library draws it live in the person's own words.
- **Stickers.** One `sticker.png` or `sticker.webp` of at most 1024×1024 and 2 MiB, transparent around the figure, with a `durationMs` of up to 10 000. It becomes a page of its own that shows the picture.
- **Filters.** A `grade.json` with OpenFilm's grade (`mix`: a 3×4 colour matrix of 12 numbers, `sat`: saturation, and curves `all`, `r`, `g`, `b` of 17 numbers from 0 to 1) and a JPEG `sample.jpg` (at most 1 MiB and 1920×1080) of an ungraded picture it is shown on. Leave `durationMs` out.
- **Templates.** A short ready-made piece (1–60 s) people fill with their own pictures and words. `template.json` lists its clips: `{"clips": [{"track": 0, "at": 0.5, "time": [0, 2.5], "page": "title", "size": {"w": 1000, "h": 400}, "place": {"x": 0.5, "y": 0.5, "fit": 0.3}, "texts": {".t1": "Summer Days"}, "props": [{"name": "Title", "type": "text", "at": ".t1"}], "fade": [0.3, 0.3]}, {"track": 3, "at": 0, "time": [0, 3], "picture": "example-1"}]}`. A page is `name.html`, markup only (div, span, p, b, i, em, strong, small, br, h1–h3, sup, sub, u, s, each with at most a class), with its `name.css` (the overlay rules). A picture `name.jpg` (at most 1 MiB) is a slot the person replaces. Add a JPEG `poster.jpg` and an H.264 `preview.mp4` of the whole template (at most 60 seconds and 4 MiB). Pages run no scripts of their own and load nothing.
- Open a [proposal issue](https://github.com/openfilm/community/issues/new) for other asset types.

## Propose a pack

A pack groups items you contributed into one listing, such as a music pack of 40 tracks. Make one folder `assets/packs/<slug>/` (a lowercase slug of up to 64 characters) with a [pack.json](schema/pack.schema.json): a name in the same five languages, an English description of 10–300 characters, your GitHub login, `CC0-1.0`, a version and the item IDs it holds, in the order you want them shown.

- A pack lists 1–200 existing items, each once, of any category. Each item can be in one pack only, and every item must have the same `by` as the pack.
- A cover is optional: add `"cover": "cover.jpg"` and a JPEG of at most 1 MiB and 1920×1080 beside it. It must be CC0 like the items.
- Start at version 1 and raise it whenever `pack.json` or the cover changes. The items keep their own versions.
- Run `node scripts/check.mjs packs/<slug>`. The pack can arrive in the same pull request as its items or after them; a maintainer approves it like an item.

## Submit and follow the review

Run the commands below from `assets/` in a checkout of [openfilm/community](https://github.com/openfilm/community).

1. Put a small file in its item folder and record the filename and byte count. To submit audio or a media file separately, run `node scripts/prepare.mjs sound.m4a` (or the matching filename, such as `media.mp4`) and paste its output into `files`; a video's `poster.jpg` stays in the folder. Attach a ZIP containing the one file to the PR or link an attachment the reviewer can download. The maintainer stages the audio under its SHA-256 and verifies its content before approving it.
2. Run `node scripts/check.mjs <category>/<slug>` with Node.js 22+ and FFmpeg installed. CI checks files in the PR. An external attachment requires the separate maintainer check.
3. Open a pull request with the source and evidence. A maintainer checks the asset and adds its reviewed fingerprint. Publication follows in a separately verified release. See [the release procedure](MAINTAINERS.md).

For a rights claim, send the item ID, the source and your basis for the claim to **legal@openfilm.dev**. Please use email for personal details or private evidence.
