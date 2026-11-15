# OpenFilm Library

Original and independently verified CC0 assets for [OpenFilm](https://github.com/openfilm/openfilm). The community catalog starts with sounds, music, and CSS overlays that Studio can use as effects or transitions.

## Use a community asset

The Community group is available when running the OpenFilm desktop app from the [main branch](https://github.com/openfilm/openfilm#from-source) with `pnpm dev:desktop`. OpenFilm 0.3.0 predates Community support.

In Studio, open the library and choose **Community** under Sounds, Music, Transitions or Effects. Search by its name or tags, preview it and add it to your film. `openfilm get sfx-search`, `music-search`, `transition` and `effect` also find these items. Studio downloads published files from OpenFilm's R2 storage as they are needed and verifies their checksums.

Each item's `item.json` identifies its contributor and source. Community submissions in this repository use [CC0 1.0](LICENSE). The built-in assets in the OpenFilm application have their own inventory and notices.

## Contribute

See [CONTRIBUTING.md](CONTRIBUTING.md) for formats, file limits and review. See [MAINTAINERS.md](MAINTAINERS.md) for staging, release and takedown. [Glitch](transition/glitch/) and [Glass Pulse](sound/glass-pulse/) show the two supported asset formats.
