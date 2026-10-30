# Changes

Each skill has its own version, in its `openfilm.json`. Newest first.

## replicate 0.2.0

- `scripts/breakdown.mjs` writes the reference shot by shot into `references/`: cuts, each shot's frames, motion,
  colour and main colours, where the picture changes and sounds hit, and its words from `get asr`. A table (JSON) and
  a page to look at.
- `scripts/compare.mjs` measures a render of the film the same way and reports how many frames each cut, change, word
  and sound hit is off and how far each shot's colour is; it also finds any frame, stretch of sound or clip of the
  reference in the film, and how many of the reference's words the film repeats.
- The brief says the most common case first: the reference's packaging on the person's own material, and offers to
  keep that packaging as a skill of their own.

## The first ten

All at 0.1.0. Each is a brief: what the film must achieve, what has to be true, and what OpenFilm offers for it.

- Workflows: `replicate` (an exact copy of a video or your own version of it), `long-to-short`, `screen-demo`,
  `motion-graphics`, `presenter-pip`.
- Styles: `whiteboard`, `vintage-film`, `lyric-video`, `keynote`, `collage`.
