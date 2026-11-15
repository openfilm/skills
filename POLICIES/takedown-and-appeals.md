# Takedown and appeals

What happens when a listed item breaks the [developer policy](developer-policy.md), the
[community guidelines](community-guidelines.md) or someone's rights, and how a publisher appeals.

## How problems are found

- **Checks**: every version is scanned and reviewed before it is listed, and listed items are checked again when the
  checks change.
- **Reports**: anyone can report an item with the [report form](../.github/ISSUE_TEMPLATE/report.yml), or privately at
  support@openfilm.dev.
- **Security reports**: privately, as [SECURITY.md](../SECURITY.md) says.

Every report gets an answer.

## The steps

Each step is told to the publisher, with the reason and how to appeal. The step fits the problem; a malicious item goes
straight to step 3.

1. **Flag.** The item stays listed and usable, with a note people see: for a bug, a broken dependency, a
   misleading description.
2. **Hide.** The item leaves Discover. Those who added it keep it, with a note: while a report is looked into, or
   until the publisher fixes it.
3. **Withdraw.** The item leaves the index and is added to `revoked` in [index.json](../index.json): every OpenFilm
   disables it wherever it is installed, and tells the person why, with the advisory when there is one. Films already
   made with it are not changed.
4. **Ban.** The publisher's other items are reviewed, and their account may not publish again: for malware, repeated
   or deliberate violations, or impersonation.

**A person confirms every withdrawal.** No withdrawal is made by an automatic check or an AI review alone. A maintainer
reads the evidence, and for malware a second maintainer confirms. Except for malware, the publisher can answer before it
takes effect.

## Withdrawing an item

A maintainer opens a pull request that:

1. removes the item's entry from `skills` (or, for a version, pins the last good one);
2. adds an entry to `revoked`:

   ```json
   { "uid": "someone/bad-skill", "commits": ["<the whole commit id>"], "reason": "malware",
     "note": "Sent project files to an undeclared host.", "advisory": "https://…", "date": "2026-11-15" }
   ```

   `uid` is the item's full name. `commits` or `digests` (`node scripts/digest.mjs <folder>`) name the versions;
   without them, every version is withdrawn. `reason` is one of `malware`, `impersonation`, `rights`, `broken`,
   `policy`;
3. adds a line to [REMOVED.md](../REMOVED.md).

`node scripts/check.mjs` checks the entry. Assets are withdrawn in openfilm/library, through its `revoked.json`.

## The public log

Every withdrawal is listed in [REMOVED.md](../REMOVED.md): the date, the item, its kind, the reason and the advisory.
Withdrawals are not deleted from the log, even after a successful appeal; the appeal's outcome is added.

## Appeals

A publisher may appeal any step once:

- by replying on the pull request or issue that took the step, or by email to support@openfilm.dev;
- within 30 days, saying what was wrong with the decision, or what has been fixed.

A maintainer who did not take the decision reviews it and answers within 14 days. If the decision is reversed, the
item is listed again, removed from `revoked`, and the log says so. A second appeal of the same decision is answered
only with new evidence.

Malware withdrawals are not reversed. A fixed item is published as a new version, reviewed as a new publisher's.
