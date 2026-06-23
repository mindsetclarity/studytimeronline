/**
 * Notification helpers — permission-gated, silent no-op if unsupported.
 */

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function notificationPermission(): NotificationPermission | null {
  if (!notificationsSupported()) return null;
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | null> {
  if (!notificationsSupported()) return null;
  if (Notification.permission === "granted") return "granted";
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export function showNotification(title: string, body?: string): void {
  if (!notificationsSupported() || Notification.permission !== "granted") return;
  try {
    const n = new Notification(title, {
      body,
      silent: false,
    });
    // Auto-close after 6s to avoid lingering
    setTimeout(() => n.close(), 6000);
  } catch {
    // ignore
  }
}
