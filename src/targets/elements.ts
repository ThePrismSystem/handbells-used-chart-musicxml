/** Creates an element, with optional text and attributes. A null attribute value is skipped. */
export function el(
  doc: Document,
  name: string,
  text?: string,
  attrs?: Readonly<Record<string, string | null>>,
): Element {
  const element = doc.createElement(name);
  if (text !== undefined) {
    element.textContent = text;
  }
  for (const [key, value] of Object.entries(attrs ?? {})) {
    if (value !== null) {
      element.setAttribute(key, value);
    }
  }
  return element;
}
