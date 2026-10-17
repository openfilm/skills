# OpenFilm skills

English · [简体中文](README.zh-CN.md)

The skills that come with [OpenFilm](https://github.com/openfilm/openfilm). A skill is a brief for the agent making a
kind of film: what the film must achieve, the few things that must be true, and what OpenFilm offers for it. How to make
the film is the agent's craft; no skill says it.

## What skills are for

**These skills are a quick start.** They save you from starting each kind of film from a blank page. The stronger the
model, the less it needs them: what a general model already learned (how to cut, design, animate or tell a story) does
not need a skill, and these skills will shrink, or retire, as models improve.

**A skill earns the most with what only you know**: your brand, your series and its opening, the way your channel
speaks, your people and your rules. A model cannot have learned these anywhere. Make skills of your own for them; that
is where skills keep their value.

**OpenFilm takes any skill.** A skill written for another tool, even one that teaches another product's architecture
or code, works too: OpenFilm reads what the skill is for and makes it its own way, as a film of web pages that you keep
editing in Studio. Add one from a folder or a link.

## Workflows

| | | |
| --- | --- | --- |
| <img src="skills/replicate/cover.jpg" width="200" alt=""> | [Replicate a video](skills/replicate) | A video remade in OpenFilm: frame for frame, or with your own content. |
| <img src="skills/long-to-short/cover.jpg" width="200" alt=""> | [Long video to shorts](skills/long-to-short) | A talk, podcast or livestream cut into vertical clips that each stand alone. |
| <img src="skills/screen-demo/cover.jpg" width="200" alt=""> | [Screen demo](skills/screen-demo) | A screen recording made into a polished demo of the real product. |
| <img src="skills/motion-graphics/cover.jpg" width="200" alt=""> | [Premium motion graphics](skills/motion-graphics) | An explainer, promo or intro at studio level, made for its subject alone. |
| <img src="skills/presenter-pip/cover.jpg" width="200" alt=""> | [Presenter in a window](skills/presenter-pip) | The content fills the screen as you say it; you speak from a small window. |

## Styles

| | | |
| --- | --- | --- |
| <img src="skills/whiteboard/cover.jpg" width="200" alt=""> | [Whiteboard explainer](skills/whiteboard) | A voice explains while the board is drawn, mark by mark, as it speaks. |
| <img src="skills/vintage-film/cover.jpg" width="200" alt=""> | [Vintage film](skills/vintage-film) | Your photos and clips as a memory film, as if found on an old reel. |
| <img src="skills/lyric-video/cover.jpg" width="200" alt=""> | [Lyric video](skills/lyric-video) | A lyric video made for one song, every word landing on the voice. |
| <img src="skills/keynote/cover.jpg" width="200" alt=""> | [Keynote](skills/keynote) | A launch film with your real product on stage, one claim at a time. |
| <img src="skills/collage/cover.jpg" width="200" alt=""> | [Cut-paper collage](skills/collage) | Motion graphics made of photos, paper and print, cut out and put together. |

## Use them

- **In OpenFilm**: they come with it. Pick one in the chat, or name it in a message.
- **In your own agent** (Claude Code, Codex and others): add OpenFilm, then these.

  ```sh
  npx skills add openfilm/openfilm
  npx skills add openfilm/skills
  ```

- **Your own**: [SPEC.md](SPEC.md) says how a skill for OpenFilm is written. OpenFilm adds one from a folder or a link,
  or makes one with you.

Each skill has its own version, in its `openfilm.json`; [CHANGELOG.md](CHANGELOG.md) says what changed and why.

## License

[MIT](LICENSE). The covers are by the OpenFilm contributors, under the same license.
