# My skill

A skill for [OpenFilm](https://github.com/openfilm/openfilm): one line on the film it makes.

<!-- A cover or a short film made with it goes here. -->

## Use it

- **In OpenFilm**: add it from this repository's address, in the chat's skills.
- **In your own agent** (Claude Code, Codex and others):

  ```sh
  npx skills add openfilm/openfilm
  npx skills add you/skill-my-skill
  ```

## This repository

| | |
| --- | --- |
| `skills/my-skill/` | the skill: everything in it is what the agent gets |
| `evals/README.md` | the real requests it was tried on, with and without it, and what came of them |
| `CHANGELOG.md` | what changed in each version |

How a skill for OpenFilm is written: [SPEC.md](https://github.com/openfilm/skills/blob/main/SPEC.md).

## License

[MIT](LICENSE).
