import type { SlideAdapter } from "../../src/renderers";

export interface SlideCall {
  kind: "text" | "shape" | "image" | "table";
  payload: unknown;
}

export class MockSlide implements SlideAdapter {
  public readonly calls: SlideCall[] = [];

  public addText(text: string | Array<{ text: string; options?: Record<string, unknown> }>, options?: Record<string, unknown>): void {
    this.calls.push({
      kind: "text",
      payload: { text, options }
    });
  }

  public addShape(shapeName: string, options: Record<string, unknown>): void {
    this.calls.push({
      kind: "shape",
      payload: { shapeName, options }
    });
  }

  public addImage(options: Record<string, unknown>): void {
    this.calls.push({
      kind: "image",
      payload: { options }
    });
  }

  public addTable(rows: Array<Array<string | number>>, options: Record<string, unknown>): void {
    this.calls.push({
      kind: "table",
      payload: { rows, options }
    });
  }

  public count(kind: SlideCall["kind"]): number {
    return this.calls.filter((call) => call.kind === kind).length;
  }
}

export class MockPresentation {
  public readonly slides: MockSlide[] = [];

  public addSlide(): MockSlide {
    const slide = new MockSlide();
    this.slides.push(slide);
    return slide;
  }
}
