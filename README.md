# handbells-used-chart-musicxml

Adds a **handbells / handchimes / silver melody bells used chart** to a MusicXML
score, in the browser. Upload a file, check what it read, download the score with
the chart inserted.

## Why this exists

Sibling plugins already do this inside [MuseScore][musescore-ext] and Sibelius.
Dorico cannot have one: it has no plugin API, and its scripting language cannot
iterate over a score, so counting the notes an arrangement uses is not something
a Dorico script can do at all. Working on the file instead of inside the
application sidesteps that — and covers any notation program that can export and
import MusicXML.

## The score never leaves your browser

Every step — parsing, planning, inserting the chart, repackaging — runs as
JavaScript on your own machine. Nothing is uploaded, nothing is stored, and there
is no backend to send it to. Open your browser's network tab while you use it and
you will see nothing leave the page.

This is deliberate. People run tools like this on other people's copyrighted
arrangements, and that deserves saying plainly rather than burying in a privacy
policy.

## Accepted formats

`.musicxml`, `.xml`, and `.mxl` (the zipped container). The file comes back out in
the format it went in.

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

## Known limitations

- **Hidden chart staves depend on the importing application.**
  `<staff-details print-object="no">` is documented for exactly this purpose, but
  honouring it is the importer's choice. Where an application ignores it, turn on
  that application's own hide-empty-staves setting.
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
