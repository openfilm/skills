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

| | | by | |
| --- | --- | --- | --- |
| [Replicate a video](https://github.com/openfilm/skill-replicate) | `openfilm/replicate` | OpenFilm | A video made again in OpenFilm: its look and timing, with your own content, or frame for frame. |

Each one is made in turn and tried on real requests. OpenFilm's Discover reads [index.json](index.json), so a skill
listed there shows in every OpenFilm at once.

## How it fits together

1. **A skill is a repository of its own**, by anyone: its brief in `skills/<name>/`, the real requests it is tried on in
   `evals/README.md`, its versions as tags, its own issues and pull requests. The template's workflow runs this repository's
   check on every push. A skill's name is `<owner>/<name>`, after its repository's owner: `openfilm/replicate` is
   ours, a skill under someone else's account is theirs, and keeps their name wherever it is shown.
2. **This repository lists the skills worth showing.** Each entry in `index.json` pins one commit of a skill's
   repository, so what people get is what was reviewed, and nothing changes until it is pinned again. A skill is
   listed, or moved to a newer version, by a pull request made with `pin.mjs`; it is listed when its check passes,
   its brief follows [SPEC.md](SPEC.md), its repository says its licence, and it has been tried, with and without it,
   on real requests.
3. **OpenFilm reads the index.** Discover shows each listed skill from its own `openfilm.json`, fetched at the pinned
   commit; installing one copies that commit. When the index pins a newer one, an installed skill offers the update;
   when it leaves the index, it stays installed, marked as no longer listed. A skill that is not listed is still added
   from a folder or a link.

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
