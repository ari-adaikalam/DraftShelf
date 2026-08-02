# ResumIT

**A resume builder for people who apply to more than one job.**

## The problem

Tailoring a resume for each application usually means one of two things:
keeping a single "master" resume that's either too generic to be
competitive or slowly turning into an unreadable pile of everything
you've ever done, or manually copy-pasting sections between a dozen
slightly different Word files and hoping you didn't leave an old job
title in there by accident. Neither scales past a handful of
applications, and both make it easy to send out a resume with a typo
or a stale bullet point you meant to cut months ago.

## The idea

ResumIT splits a resume into two layers instead of one:

- **Library** — every job, project, degree, skill category, summary,
  and reference you've ever had, written once. Each entry can carry
  several bullet points, and every bullet is written once, kept
  up to date in one place, and never duplicated by hand.
- **Version** — a resume tailored to one specific job is just a
  *selection* from the Library: which entries to include, which
  bullets under each one, what order they print in, plus that job's
  own title, dates-applied, and job-description text. Nothing gets
  copy-pasted; a version just points at the parts of the Library it
  wants.

Editing a bullet in the Library updates it everywhere that bullet is
used. Tailoring a new version takes a few checkbox clicks, not a
rewrite. Because it's a real database (not a spreadsheet or a folder
of files), it's also usable from your phone, laptop, or a friend's
computer — sign in and your data is there.

## What it does

- **Real pagination** — resumes lay out across pages the way a
  properly typeset document should: an entry or a bullet is never
  split across a page break, section headings are never left stranded
  alone at the bottom of a page, and the live preview always matches
  what actually gets exported.
- **Exports that pass an ATS** — PDF export renders server-side
  through a real headless browser, so the output is genuine selectable
  text (including clickable links), not a screenshot glued into a PDF
  wrapper. DOCX export is a second, independent output built as a real
  Word document, so it opens and edits cleanly in Word or Google Docs
  too.
- **Per-version overrides** — need to tweak one bullet's wording for a
  single application without changing it everywhere else? Every field
  can be overridden for just that one version, without ever touching
  the shared Library entry.
- **A style panel, not a fixed template** — fonts, sizes, spacing,
  margins, page size, and bullet style are all adjustable per version
  (or set once as your account default for every new version),
  without needing to know CSS or touch a template file.
- **Job-description keyword matching** — paste a job posting in and
  see which of its key terms already show up in your tailored resume,
  and which don't.
- **Optional GitHub backup** — a one-way, push-only mirror of your
  data to a GitHub repo of your choosing, entirely separate from the
  primary account data.

## Cover letters, too

A resume answers "what have you done"; a cover letter answers "why
this job." ResumIT includes a lightweight cover letter tool alongside
the resume builder, built for the same one-tailored-document-per-job
workflow:

- Your name and contact details pre-fill automatically from your
  Library, so you're not retyping them — but they're independently
  editable per letter, so tweaking one for a specific application
  never touches your saved account data.
- Three typographic looks — Modern, Classic, Minimal — pick whichever
  fits the tone of the letter, no design work required.
- A cover letter is always exactly one page, by design — there's no
  pagination to fight, just write and it fits.
- Exports as a real PDF with genuine, selectable text, drawn directly
  rather than produced from a screenshot, so it looks and behaves like
  any normal document you'd send.
- Deliberately not saved to your account the way resumes are — a
  cover letter is a one-off for a single application, not something
  you build up and reuse in a library, so it stays only for the
  current session and is never synced or stored.

## How it's built

No framework and no build step — the whole app is plain HTML, CSS,
and JavaScript loaded directly by the browser, deployable by dragging
a folder onto any static host. The backend is Supabase (Postgres +
Auth), with row-level security as the actual access-control boundary
rather than anything enforced client-side. PDF generation runs as a
small server-side service using headless Chromium so the exported
file is a first-class document, not an image — with a second,
independent fallback host so a single provider's outage doesn't take
export down entirely. Everything ships with an automated test suite
that exercises the app end to end, not just its individual functions.

## Try it

`https://ariharasudhan.com/resumit/`

Sign-up is required (there's no local-only mode — your data lives in
your own account, synced across devices from the start).


## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contact

For any queries or contributions, feel free to reach out to:

- **Ari Adaikalam** – [Email](mailto:ariadaikalam1234@gmail.com)
