import { DEFAULT_LABEL } from "../core/plan.js";
import { TARGETS } from "../targets/profiles.js";

import type { ChartSettings } from "./useChartSession.js";
import type { ChartPlan } from "../core/plan.js";
import type { ChartKind } from "../core/types.js";

interface OptionsPanelProps {
  readonly settings: ChartSettings;
  readonly plan: ChartPlan | null;
  readonly onChange: (settings: Partial<ChartSettings>) => void;
}

/** The plan already carries the generated label whenever no override is set. */
function placeholderFor(plan: ChartPlan | null, kind: ChartKind): string {
  return plan?.sections.find((section) => section.kind === kind)?.label ?? DEFAULT_LABEL[kind];
}

export function OptionsPanel({ settings, plan, onChange }: OptionsPanelProps) {
  return (
    <section className="panel options-panel">
      <h2 className="eyebrow">Chart Options</h2>

      <div className="field">
        <label htmlFor="bell-label">Handbells label</label>
        <input
          id="bell-label"
          type="text"
          value={settings.bellLabel}
          placeholder={placeholderFor(plan, "bells")}
          onChange={(event) => {
            onChange({ bellLabel: event.target.value });
          }}
        />
      </div>

      <div className="field">
        <label htmlFor="chime-label">Handchimes label</label>
        <input
          id="chime-label"
          type="text"
          value={settings.chimeLabel}
          placeholder={placeholderFor(plan, "chimes")}
          onChange={(event) => {
            onChange({ chimeLabel: event.target.value });
          }}
        />
      </div>

      <div className="field">
        <label htmlFor="smb-label">SMBs label</label>
        <input
          id="smb-label"
          type="text"
          value={settings.smbLabel}
          placeholder={placeholderFor(plan, "smbs")}
          onChange={(event) => {
            onChange({ smbLabel: event.target.value });
          }}
        />
      </div>

      <div className="field">
        <label htmlFor="chime-color">Handchimes colour</label>
        <input
          id="chime-color"
          type="color"
          className="swatch"
          value={settings.chimeColor === "" ? "#000000" : settings.chimeColor}
          onChange={(event) => {
            onChange({ chimeColor: event.target.value });
          }}
        />
      </div>

      <div className="field">
        <label htmlFor="smb-color">SMB colour</label>
        <input
          id="smb-color"
          type="color"
          className="swatch"
          value={settings.smbColor === "" ? "#000000" : settings.smbColor}
          onChange={(event) => {
            onChange({ smbColor: event.target.value });
          }}
        />
      </div>

      <div className="field checkbox-field">
        <label htmlFor="smbs-optional">
          <input
            id="smbs-optional"
            type="checkbox"
            checked={settings.smbsOptional}
            onChange={(event) => {
              onChange({ smbsOptional: event.target.checked });
            }}
          />
          SMBs are optional
        </label>
      </div>

      <div className="field">
        <label htmlFor="target">Target application</label>
        <select
          id="target"
          value={settings.targetId}
          onChange={(event) => {
            onChange({ targetId: event.target.value });
          }}
        >
          {TARGETS.map((target) => (
            <option key={target.id} value={target.id}>
              {target.label}
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}
