# Changes

What changed in this index, the spec and the checks. Each skill keeps its own changes in its own repository. Newest
first.

## The check on Windows

`check.mjs` passes on a Windows checkout: a brief's CRLF front matter is read, and a skill's files are named with `/`.

## The index

The skills moved out: each one now lives in a repository of its own, and this repository lists them in `index.json`,
each pinned to one commit. The spec says how a skill's repository is laid out, `template/` is one to start from, and
its check is a workflow any skill's repository calls.

The first ten briefs are retired. The last of them is at commit `1111136`.

## keynote 0.1.1, screen-demo 0.1.1

They no longer point to `openfilm capture`, which OpenFilm no longer has: the agent captures the live product with its
own tools.

## The first ten

All at 0.1.0. Each is a brief: what the film must achieve, what has to be true, and what OpenFilm offers for it.

- Workflows: `replicate` (an exact copy of a video or your own version of it), `long-to-short`, `screen-demo`,
  `motion-graphics`, `presenter-pip`.
- Styles: `whiteboard`, `vintage-film`, `lyric-video`, `keynote`, `collage`.
