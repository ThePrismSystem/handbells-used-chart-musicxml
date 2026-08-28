import { useCallback, useMemo, useState } from "react";

import { DEFAULT_HEAD_MAPPING } from "../core/collect.js";
import { chartFilename, loadFile, outputFilename, saveFile } from "../musicxml/container.js";
import { parseScore } from "../musicxml/document.js";
import { readScore } from "../musicxml/read.js";
import { buildChart, defaultConventions, planFor } from "../pipeline.js";
import DORICO_SETUP_LUA from "../targets/dorico-setup.lua?raw";

import type { HeadMapping } from "../core/collect.js";
import type { ChartPlan } from "../core/plan.js";
import type { ChartKind, OctaveConvention } from "../core/types.js";
import type { LoadedFile } from "../musicxml/container.js";
import type { ParsedScore } from "../musicxml/document.js";
import type { ReadResult } from "../musicxml/read.js";

export type Assignment = ChartKind | "ignore";

export interface ChartSettings {
  readonly bellLabel: string;
  readonly chimeLabel: string;
  readonly smbLabel: string;
  readonly chimeColor: string;
  readonly smbColor: string;
  readonly smbsOptional: boolean;
  readonly targetId: string;
}

const DEFAULT_SETTINGS: ChartSettings = {
  bellLabel: "",
  chimeLabel: "",
  smbLabel: "",
  chimeColor: "",
  smbColor: "",
  smbsOptional: false,
  targetId: "dorico",
};

export interface ChartSession {
  readonly status: "empty" | "ready" | "error";
  readonly fileName: string | null;
  readonly error: string | null;
  readonly read: ReadResult | null;
  readonly plan: ChartPlan | null;
  readonly assignments: ReadonlyMap<string, Assignment>;
  readonly conventions: ReadonlyMap<string, OctaveConvention>;
  readonly settings: ChartSettings;
  loadFile: (file: File) => Promise<void>;
  assign: (notehead: string, assignment: Assignment) => void;
  setConvention: (partId: string, convention: OctaveConvention) => void;
  update: (settings: Partial<ChartSettings>) => void;
  buildDownloads: () => readonly ChartDownload[];
  reset: () => void;
}

export interface ChartDownload {
  readonly filename: string;
  readonly blob: Blob;
  /** What the button says. */
  readonly label: string;
  /** One line telling the user what this file is for. */
  readonly hint: string;
}

const SETUP_SCRIPT_NAME = "dorico-chart-setup.lua";

interface Loaded {
  readonly source: LoadedFile;
  readonly parsed: ParsedScore;
  readonly read: ReadResult;
  readonly fileName: string;
}

/** Seeds from the heads actually present, so the panel leads with this file. */
function seedAssignments(read: ReadResult): Map<string, Assignment> {
  return new Map(
    [...read.noteheadCounts.keys()].map((head) => [
      head,
      DEFAULT_HEAD_MAPPING.get(head) ?? "ignore",
    ]),
  );
}

function toHeadMapping(assignments: ReadonlyMap<string, Assignment>): HeadMapping {
  const mapping = new Map<string, ChartKind>();
  for (const [head, assignment] of assignments) {
    if (assignment !== "ignore") {
      mapping.set(head, assignment);
    }
  }
  return mapping;
}

const blank = (value: string): string | undefined => (value.trim() === "" ? undefined : value);

export function useChartSession(): ChartSession {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<ReadonlyMap<string, Assignment>>(new Map());
  const [conventions, setConventions] = useState<ReadonlyMap<string, OctaveConvention>>(new Map());
  const [settings, setSettings] = useState<ChartSettings>(DEFAULT_SETTINGS);

  const load = useCallback(async (file: File): Promise<void> => {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const source = loadFile(bytes, file.name);
      const parsed = parseScore(source.xml);
      const read = readScore(parsed.doc);
      setLoaded({ source, parsed, read, fileName: file.name });
      setAssignments(seedAssignments(read));
      setConventions(defaultConventions(read));
      setError(null);
    } catch (cause) {
      setLoaded(null);
      setError(cause instanceof Error ? cause.message : "This file could not be read.");
    }
  }, []);

  const options = useMemo(
    () => ({
      headMapping: toHeadMapping(assignments),
      conventions,
      targetId: settings.targetId,
      bellLabel: blank(settings.bellLabel),
      chimeLabel: blank(settings.chimeLabel),
      smbLabel: blank(settings.smbLabel),
      chimeColor: blank(settings.chimeColor),
      smbColor: blank(settings.smbColor),
      smbsOptional: settings.smbsOptional,
    }),
    [assignments, conventions, settings],
  );

  const plan = useMemo(
    () => (loaded === null ? null : planFor(loaded.read, options)),
    [loaded, options],
  );

  const buildDownloads = useCallback((): readonly ChartDownload[] => {
    if (loaded === null || plan === null) {
      return [];
    }
    const output = buildChart(loaded.parsed, plan, settings.targetId);
    if (output === null) {
      return [];
    }

    if (output.kind === "flow") {
      // Two files, because the chart and the layout it needs travel by
      // different routes: one is imported, the other is run.
      return [
        {
          filename: chartFilename(loaded.fileName),
          blob: new Blob([output.xml], { type: "application/vnd.recordare.musicxml+xml" }),
          label: "Download the chart",
          hint: "Import into your score as a new flow.",
        },
        {
          filename: SETUP_SCRIPT_NAME,
          blob: new Blob([DORICO_SETUP_LUA], { type: "text/plain" }),
          label: "Download the setup script",
          hint: "Run in Dorico once the chart is in.",
        },
      ];
    }

    return [
      {
        filename: outputFilename(loaded.fileName),
        blob: new Blob([new Uint8Array(saveFile(output.xml, loaded.source))], {
          type:
            loaded.source.kind === "mxl"
              ? "application/vnd.recordare.musicxml"
              : "application/vnd.recordare.musicxml+xml",
        }),
        label: "Download the chart",
        hint: "Your score with the chart added.",
      },
    ];
  }, [loaded, plan, settings.targetId]);

  return {
    status: error !== null ? "error" : loaded === null ? "empty" : "ready",
    fileName: loaded?.fileName ?? null,
    error,
    read: loaded?.read ?? null,
    plan,
    assignments,
    conventions,
    settings,
    loadFile: load,
    assign: useCallback((notehead, assignment) => {
      setAssignments((previous) => new Map(previous).set(notehead, assignment));
    }, []),
    setConvention: useCallback((partId, convention) => {
      setConventions((previous) => new Map(previous).set(partId, convention));
    }, []),
    update: useCallback((partial) => {
      setSettings((previous) => ({ ...previous, ...partial }));
    }, []),
    buildDownloads,
    reset: useCallback(() => {
      setLoaded(null);
      setError(null);
      setAssignments(new Map());
      setConventions(new Map());
      setSettings(DEFAULT_SETTINGS);
    }, []),
  };
}
