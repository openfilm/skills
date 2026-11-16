# Developer policy

For everyone who publishes skills, workbenches and connectors in the OpenFilm Community. People add what you make to
the app they make their films in, with their own files, keys and accounts on the same computer. This policy is what
keeps that safe. Breaking it gets an item rejected or withdrawn ([takedown and appeals](takedown-and-appeals.md)).

Every version is reviewed against it, by the automatic checks and by the [review standard](review-standard.md).

## Required

- **An open-source licence.** Your repository has a licence approved by the Open Source Initiative, in a `LICENSE`
  file at its root. Closed source is not listed. See [licensing](licensing.md).
- **Source, not builds.** Everything that runs is in the repository as readable source. No compiled programs, no
  minified bundles, no files that only a tool can read.
- **Declared permissions that match the code.** `openfilm.json` declares every host it reaches, whether it reads or
  writes the project, any program it runs, any key it uses, and whether the agent runs its scripts, each with a reason
  ([schema](../schema/openfilm.schema.json)). It declares nothing it does not use.
- **What it says is what it does.** Its name, title, summary and details describe it, and nothing it does goes
  unmentioned.
- **Trials, written up.** `evals/README.md` in your repository records the real requests it was tried on, with and
  without it, word for word, with the version, the agent and model, the numbers and what was seen
  ([SPEC.md](../SPEC.md)).
- **An account that can be trusted with it.** Your GitHub account is at least 7 days old and has two-factor
  authentication on. The account's age is checked when an item is reviewed; two-factor authentication cannot be seen
  from outside, so you confirm it in the pull request, and an item published without it is withdrawn.

## Banned

- **Obfuscated code**: minified or packed code, code built from strings or character codes, encoded payloads, very long
  lines, anything written to be hard to read.
- **Loading code from elsewhere**: fetching scripts, modules or programs at run time and running them, `import()` of an
  address, evaluating downloaded text.
- **Self-updaters**: replacing its own files, or downloading newer versions of itself. Updates come through the index,
  where they are reviewed.
- **Installing packages at run time**: `npm install`, `pip install` and the like, from a script or by telling the agent
  to. Ship what you need with the item, or say what it needs in `needs` for the person to install.
- **Telling people or the agent to paste or run commands**: `curl ... | sh`, "run this first", "prerequisites" that are
  commands, steps that turn off the computer's protections.
- **Reading credentials**: keys and `~/.ssh`, keychains and credential stores, browser profiles (cookies, saved logins,
  storage), cloud and package-manager configuration, environment variables as a whole.
- **Sending data without a declared permission and a user action**: nothing leaves the computer unless the host is
  declared and the person did something that asks for it. Nothing is sent before the person can see what is sent.
- **Hidden instructions**: invisible characters (zero-width characters, text-direction controls, soft hyphens and the
  like), HTML comments meant for the agent, text hidden in pages, instructions that tell the agent to keep something from
  the person, to ignore their words or its own rules, or that claim the person already agreed.
- **Impersonation and look-alike names**: names, titles, covers or descriptions that copy another item, another
  publisher or OpenFilm's own, or claim an endorsement it does not have.
- **Behaving differently under review**: checks for review or CI environments, dates or counters that change what it
  does.
- **Harm outside its purpose**: changing settings, other skills, the agent's configuration, startup items, shell
  profiles or scheduled tasks; writing outside the project folder unless that is its stated purpose and declared.

## Also expected

- **One clear purpose.** A skill is a brief for one kind of film ([SPEC.md](../SPEC.md)); a workbench is one way of
  working. Unrelated features belong in another item.
- **Ask before anything large.** Downloads of models or media are announced to the person first, with their size.
- **Updates you can stand behind.** Every version is reviewed. A version that adds permissions waits for a person, and
  in the app, the person's agreement.
- **Keep your account safe.** A stolen publishing account is the most common way a good item turns bad. Use a strong
  second factor, and tell us at once if your account or repository is compromised ([SECURITY.md](../SECURITY.md)).
- **Respond.** Answer reports and review comments. An item whose publisher is gone and that stops working leaves the
  index.

## Scripts and programs are not sandboxed

A skill's scripts run with the agent's own permissions, and a program runs on the person's computer once they allow
it. OpenFilm says so before they add it. That is why this policy, and its review, are strict about what scripts do.
