<!-- Listing an item, a new version, or an asset: keep the section that fits and delete the other. For any other
change, say what and why, and delete both. -->

## A listing: a skill, workbench or connector

- Full name (`owner/name`):
- Kind (skill, workbench or connector):
- Version and tag:
- What changed since the version listed before (for an update):

- [ ] This pull request adds or changes only `registry/<kind>/<owner>/<name>.json`, made with
      `node scripts/pin.mjs <repository> <tag>` or written by hand as the [README](README.md#propose-a-listing-from-the-web)
      says; its `commit` is a whole commit id in my public repository.
- [ ] The repository has an open-source licence in `LICENSE` ([licensing](POLICIES/licensing.md)).
- [ ] `evals/README.md` records the real requests it was tried on, with and without it ([SPEC.md](SPEC.md)).
- [ ] `openfilm.json` declares every host, project access, program, key and script it uses, each with a reason, and
      nothing it does not use ([schema](schema/openfilm.schema.json)).
- [ ] It follows the [developer policy](POLICIES/developer-policy.md): readable source only, nothing loaded or installed
      at run time, no hidden instructions, nothing sent without a declared permission and the person's action.
- [ ] My GitHub account is at least 7 days old and has two-factor authentication on.
- [ ] Nothing in it was made with a generative tool, or I say here what was.

The checks and the AI review run on this pull request and comment with what they find
([review standard](POLICIES/review-standard.md)). A maintainer merges; `index.json` is then rebuilt on its own.

## An asset

- Item id (`<category>/<slug>`), what it is, and how to preview it:
- A separate audio attachment, if any:

- [ ] I made the asset myself or verified its original CC0 publication. I have provided the source and supporting
      evidence.
- [ ] I dedicate my contribution under CC0 1.0.
- [ ] I have cleared third-party material and kept the item out of content-claiming systems.
- [ ] I ran the item check (`cd assets && node scripts/check.mjs <category>/<slug>`). If audio is attached separately,
      its SHA-256 and size are in `item.json`.

A maintainer reviews the actual bytes and rights, then records the approved fingerprint
([assets/CONTRIBUTING.md](assets/CONTRIBUTING.md)).
