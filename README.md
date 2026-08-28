# handbells-used-chart-musicxml

Builds a **handbells / handchimes / silver melody bells used chart** from a
MusicXML score, in the browser. Upload a file, check what it read, download the
chart.

## Why this exists

Sibling plugins already do this inside [MuseScore][musescore-ext] and Sibelius.
Dorico cannot have one: it has no plugin API, and its scripting language cannot
iterate over a score, so counting the notes an arrangement uses is not something
a Dorico script can do at all. Working on the file instead of inside the
application sidesteps that — and covers any notation program that can export and
import MusicXML.

## What you get back

Two targets, because two applications want the chart delivered differently.

**Dorico** gets the chart as **its own small MusicXML file, plus a Lua setup
script** — and never sees your score again. A used chart is made once the piece
is finished, so re-importing the whole score would throw away the engraving you
have already done. Instead:

1. Export your score as MusicXML. Leave the Dorico project open and untouched.
2. Upload that export here and download the two files.
3. In your project, `File > Import > MusicXML`, pick the chart file, and choose
   **Create All New Players**. It arrives as a new flow.
4. Drag the chart flow to the top of the Flows panel in Setup mode.
5. Run the setup script: `Script > Run Script`.

Your score is read, never written. The chart is a new file that stands alone.

**Generic MusicXML** gets the old behaviour: your score back with the chart
inserted at the front, as one file. Right for any application without Dorico's
flows, and wrong for Dorico, where the round trip costs you your layout.

## The score never leaves your browser

Every step — parsing, planning, building the chart, repackaging — runs as
JavaScript on your own machine. Your file is never uploaded, never stored, and
there is no backend that could receive it.

This is deliberate. People run tools like this on other people's copyrighted
arrangements, and that deserves saying plainly rather than burying in a privacy
policy.

The one thing the page does send is Vercel Web Analytics and Speed Insights: a
page view, and the loading timings the browser measures for itself. Both go to a
`/_vercel` endpoint on this same origin, neither sets a cookie, and neither
carries your file, its name, or anything read out of it. Open your browser's
network tab and that is all you will find alongside the page's own assets.

## Accepted formats

In: `.musicxml`, `.xml`, and `.mxl` (the zipped container).

Out: the Dorico target writes plain `.musicxml`, since the chart is a new file
rather than yours. The generic target returns your score in the format it
arrived in.

## What it charts

Three charts, each drawn from a notehead:

| Chart               | Default notehead  |
| ------------------- | ----------------- |
| Handbells           | `normal`          |
| Handchimes          | `diamond`         |
| Silver melody bells | `la` and `square` |

`la` and `square` both mean a silver melody bell because MuseScore's palette has
no notehead called "Square" — its filled square is the shape-note head La, while
other applications write a plain square.

**Any notehead can be reassigned.** The review panel lists the noteheads actually
found in your file with a count for each, so an arranger who writes chimes as `x`
sees that immediately instead of wondering why the chime chart came out empty.
Heads you assign to nothing are left off, and the app says how many notes that
was.

The chart always draws the canonical notehead for its kind, whatever the score
used. A chart of chimes written as `x` still prints diamonds.

## Octave convention

MusicXML stores _written_ pitch, and a handbell's name is its written pitch plus
one octave — a bell named C6 is written C5 on the treble staff. Scores disagree
about this: some are written for the bells, some are written at sounding pitch.

The app infers the convention per part from the instrument sound and any
`<transpose>` element, tells you which it chose and why, and lets you override it
per part. Getting this wrong shifts the entire chart by an octave, which is why it
is shown rather than assumed.

The chart itself is written under an 8va clef, so a bell's notehead sits where the
score writes the same note. What `<pitch>` has to carry to land it there depends
on the target: MusicXML's own reading is the written pitch, which is what the
generic target emits, while Dorico lowers a notehead by the clef's octave change
and so is handed the bell's own pitch instead.

## Known limitations

- **The setup script cannot yet make two of the settings it needs.** Dorico's
  MusicXML import discards layout and re-engraves, so the chart file cannot
  carry any of it — that is what the script is for. Two of its settings have no
  documented command, and both are in Layout Options → Page Setup → Flows:
  _Allow on existing page_, without which the music starts on its own page
  instead of continuing under the chart; and _Show Flow Headings → Never_, since
  going from one flow to two can print a heading above your music that was never
  there. Set them by hand, or record them with Script → Start Recording Script
  and paste the result into the script. Guessing the option keys would produce a
  script that looked like it worked and silently did nothing.
- **Chart staves may need hiding in applications that insert.** For the generic
  target the chart parts run empty through the piece, and
  `<staff-details print-object="no">` asks for them to be hidden — but honouring
  it is the importer's choice. Dorico does not, which is one of the reasons its
  target no longer inserts at all.
- **Dorico ignores `<staff-size>`.** The chart staves come in at the same size as
  the music. The Dorico target no longer asks for a smaller one; set it in Dorico
  instead (Layout Options → Players → Staff size) if you want the chart reduced.
- **Dorico restates a cancelling natural in the bar after an accidental.** A
  chart holding both Eb6 and E6 prints a natural on the E. The Dorico target
  gives each bell a bar of its own, which turns that from a same-bar
  cancellation — which no engraver can suppress — into Dorico's own next-bar
  restatement, and that one is a setting: Notation Options → Accidentals →
  Restatement of accidentals.
- **A chart round-tripped through another application may lose its markers.** The
  chart is marked with a `<miscellaneous-field>` and a part name. If an
  application drops both on re-export, a re-run will not recognise the existing
  chart and will add a second one. Delete the old chart by hand if that happens.
- **The octave convention is a guess on parts that carry no signal.** The app
  tells you when it is guessing, and you can correct it.
- **Required ranges are not supported yet.** Published charts bracket the bells
  outside a piece's required range as optional; there is currently no way to tell
  this tool what that range is, so every bell it finds is charted the same way.

## Licence

Proprietary — copyright ThePrismSystem, all rights reserved. See [LICENSE](LICENSE).
This repository is public for transparency; publication is not an offer of licence
terms.

The two bundled typefaces are the exception: Spectral and IBM Plex Mono are the
work of their own authors, redistributed under the SIL Open Font License 1.1.
Their licences and attribution are in
[`public/fonts/`](public/fonts/README.md).

[musescore-ext]: https://github.com/ThePrismSystem/handbells-used-chart-musescore-extension

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) v24+
- [pnpm](https://pnpm.io/)

```bash
pnpm install
pnpm dev
```

### Scripts

| Command              | Description                                 |
| -------------------- | ------------------------------------------- |
| `pnpm dev`           | Start the Vite dev server                   |
| `pnpm build`         | Build for production                        |
| `pnpm preview`       | Preview the production build                |
| `pnpm lint`          | Run ESLint                                  |
| `pnpm lint:fix`      | Run ESLint with auto-fix                    |
| `pnpm typecheck`     | Run TypeScript type checking                |
| `pnpm format`        | Check formatting with Prettier              |
| `pnpm format:fix`    | Fix formatting with Prettier                |
| `pnpm test`          | Run all tests                               |
| `pnpm test:coverage` | Run tests with coverage                     |
| `pnpm test:watch`    | Run tests in watch mode                     |
| `pnpm test:a11y`     | Run the built-page accessibility scan       |
| `pnpm knip`          | Find unused files, exports and dependencies |
| `pnpm spell`         | Spell-check                                 |

### Pinned dependencies

Two packages are deliberately held below their latest release.

- **`typescript` is pinned `~6.0.3`.** The tilde is load-bearing:
  `typescript-eslint` declares a peer of `>=4.8.4 <6.1.0` and has no newer
  major line, so `^6.0.3` would admit 6.1.0 and break the peer.
- **`@types/node` tracks `.nvmrc`** (Node 24 Active LTS), not its own latest.
  Typing against Node 26 APIs while running Node 24 produces code that compiles
  and then fails at runtime.

`renovate.json` enforces both.
