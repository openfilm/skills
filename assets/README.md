# OpenFilm Library

The assets track of the [OpenFilm Community](../README.md): original and independently verified CC0 assets for [OpenFilm](https://github.com/openfilm/openfilm). The community catalog starts with sounds, music, and CSS overlays that Studio can use as effects or transitions.

Media items are plain video, image and audio files, such as stock footage, pictures and sound recordings: adding a media pack copies its files into a folder of your own library, under its first tab, Media.

## Use a community asset

The Community group is available when running the OpenFilm desktop app from the [main branch](https://github.com/openfilm/openfilm#from-source) with `pnpm dev:desktop`. OpenFilm 0.3.0 predates Community support.

In Studio, open the library and choose **Community** under Sounds, Music, Transitions or Effects. Search by its name or tags, preview it and add it to your film. `openfilm get sfx-search`, `music-search`, `transition` and `effect` also find these items. Studio downloads published files from OpenFilm's R2 storage as they are needed and verifies their checksums.

Each item's `item.json` identifies its contributor and source. Community submissions in this repository use [CC0 1.0](LICENSE). The built-in assets in the OpenFilm application have their own inventory and notices.

## Packs

A pack shows many items as one listing, such as a music pack of 40 tracks. It is a folder `packs/<slug>/` with a [pack.json](schema/pack.schema.json) that names the pack in five languages, says what it holds and lists its items by ID, and an optional `cover.jpg`. The items stay where they are and keep their own format; a pack may mix categories. Each item is in at most one pack, and every item in a pack is by the pack's contributor. An item in no pack is shown on its own.

## Contribute

See [CONTRIBUTING.md](CONTRIBUTING.md) for formats, file limits and review. See [MAINTAINERS.md](MAINTAINERS.md) for staging, release and takedown. The library lived in its own repository, openfilm/library, until it joined [openfilm/community](https://github.com/openfilm/community) as `assets/`, its history kept; its scripts run from this folder. [Glitch](transition/glitch/) and [Glass Pulse](sound/glass-pulse/) show the two supported asset formats.
