# Story Data lives on R2 under each Slug, with versioned names that never change

Published data files are stored in R2 at `data.bearylogical.net/<slug>/<name>.v<N>.<ext>` and never overwritten. A change gets a new version number, and the Story points at the new name. Because the files never change, they can be cached for a year with `immutable`, and an old Story can never break because someone else edited a shared file. Source Data and the scripts that build Story Data stay in the repo; files too large for git are ignored or kept in LFS. The repo's publish script uploads with the `cf` CLI.
