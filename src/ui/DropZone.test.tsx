import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import DropZone from "./DropZone.js";

const field = (container: HTMLElement): HTMLElement => {
  const found = container.querySelector<HTMLElement>(".file-field");
  if (found === null) {
    throw new Error("the drop field is missing");
  }
  return found;
};

const drop = (target: HTMLElement, files: File[]) => {
  fireEvent.drop(target, { dataTransfer: { files } });
};

describe("DropZone", () => {
  it("marks the field while a file is over it and unmarks it on leave", () => {
    const { container } = render(<DropZone onFile={vi.fn()} />);
    const zone = field(container);

    expect(zone).not.toHaveClass("dragging");
    fireEvent.dragOver(zone);
    expect(zone).toHaveClass("dragging");
    // Leaving must clear it; a field stuck in the drag state after the pointer
    // has gone reads as a control waiting for input that will never arrive.
    fireEvent.dragLeave(zone);
    expect(zone).not.toHaveClass("dragging");
  });

  it("clears the drag marking when a file is dropped", () => {
    const { container } = render(<DropZone onFile={vi.fn()} />);
    const zone = field(container);

    fireEvent.dragOver(zone);
    drop(zone, [new File(["<score-partwise/>"], "a.musicxml")]);
    expect(zone).not.toHaveClass("dragging");
  });

  it("passes a dropped file on", () => {
    const onFile = vi.fn();
    const file = new File(["<score-partwise/>"], "dropped.musicxml");
    const { container } = render(<DropZone onFile={onFile} />);

    drop(field(container), [file]);
    expect(onFile).toHaveBeenCalledWith(file);
  });

  it("ignores a drop carrying no file", () => {
    const onFile = vi.fn();
    const { container } = render(<DropZone onFile={onFile} />);

    drop(field(container), []);
    expect(onFile).not.toHaveBeenCalled();
  });

  it("passes a file chosen through the input on", () => {
    const onFile = vi.fn();
    render(<DropZone onFile={onFile} />);
    const input = screen.getByLabelText(/choose a musicxml file/i);
    const file = new File(["<score-partwise/>"], "chosen.musicxml");

    fireEvent.change(input, { target: { files: [file] } });

    expect(onFile).toHaveBeenCalledWith(file);
  });

  it("ignores a change carrying no file", () => {
    const onFile = vi.fn();
    render(<DropZone onFile={onFile} />);

    fireEvent.change(screen.getByLabelText(/choose a musicxml file/i), { target: { files: [] } });

    expect(onFile).not.toHaveBeenCalled();
  });
});
