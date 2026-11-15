<!-- For listing an item or a new version. For other changes, say what and why, and delete the rest. -->

## The item

- Full name (`owner/name`):
- Kind (skill, workbench or connector):
- Version and tag:
- What changed since the version listed before (for an update):

## Checklist

- [ ] I made `index.json`'s entry with `node scripts/pin.mjs <repository> <tag>`, and `node scripts/check.mjs` passes.
- [ ] The repository has an open-source licence in `LICENSE` ([licensing](POLICIES/licensing.md)).
- [ ] `evals/README.md` records the real requests it was tried on, with and without it ([SPEC.md](SPEC.md)).
- [ ] `openfilm.json` declares every host, project access, program, key and script it uses, each with a reason, and
      nothing it does not use ([schema](schema/openfilm.schema.json)).
- [ ] It follows the [developer policy](POLICIES/developer-policy.md): readable source only, nothing loaded or installed
      at run time, no hidden instructions, nothing sent without a declared permission and the person's action.
- [ ] My GitHub account is at least 7 days old and has two-factor authentication on.
- [ ] Nothing in it was made with a generative tool, or I say here what was.

The checks and the AI review run on this pull request and comment with what they find
([review standard](POLICIES/review-standard.md)). A maintainer merges.
