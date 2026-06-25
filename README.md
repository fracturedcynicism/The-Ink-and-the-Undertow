# FC Reader Template
## Zero-Config Reading Platform — Fractured Cynicism

Drop your `.txt` files in. Edit one line. Done.
Everything — title, author, chapters, word count — is auto-extracted from the files.

---

### The Only Config File: `data/books.json`

```json
[
  "injury-time.txt",
  "no-contest.txt",
  "ward.txt"
]
```

That's it. A list of filenames. Order determines reading order.
For a single book, one filename. For a series, many.

---

### File Structure

```
fc-reader-template/
├── index.html              ← App shell (never edit)
├── .nojekyll               ← Required for GitHub Pages
├── css/
│   └── style.css           ← All styles
├── js/
│   └── app.js              ← All logic
├── data/
│   └── books.json          ← THE ONLY FILE YOU EDIT
└── books/
    ├── your-book.txt
    └── ...
```

---

### Metadata Header (Optional)

Add this block at the very top of each `.txt` for richer display:

```
════════════════════════════════
TITLE: Injury Time
AUTHOR: Fractured Cynicism
SUBTITLE: Being the first night of Bikram Dey
SETTING: Salt City Arena, Kolkata — one night
TAGLINE: The result stands.
SYNOPSIS: A football match ends in a city-wide chase after Bikram makes three controversial calls.
════════════════════════════════
```

All fields optional. If no TITLE: line, the filename becomes the title.
The header is stripped before rendering — never appears in the reading view.

---

### Chapter / Structure Detection

| Pattern | Examples |
|---|---|
| CHAPTER N | CHAPTER 1, CHAPTER 12 |
| CHAPTER WORD | CHAPTER ONE, CHAPTER TWELVE |
| CHAPTER N: Title | CHAPTER 3: The Crossing |
| PART N | PART 1, PART TWO, PART III |
| Single-word | PROLOGUE, EPILOGUE, INTERLUDE, CODA, PREFACE, FOREWORD, AFTERWORD, INTRODUCTION |

Scene breaks: `***` or `---` on its own line → renders as · · ·
Timestamp lines: `*Kolkata — 11:45 PM*` → muted italic

---

### Deploy to GitHub Pages

1. Push all files to a GitHub repo
2. `.nojekyll` is already included in the root
3. Settings → Pages → Deploy from branch → main / root → Save
4. Live in 2–3 minutes at `https://yourusername.github.io/your-repo/`

---

### Running Locally

```bash
python3 -m http.server 8080   # then open http://localhost:8080
# or
npx serve .
```

---

### Reusing for a New Series

1. New GitHub repo → copy template files
2. Drop `.txt` files into `books/`
3. Edit `data/books.json` to list your filenames
4. Push → Pages → done

*Part of the Fractured Cynicism publishing infrastructure.*
