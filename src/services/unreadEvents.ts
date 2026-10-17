const listeners = new Set<() => void>();
export function notifyUnreadChanged() {
  listeners.forEach((listener) => listener());
}
export function onUnreadChanged(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
