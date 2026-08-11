# DraftShelf

A resume builder built around one idea: your work history doesn't
change every time you apply somewhere, but which parts of it you lead
with should.

**[ariharasudhan.com/draftshelf](https://ariharasudhan.com/draftshelf/)**

## Why this exists

Most people end up with one of two messes once they've applied to more
than a few jobs. Either there's a single "master" resume that's grown
into a list of everything they've ever done — too long, too generic,
and never quite right for the job in front of them — or there's a
folder of a dozen near-duplicate Word files, each hand-edited for one
application, with no way to tell which one has the current phone
number or the fixed typo. Both make it easy to send out something
stale, and neither actually gets faster the more you use it.

## How it works

DraftShelf keeps two things separate that most tools bolt together:

- **Your Library** is everything you've ever done — every job,
  project, degree, skill, summary, and reference, written once. Each
  entry holds bullet points, and each bullet is a single source of
  truth: fix it here and it's fixed everywhere it's used.
- **A Version** is one tailored resume — not a copy of anything, just
  a *pointer* into the Library: which entries are included, which
  bullets under each, what order they print in, plus that job's own
  title and dates. Building a new one is picking checkboxes, not
  retyping a resume.

Change a bullet once and every version that uses it updates. Because
it's a real account with a real database behind it, it also follows
you — start a version on your laptop, finish it on your phone.

## What it actually does

- **Tag-driven tailoring.** Bullets and skills carry reusable tags;
  "Fill in with tag" pulls in everything tagged for a role in one
  click, and just as easily undoes it. Skill Sets bundle categories
  into a named group you can apply as a whole instead of re-checking
  the same boxes every time.
- **Overrides when you need an exception.** Need one bullet worded
  differently for a single application without touching the shared
  version? Any field can be overridden per-version, or you can choose
  version-by-version whether a Library edit follows through to
  existing resumes or leaves them as they were.
- **A real style panel.** Fonts, sizes, spacing, margins, and page
  size are adjustable per version or set once as your default — no
  template file to hunt down and edit.
- **Import from wherever you're starting.** Restore your own backup
  exactly, reconcile an outside file against your existing Library
  item by item, or bring in a version that stays fully private until
  you choose to promote pieces of it into your real Library. No PDF or
  Word file to start from? Paste a ready-made prompt into any AI
  chatbot and it hands back something DraftShelf can import directly.
- **Exports that hold up.** Pagination never splits a bullet or an
  entry across a page break, and the live preview matches the export
  exactly, because it's rendered by an actual headless browser — real
  selectable text, not a screenshot. DOCX export is a second,
  independent path that opens cleanly in Word or Google Docs. A
  matching cover letter tool shares none of the resume's data model —
  it's a one-off by design, not something you build a library of.
- **Nothing gets lost by accident.** Undo/redo throughout, a save
  status that's always visible, a two-device-editing conflict banner
  instead of a silent overwrite, and a Trash for deleted versions
  instead of a permanent one-click delete.
- **Everywhere it needs to be.** Light and dark theme, real
  bookmarkable URLs with working back/forward, and a layout that holds
  up on a phone.

## Under the hood

Plain HTML, CSS, and JavaScript — no framework, no build step, no
bundler. Every script loads straight from a CDN or a local file in
dependency order, and the whole thing deploys by copying the folder
onto any static host. [Supabase](https://supabase.com) (Postgres +
Auth) is the backend, with row-level security doing the actual access
control rather than anything client-side; signing up is required, with
no local-only or guest fallback. PDF export runs server-side through a
small Python service driving headless Chromium, so exported resumes
carry real selectable text rather than a rasterized image. DOCX export
runs entirely client-side. The test suite is plain Node scripts — no
framework — mixing pure-function tests with jsdom-driven integration
tests that exercise the real UI.

---

Free to use, permanently — sign up with email/password, Google, or
GitHub, and everything you enter stays private to your account, synced
to every device you sign into.

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contact

For any queries or contributions, feel free to reach out to:

- **Ari Adaikalam** – [Email](mailto:ariadaikalam1234@gmail.com)

