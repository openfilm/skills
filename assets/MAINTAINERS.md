# Reviewing and publishing community assets

The GitHub repository holds submissions and approval records. The production R2 bucket holds the catalog and the approved media. The publisher runs from a trusted maintainer checkout, and the GitHub PR workflow has read-only permissions and no R2 keys.

## Review

1. Check the source, CC0 eligibility, Content ID declaration, item quality and attribution. For an external attachment, extract the audio alone, compare `node scripts/prepare.mjs <file>` with `item.json`, and copy the audio to a private local staging directory as `<sha256>` with no extension. Keep any private evidence off GitHub.
2. Run `node scripts/check.mjs --media-dir <staging-dir> <category>/<slug>`. Add the resulting fingerprint and a public, non-sensitive description of the provenance evidence to `approvals.json`. Reviewers own that file. Changed bytes or metadata invalidate the previous approval.
3. Run `node scripts/check.mjs --approved --media-dir <staging-dir>` and preview the result. Stage newly approved files locally. Once published, subsequent releases can reuse the verified bytes already in the same R2 channel. Original review requires a maintainer and passing CI.

## Release

Set `R2_ENDPOINT` to the account's HTTPS S3 endpoint and supply the `openfilm-assets` credentials as `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` in the maintainer shell. Use Node.js 22+, FFmpeg and a curl with SigV4 support.

```sh
node scripts/build.mjs /tmp/openfilm-library-preview /path/to/staging
node scripts/publish.mjs publish preview /path/to/staging
node scripts/publish.mjs status preview
# Point a Community-enabled Studio at the preview catalog.
OPENFILM_COMMUNITY_LIBRARY_URL=https://openfilm.dev/library/community-preview/v1 openfilm open
# Publish from a clean checkout of the approved origin/main.
node scripts/publish.mjs publish production /path/to/staging
node scripts/publish.mjs status production
```

Omit the staging path when every source file is in Git or already published to the target channel. The publisher generates a restricted overlay page, waveform and catalog, uploads content-addressed blobs and an immutable catalog snapshot, reads them back, then switches the active catalog with an R2 ETag condition. Preview and production have separate prefixes. Use the desktop app or CLI from the [OpenFilm main checkout](https://github.com/openfilm/openfilm#from-source) for Community testing. Verify in Studio by searching, previewing and importing both an overlay and a sound.

## Withdraw and roll back

Remove the item's folder and approval, then publish. For a rights or safety withdrawal, add the old approval fingerprint to `revoked.json` in that PR. Rollback refuses snapshots that contain a revoked fingerprint or missing blob. A successful catalog refresh stops Studio from offering or serving withdrawn items from its cache. Media already copied into a project is the project's own file.

To restore a previously published catalog, use its SHA-256 from the publisher:

```sh
node scripts/publish.mjs rollback production <release-sha>
```

For a rights request covering a file at its direct URL, verify every active catalog reference, then remove the unreferenced blob from the affected R2 prefix and purge the exact URL from CDN cache. Keep the revocation record. Treat this as a separate operation from the catalog withdrawal because blobs can be shared by several items and historical releases.
