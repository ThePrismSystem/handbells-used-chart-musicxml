import { useState } from "react";

import type { ChangeEvent, DragEvent } from "react";

const ACCEPT = ".musicxml,.xml,.mxl";

interface DropZoneProps {
  readonly onFile: (file: File) => void;
}

/**
 * The real route in is the file input; dragging a file onto the field is a
 * decoration on top of it, never a replacement — a keyboard user must be
 * able to reach the same input and its label.
 */
export function DropZone({ onFile }: DropZoneProps) {
  const [dragging, setDragging] = useState(false);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFile(file);
    }
    // Clears the value so choosing the same file again still fires a change.
    event.target.value = "";
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => {
    setDragging(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) {
      onFile(file);
    }
  };

  return (
    <div
      className={dragging ? "field file-field dragging" : "field file-field"}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <label htmlFor="file-input">Choose a MusicXML file</label>
      <input id="file-input" type="file" accept={ACCEPT} onChange={handleChange} />
      <p className="hint mono">Accepts .musicxml, .xml or .mxl files.</p>
    </div>
  );
}
