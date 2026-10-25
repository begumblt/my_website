# Begüm Balat — personal website

Static personal website with five pages, animated water, an interactive fig tree, and CV and research-paper downloads.

## Publish with GitHub Pages

For a personal site, use the repository name `begumblt.github.io`. If that repository already exists, review its contents before updating it.

1. Put these files at the repository root, with `index.html` directly at the top level.
2. In **Settings → Pages**, select **Deploy from a branch**.
3. Select the **main** branch and **/ (root)** folder, then save.
4. Open the address shown by GitHub Pages once deployment finishes.

No package installation or build is needed. The `.nojekyll` file keeps the website served as plain static files. Relative links also work if the website is placed in a project repository.

## Edit

- `index.html`: homepage and profile links
- `work.html`: MAISSI, research, work experience and community
- `goals.html`: current goals
- `taste.html`: writing and music
- `fig-tree.html`: the Fig Tree Project
- `style.css`: appearance and responsive layouts
- `app.js`: water, cursor and tree animations, menu and motion toggle
- `assets/`: artwork and icons used by the live website
- `Begum_Balat_CV.pdf`: downloadable CV
- `papers/GPU_Performance_Prediction_Begum_Balat.pdf`: final seminar paper

For local preview, run `python3 -m http.server 8000` in this folder and open `http://localhost:8000`. Substack and Spotify embeds require an internet connection.

