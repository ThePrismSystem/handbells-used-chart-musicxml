import type { Assignment } from "./useChartSession.js";

interface NoteheadTableProps {
  readonly counts: ReadonlyMap<string, number>;
  readonly assignments: ReadonlyMap<string, Assignment>;
  readonly onAssign: (notehead: string, assignment: Assignment) => void;
}

const OPTIONS: readonly { readonly value: Assignment; readonly label: string }[] = [
  { value: "bells", label: "Bells" },
  { value: "chimes", label: "Handchimes" },
  { value: "smbs", label: "SMBs" },
  { value: "ignore", label: "Ignore" },
];

/** Highest count first, so a large count stranded in Ignore is easy to spot. */
function sortedHeads(counts: ReadonlyMap<string, number>): [string, number][] {
  return [...counts].sort(
    ([aHead, aCount], [bHead, bCount]) => bCount - aCount || aHead.localeCompare(bHead),
  );
}

export function NoteheadTable({ counts, assignments, onAssign }: NoteheadTableProps) {
  const rows = sortedHeads(counts);

  return (
    <section className="panel notehead-panel">
      <p className="eyebrow">Noteheads Found</p>
      {rows.length === 0 ? (
        <p>No notes were found in this file.</p>
      ) : (
        <table aria-label="Notehead assignments">
          <thead>
            <tr>
              <th scope="col">Notehead</th>
              <th scope="col">Count</th>
              <th scope="col">Assign to</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([head, count]) => (
              <tr key={head}>
                <td className="mono">{head}</td>
                <td className="mono count">{count}</td>
                <td>
                  <div
                    className="assign-group"
                    role="radiogroup"
                    aria-label={`Assign notehead "${head}"`}
                  >
                    {OPTIONS.map((option) => (
                      <label key={option.value}>
                        <input
                          type="radio"
                          name={`notehead-${head}`}
                          value={option.value}
                          checked={(assignments.get(head) ?? "ignore") === option.value}
                          onChange={() => {
                            onAssign(head, option.value);
                          }}
                        />
                        {option.label}
                      </label>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
