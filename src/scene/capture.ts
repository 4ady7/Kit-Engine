let capture: (() => string | null) | null = null;

export function registerCapture(next: (() => string | null) | null) {
  capture = next;
}

export function captureViewport(): string | null {
  try {
    return capture ? capture() : null;
  } catch {
    return null;
  }
}
