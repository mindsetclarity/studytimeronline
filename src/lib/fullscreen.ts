/**
 * Fullscreen helpers — graceful fallback across vendor prefixes and Safari.
 * Returns whether the request actually succeeded.
 */

export function isFullscreen(): boolean {
  return Boolean(
    document.fullscreenElement ||
      (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement,
  );
}

export async function requestFullscreen(el: Element): Promise<boolean> {
  try {
    const anyEl = el as Element & {
      requestFullscreen?: () => Promise<void>;
      webkitRequestFullscreen?: () => Promise<void> | void;
    };
    if (anyEl.requestFullscreen) {
      await anyEl.requestFullscreen();
      return true;
    }
    if (anyEl.webkitRequestFullscreen) {
      await Promise.resolve(anyEl.webkitRequestFullscreen());
      return true;
    }
  } catch {
    // user cancelled or unsupported
  }
  return false;
}

export async function exitFullscreen(): Promise<void> {
  try {
    const anyDoc = document as Document & {
      webkitExitFullscreen?: () => Promise<void> | void;
    };
    if (document.exitFullscreen && isFullscreen()) {
      await document.exitFullscreen();
    } else if (anyDoc.webkitExitFullscreen && isFullscreen()) {
      await Promise.resolve(anyDoc.webkitExitFullscreen());
    }
  } catch {
    // ignore
  }
}

/** Toggle fullscreen on an element. Returns the resulting state. */
export async function toggleFullscreen(el: Element): Promise<boolean> {
  if (isFullscreen()) {
    await exitFullscreen();
    return false;
  }
  return requestFullscreen(el);
}
