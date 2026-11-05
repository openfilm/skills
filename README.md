# OpenFilm skills

English · [简体中文](README.zh-CN.md)

The index of skills for [OpenFilm](https://github.com/openfilm/openfilm), and how to write one. A skill is a brief for
the agent making a kind of film: what the film must achieve, the few things that must be true, and what OpenFilm
offers for it. How to make the film is the agent's craft; no skill says it.

The skills are not here. Each one lives in a repository of its own, with its own issues, versions and the real
requests it is tried on. This repository says where they are.

| | |
| --- | --- |
| [index.json](index.json) | the skills OpenFilm shows, each pinned to one commit of its repository |
| [SPEC.md](SPEC.md) | how a skill for OpenFilm is written, tried and listed |
| [template/](template) | a skill's repository to start from |
| `scripts/` | `check.mjs` checks skills; `pin.mjs` lists a repository's skills here |

## The skills

None are listed yet. Each one is made in turn, tried on real requests, and listed only when it is clearly better than
no skill at all.

## What skills are for

**A skill earns the most with what only you know**: your brand, your series and its opening, the way your channel
speaks, your people and your rules. A model cannot have learned these anywhere. Make skills of your own for them.

**OpenFilm takes any skill.** A skill written for another tool works too: OpenFilm reads what the skill is for and
makes it its own way, as a film of web pages that you keep editing in Studio. Add one from a folder or a link.

## Make one

Copy [template/](template) into a new repository, write the brief as [SPEC.md](SPEC.md) says, and try it on real
requests. Its check runs on every pull request.

## License

[MIT](LICENSE).
