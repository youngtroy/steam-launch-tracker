# GitHub Pages Deployment

This project can run as a fully static GitHub Pages site with a scheduled GitHub Actions collector.

## What GitHub Hosts

- `public/`: dashboard source files.
- `data/data.json`: raw snapshots.
- `data/archive.json`: structured archive.
- `data/archive.csv`: downloadable archive table.
- `.github/workflows/daily-pages.yml`: daily collector and Pages deploy workflow.

## Setup

1. Create a GitHub repository.
2. Push this folder to the repository root.
3. In GitHub, open `Settings -> Pages`.
4. Set `Source` to `GitHub Actions`.
5. Open `Actions`.
6. Run `Daily Steam archive and Pages deploy` manually once.

After the first successful run, the site will be available at:

```text
https://<your-user>.github.io/<repo-name>/
```

## Schedule

The workflow runs every day at:

```text
01:35 UTC
09:35 Asia/Shanghai
```

The schedule lives in:

```text
.github/workflows/daily-pages.yml
```

## Data Policy

The workflow commits these files back into the repository:

```text
data/data.json
data/archive.json
data/archive.csv
```

If the repository is public, these data files are public too.

## Collected Archive Fields

- Before release: daily Steam `Top Wishlists` public rank for the 7 days before release.
- After release: daily Steam review total for release day through 7 days after release.
- Tracking pool: Steam `Popular Upcoming`.

Steam does not expose real wishlist counts publicly. This tool archives public wishlist rank only.
