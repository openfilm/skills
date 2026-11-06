# Writing a skill for OpenFilm

A skill is a brief for the agent making a kind of film: what the film must achieve, the few things that must be true,
and what OpenFilm offers for it. Write it as a good client briefs a great studio. The craft is the agent's, and a skill
never says how to make the film: an agent that is told how does what it was told, and an agent that is told what does
better than the telling.

A skill is read by everyone who uses it. Whatever look it carries, every film made with it ends up carrying, so the
look has to come from the person's own material and the agent's ideas, never from the skill.

## The repository

Each skill has a repository of its own, so it has its own issues, versions and history. Start from
[template/](template):

```
skill-my-skill/
  skills/my-skill/     the skill: what the agent gets, and nothing else
    SKILL.md           the brief (required)
    openfilm.json      how OpenFilm shows it: its title, summary, version and cover
    cover.jpg          its picture in OpenFilm, 16:9
  evals/README.md      the real requests it was tried on, with and without it, and what came of them
  README.md  CHANGELOG.md  LICENSE
  .github/workflows/check.yml
```

### Its full name

Every skill has a full name, `<owner>/<name>`, and OpenFilm uses it everywhere: in Studio, in `openfilm skill`, and
for the agent. The owner is the account its repository is under (`openfilm` for OpenFilm's own, `webgrs` for a
skill in github.com/WEBGRS); the name is its SKILL.md's `name`. Two skills may share a name; their full names tell
them apart. A skill the person made, or added from a folder, is `local/<name>`, and one kept in a project is
`project/<name>`; an account named `local` or `project` is `github-local` or `github-project`.

An agent is given each skill by its full name: in a Claude Code plugin, one for each owner, as `owner:name`
(`openfilm:replicate`); in a skills folder, as `owner-name` (`openfilm-replicate`), with the first line of its text
saying its full name and who made it.

What is in the skill's folder gets used, so it holds nothing else: no code for making the film, no example films, no
notes. A script belongs there only when it gives the agent an ability it cannot get any other way. Everything for
making and trying the skill stays beside it, in the repository.

OpenFilm and `npx skills add` both find the skill in `skills/`, so the repository's address is all anyone needs to add it.

## SKILL.md

The [Agent Skills](https://agentskills.io) format: front matter with `name`, the folder's name (lowercase letters,
digits and hyphens), and `description`, what film it makes and when to use it, in the words people ask with; then the
brief, in five parts.

1. **The result.** What the viewer gets from the film, who it is for, and how good it has to be: "the one the artist
   releases as the official video".
2. **What defines it.** The one thing without which it is not this kind of film. It is usually the thing an agent gets
   wrong when nobody says it, so say it, with a line on what does not count when the edge needs one: "Lyrics shown as
   subtitles are not a lyric video."
3. **What has to be true.** Three to five things, each one a property of the film that can be checked:
   - the person's facts, words, people and rights stay theirs;
   - what can be measured is measured, apart from whatever made it, and reported in numbers ("each word within two
     frames of the voice");
   - the film belongs to its material: "If the same film could carry any other song, it is not done."
4. **What you have.** What OpenFilm offers that an agent cannot guess: `npx openfilm get` and `look`, the rules
   that matter for this film (the picture at t depends on t alone, a page has no sound, a recording is trimmed,
   never re-encoded), the agent's own built-in tools, the services the person has keys for. Open everything else in a
   sentence ("the web platform and any library on it, Blender or any renderer whose output becomes a clip") instead of
   listing techniques. Ask before anything large is downloaded.
5. **With the person.** Their words come first. What to ask them for, to ask without holding up the work, and what to
   tell them when done: what was made and why, the numbers, where every fact came from, and what of theirs would make
   it better.

Leave out:
- styles, looks or directions to choose from, and looks to avoid: a list becomes the look of every film;
- rules for layout, type, color or motion;
- techniques, steps, code, and "check it again";
- example films;
- what OpenFilm's manual already says.

About as long as one screen: the agent reads all of it, every time.

## Keeping a sentence

Every sentence has to earn its place. Before one stays, ask:

1. Without it, is this still the kind of film the skill is for?
2. Could two great directors choose differently here and both be right? Then it is theirs to choose: leave it out.
3. Does an agent get it wrong without the sentence? Try it without the skill; if it does not, leave it out.
4. Is it a property of the film, or a way of making it? Write the property.
5. Can it be checked?
6. Can you say what it means to the viewer or the person? "It looks better" is not enough.

## openfilm.json

```json
{
  "version": "0.1.0",
  "repository": "https://github.com/you/skill-my-skill/tree/main/skills/my-skill",
  "kind": "style",
  "icon": "film",
  "cover": "cover.jpg",
  "title": { "en": "Vintage film", "zh-CN": "复古胶片相册" },
  "summary": { "en": "Your photos as a memory film.", "zh-CN": "把照片做成回忆短片。" },
  "details": { "en": "Best for: …\nWhat it does: …", "zh-CN": "适合：…\n它会：…" }
}
```

| Field | |
| --- | --- |
| `version` | `x.y.z`; raise it with every change, and tag the commit `v<version>` |
| `repository` | its folder's address: `https://github.com/<owner>/<repo>/tree/main/skills/<name>`; OpenFilm links to it |
| `kind` | `workflow`, a way of turning material into a film, or `style`, a kind of look |
| `icon` | `copy`, `scissors`, `monitor`, `shapes`, `pip`, `pen`, `film`, `music`, `presentation` or `layers` |
| `cover` | a picture in the folder, 16:9 |
| `preview` | a short video in the folder, played on the skill's page instead of the cover |
| `order` | a whole number: lower comes first, among OpenFilm's own; a community skill is shown in the index's order |
| `needs` | what it needs beyond OpenFilm, by language: `{ "en": "Windows 10 or 11, FFmpeg 8", "zh-CN": "…" }` |
| `platforms` | the computers it runs on, any of `macos`, `windows`, `linux`; without it, every one. OpenFilm says so where it cannot run, and does not install it there |
| `title`, `summary`, `details` | what OpenFilm shows, by language (`en`, `zh-CN`, `ja`, `ko`, `es`); `details` is a few lines |

Everything here is optional: without it, OpenFilm shows the name and description from SKILL.md.

## Trying it

Give an agent the same real request, with real material, once with the skill and once without, and watch both films
in Studio. A skill ships only when it is clearly better, and keeps only the sentences that make it so. Measure what
can be measured, with a script anyone can run again. Write each request word for word in `evals/README.md`, with the skill's version, the agent and model, the numbers and what was seen; a script to measure goes beside it only when anyone could run it again. Material that is not yours to publish (someone's video, a person's footage) stays on your computer, out of the repository. When
models change, try again: a sentence an agent no longer needs comes out.

## Checks

A skill's repository runs the same check as this one, on every pull request:

```yaml
jobs:
  check:
    uses: openfilm/skills/.github/workflows/skill.yml@main
```

It checks every skill in `skills/`: the name and description, `openfilm.json` with its five languages and its link
back to the repository, the cover, every file a brief names and nothing it does not, the length and the size. To run
it yourself, in a checkout of this repository: `node scripts/check.mjs <your repository>`.

## Listing it

[index.json](index.json) lists the skills OpenFilm shows, each pinned to one commit of its repository:

```json
{ "name": "my-skill", "repo": "https://github.com/you/skill-my-skill", "path": "skills/my-skill",
  "version": "0.1.0", "commit": "<the whole commit id>" }
```

A skill is listed when:

1. `node scripts/check.mjs` passes on it;
2. its brief follows this document;
3. its repository says its licence;
4. its version is tagged;
5. `evals/README.md` says how it was tried, with and without it, on real requests.

OpenFilm's own come first in Discover; a community skill is shown under its owner's name, in the index's order. A
listed skill is pinned to the commit that was looked at: a newer one is listed by pinning it again. One that stops
working, or whose owner asks, leaves the index; those installed stay, marked as no longer listed.

`node scripts/pin.mjs <repository> [tag]` adds a repository's skills, or moves them to a newer commit, with the version
each `openfilm.json` says. `node scripts/check.mjs` then fetches every skill at its commit and checks it. Everything
OpenFilm shows about a skill comes from its `openfilm.json`; the index only says where it is.
