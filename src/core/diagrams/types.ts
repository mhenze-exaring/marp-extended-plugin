/**
 * Diagram renderer interface
 *
 * Implementations can use browser APIs (mermaid.js) or CLI tools (mmdc, plantuml.jar)
 */
export interface DiagramRenderer {
  /**
   * Render diagram code to SVG string
   */
  render(code: string): Promise<string>;

  /**
   * Initialize the renderer (if needed)
   */
  initialize?(): Promise<void>;

  /**
   * Cleanup resources
   */
  destroy?(): void;
}
