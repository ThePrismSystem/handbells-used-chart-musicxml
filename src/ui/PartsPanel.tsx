import type { OctaveConvention } from "../core/types.js";
import type { PartInfo } from "../musicxml/read.js";

interface PartsPanelProps {
  readonly parts: readonly PartInfo[];
  readonly conventions: ReadonlyMap<string, OctaveConvention>;
  readonly onChange: (partId: string, convention: OctaveConvention) => void;
}

const CONVENTIONS: readonly { readonly value: OctaveConvention; readonly label: string }[] = [
  { value: "written-octave-below", label: "Written one octave below sounding pitch" },
  { value: "at-bell-name", label: "Already sounding at bell name" },
];

export function PartsPanel({ parts, conventions, onChange }: PartsPanelProps) {
  return (
    <section className="panel parts-panel">
      <p className="eyebrow">Parts Read</p>
      {parts.map((part) => {
        const convention = conventions.get(part.id) ?? part.convention;
        return (
          <fieldset key={part.id} className="part">
            <legend>{part.name}</legend>
            <p className="reason">{part.reason}</p>
            <p className="meta">
              <span className="mono">{part.noteCount}</span> note{part.noteCount === 1 ? "" : "s"}{" "}
              read
            </p>
            <div className="convention-options">
              {CONVENTIONS.map((option) => (
                <label key={option.value}>
                  <input
                    type="radio"
                    name={`convention-${part.id}`}
                    value={option.value}
                    checked={convention === option.value}
                    onChange={() => {
                      onChange(part.id, option.value);
                    }}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>
        );
      })}
    </section>
  );
}
