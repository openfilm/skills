# OpenFilm Community

English · [简体中文](README.zh-CN.md)

Where people share what they make for [OpenFilm](https://github.com/openfilm/openfilm): skills, workbenches,
connectors and assets, and where every version is checked before anyone gets it. OpenFilm's Community window
(Discover, Added, Publish) shows what is listed here and in the library.

| | |
| --- | --- |
| [index.json](index.json) | the skills, workbenches and connectors OpenFilm shows, each pinned to one commit, and what was withdrawn |
| [kinds.json](kinds.json) | the kinds of items, their names, where each lands in OpenFilm and how it is reviewed |
| [schema/openfilm.schema.json](schema/openfilm.schema.json) | an item's `openfilm.json`: how it is shown and what it declares |
| [SPEC.md](SPEC.md) | how a skill for OpenFilm is written, tried and listed |
| [POLICIES/](POLICIES) | the [community guidelines](POLICIES/community-guidelines.md), the [developer policy](POLICIES/developer-policy.md), the [review standard](POLICIES/review-standard.md), [licensing](POLICIES/licensing.md), [takedown and appeals](POLICIES/takedown-and-appeals.md) and [canned responses](POLICIES/canned-responses.md) |
| [SECURITY.md](SECURITY.md) · [REMOVED.md](REMOVED.md) | how to report a security problem; every item withdrawn |
| [template/](template) | a skill's repository to start from |
| `scripts/` | `check.mjs` checks items; `scan.mjs` reads them for what the policy bans; `review.mjs` is the AI review; `pin.mjs` lists a repository's skills; `digest.mjs` gives a folder's digest |

## Take part

1. **Use.** Open the Community in OpenFilm and add what you like. No account is needed. Everything listed is free, and
   assets are free to use commercially.
2. **Share assets.** Templates, text styles, stickers, effects, transitions, filters, sounds and music, made by you and
   shared under CC0. They go to [openfilm/library](https://github.com/openfilm/library) for now: see its
   [CONTRIBUTING.md](https://github.com/openfilm/library/blob/main/CONTRIBUTING.md).
3. **Build.** Skills, workbenches and connectors, in a repository of your own, open source, listed here. Start from
   [template/](template) and read the [developer policy](POLICIES/developer-policy.md).

And at every level: report what is wrong, and help review.

## Kinds

Kinds are an open list ([kinds.json](kinds.json)); a new kind is one more entry. Each is on one of two tracks.

| Kind | Track | Lands in OpenFilm | Tier |
| --- | --- | --- | --- |
| Workbenches | code | a surface of its own, from the workbench switch | C |
| Skills | code | given to the agent | B |
| Connectors | code | the agent's connectors | C |
| Templates, text, stickers, effects, transitions, filters, sounds, music | asset | the library tab of its kind | A |

- **Code** lives in its publisher's own repository, with its own issues and versions. This repository lists it in
  [index.json](index.json), pinned to one commit, so what people get is what was reviewed, and nothing changes until it
  is pinned again.
- **Assets** are files with no code. They are in [openfilm/library](https://github.com/openfilm/library) for now,
  which publishes them to the catalog OpenFilm reads.

## How review works

Every version of every item, not only the first:

1. **Checks**: `check.mjs` checks the format: names, languages, files, size, the link back to its source.
2. **Scan**: `scan.mjs` reads every file for what the [developer policy](POLICIES/developer-policy.md) bans:
   invisible characters, hidden instructions, commands to paste, credentials read, code loaded or installed at run time,
   obfuscation, hosts used and not declared.
3. **AI review**: `review.mjs` gives a top AI model the whole item, the scan's findings and the difference from the
   version listed before, with the [review standard](POLICIES/review-standard.md). It compares what the item says
   with what it makes the agent and the computer do, and what it declares with what its code does. Its verdict is posted
   on the pull request.
4. **A person**, whenever the standard says: a new publisher, more permissions, anything high, an element, or a model
   that is not sure. A maintainer merges every listing.

The checks on a pull request are read-only and hold no secrets. The AI review runs from this repository's own code and
reads the item as data: nothing in an item is ever run to review it.

In OpenFilm, a page reaches only the hosts its item declares, a project's own skills are off until the person allows
them, a community skill with scripts asks before it is installed, and anything withdrawn is disabled everywhere.

## Trust

- **Who made it**: every item has a full name, `<owner>/<name>`, after the GitHub account it is published from.
  `openfilm/` is OpenFilm's own. Publishers' accounts are at least 7 days old with two-factor authentication on.
- **What it can do**: its permissions are shown before you add it, each with a reason.
- **What you get**: the exact commit that was reviewed.
- **Scanned, never "safe"**: checks lower the risk; they do not remove it. Read what you add.
- **Withdrawn**: an item found harmful is added to `revoked` in [index.json](index.json), disabled in every OpenFilm,
  and logged in [REMOVED.md](REMOVED.md).

## Report

- **An item** that breaks the rules or is not what it says: [report it](../../issues/new?template=report.yml), with its
  full name, the reason and the evidence. Personal evidence goes to support@openfilm.dev.
- **A security problem** or malware: privately, as [SECURITY.md](SECURITY.md) says.
- **Your work, shared without your permission**: legal@openfilm.dev.

What happens next: [takedown and appeals](POLICIES/takedown-and-appeals.md).

## The skills

| | | by | |
| --- | --- | --- | --- |
| [Replicate a video](https://github.com/openfilm/skill-replicate) | `openfilm/replicate` | OpenFilm | A video made again in OpenFilm: its look and timing, with your own content, or frame for frame. |

A skill is a brief for the agent making a kind of film: what the film must achieve, the few things that must be true,
and what OpenFilm offers for it. How to make the film is the agent's craft; no skill says it.

**A skill earns the most with what only you know**: your brand, your series and its opening, the way your channel
speaks, your people and your rules. A model cannot have learned these anywhere. Make skills of your own for them.

**OpenFilm takes any skill.** A skill written for another tool works too: OpenFilm reads what the skill is for and
makes it its own way, as a film of web pages that you keep editing in Studio. Add one from a folder or a link.

## Build and list a skill

1. **A skill is a repository of its own**, by anyone: its brief in `skills/<name>/`, the real requests it is tried on in
   `evals/README.md`, its versions as tags, its own issues and pull requests. Copy [template/](template), write the
   brief as [SPEC.md](SPEC.md) says, and try it on real requests. The template's workflow runs this repository's check
   on every push. A skill's name is `<owner>/<name>`: `openfilm/replicate` is ours, a skill under someone else's
   account is theirs, and keeps their name wherever it is shown.
2. **List it here** with a pull request. `node scripts/pin.mjs <repository> [tag]` adds its skills to
   [index.json](index.json), or moves them to a newer commit, with the version each `openfilm.json` says;
   `node scripts/check.mjs` then fetches every skill at its commit and checks it. A skill is listed when its check
   passes, its brief follows [SPEC.md](SPEC.md), its repository has an open-source licence, its version is tagged, it
   has been tried with and without it on real requests, and the review above passes.
3. **OpenFilm reads the index.** Discover shows each listed skill from its own `openfilm.json`, fetched at the pinned
   commit; installing one copies that commit. When the index pins a newer one, an installed skill offers the update;
   when it leaves the index, it stays installed, marked as no longer listed, unless it was withdrawn. A skill that is
   not listed is still added from a folder or a link.

To run the checks yourself, in a checkout of this repository (Node.js 22.2 or later):

```sh
node scripts/check.mjs <your repository>       # the format
node scripts/scan.mjs <your skill's folder>    # what the policy bans
node scripts/review.mjs <your skill's folder> --dry-run   # the prompt the AI review would send
node --test scripts/*.test.mjs                 # this repository's own tests
```

## License

[MIT](LICENSE).
