# Security

## Report privately

If you find a malicious item, a vulnerability in an item, or a weakness in how this repository lists and checks items,
report it privately:

- on GitHub, with **Report a vulnerability** under this repository's Security tab; or
- by email to **support@openfilm.dev**, with "Security" in the subject.

Please do not open a public issue for it. Include the item's full name (`owner/name`) and commit when there is one,
what you found, and how to see it. Evidence such as files or screenshots can be attached.

For a problem in the OpenFilm app itself, report it to [openfilm/openfilm](https://github.com/openfilm/openfilm) the
same way.

## What happens next

- **Within 48 hours** you get a first reply from a person.
- **Within 24 hours of confirming an item is malicious**, it is withdrawn: added to
  [revoked.json](revoked.json), so every OpenFilm disables it wherever it is installed and tells the person why
  ([takedown and appeals](POLICIES/takedown-and-appeals.md)). Its publisher may lose the right to publish.
- **An advisory** is published on this repository and linked from the withdrawal and from [REMOVED.md](REMOVED.md). It
  says:
  - which item and which versions (commits and folder digests);
  - what it did, and since when;
  - how to check whether you were affected: whether you installed it, and what to look for on your computer and in
    your accounts;
  - what to do: remove it, which keys or passwords to change, what else to check.

We credit reporters in the advisory unless they ask us not to.

## What counts

- An item that does what the [developer policy](POLICIES/developer-policy.md) bans: taking data, hiding instructions,
  loading code from elsewhere, reading credentials, and the rest.
- An update that turns a listed item bad, or a publisher account that looks compromised.
- A way past the checks, the review or `revoked`.
- A secret or personal data published by mistake in an item.

## Scope of the checks

The checks and the AI review read every version before it is listed, but no review can promise an item is safe. OpenFilm
shows items as "scanned", never as "safe". Scripts in a skill run with the agent's permissions, and OpenFilm asks before
it installs a community skill that has them. Read what you add, and report what looks wrong.
