# Canned responses

Replies maintainers use in pull requests, issues and email, so every publisher hears the same thing for the same case.
Fill in what is between angle brackets. Quote the exact line a reply is about.

## Reviews

**Received**

> Thanks for publishing `<owner/name>`. The checks and the AI review run on this pull request; a maintainer looks at
> anything they raise, usually within 5 working days. The review standard is in POLICIES/review-standard.md.

**Approved**

> `<owner/name>` `<version>` is listed. It shows in every OpenFilm's Discover now. Thank you for building it.

**Waiting for a person**

> The review raised this to a maintainer because `<reason from the review>`. This is routine for `<a first item / more
> permissions / a high finding>`. Nothing for you to do yet; we will reply here.

**Changes needed**

> Thanks. Before it can be listed: `<the change>`, at `<file:line>`: `<quote>`. Push a new commit, pin it again with
> `node scripts/pin.mjs`, and the checks run again.

Common changes:

- **Licence**: "Your repository needs an open-source licence in `LICENSE` at its root (POLICIES/licensing.md)."
- **Trials**: "`evals/README.md` needs the real requests it was tried on, with and without the skill (SPEC.md)."
- **Undeclared host**: "`<file>` reaches `<host>`, which `permissions.network.domains` does not declare. Declare it
  with a reason, or remove the call."
- **Unused permission**: "`openfilm.json` declares `<permission>`, which nothing uses. Remove it."
- **HTML comment**: "SKILL.md has an HTML comment the agent reads and people do not see. Move it into the text or
  remove it."
- **Invisible characters**: "`<file>:<line>` has invisible characters (`<U+XXXX>`). Remove them."
- **Runtime install**: "Installing packages at run time is not allowed. Ship what you need, or say it in `needs`."
- **Paste a command**: "Items do not tell people or the agent to paste or run commands. Say what it needs in `needs`."
- **Long or minified code**: "Code is shipped as readable source. Replace `<file>` with its source."
- **Account age**: "Publishing accounts are at least 7 days old. Yours will be on `<date>`; the review runs again when
  you push after that."
- **Two-factor authentication**: "Please confirm in this pull request that your GitHub account has two-factor
  authentication on."

**Rejected**

> `<owner/name>` cannot be listed: `<what it does>`, at `<file:line>`: `<quote>`. This is banned by the developer
> policy (POLICIES/developer-policy.md, `<the rule>`). You can appeal once, here, within 30 days
> (POLICIES/takedown-and-appeals.md).

## Reports

**Report received**

> Thanks for reporting `<owner/name>`. A maintainer is looking into it and will answer here. If your evidence is
> personal, send it to support@openfilm.dev instead.

**Report resolved, action taken**

> Thanks. `<owner/name>` has been `<flagged / hidden / withdrawn>` because `<reason>`. See REMOVED.md.

**Report resolved, no action**

> Thanks for reporting. We looked at `<what was checked>` and found it within the policy, because `<reason>`. If you
> have more evidence, add it here.

## To publishers

**Flagged or hidden**

> `<owner/name>` is now `<flagged / hidden from Discover>` because `<reason>`. People who added it keep it. To fix it,
> `<what to do>`. You can appeal once within 30 days (POLICIES/takedown-and-appeals.md).

**Withdrawn**

> `<owner/name>` `<versions>` has been withdrawn because `<reason>`, and OpenFilm disables it where it is installed.
> It is logged in REMOVED.md. You can appeal once within 30 days (POLICIES/takedown-and-appeals.md).

**Appeal received**

> Thanks. A maintainer who did not take the decision will review it and answer here within 14 days.

**Appeal decided**

> We reviewed the decision on `<owner/name>`. `<It stands, because … / It is reversed: the item is listed again.>`
