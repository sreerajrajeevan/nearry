import { isDemoBlockedMessage, leaveDemoNow } from "./demoMessage";

export type AppAlertButton = {
  text?: string;
  style?: "default" | "cancel" | "destructive";
  onPress?: () => void;
};

export type AppAlertOptions = {
  cancelable?: boolean;
  onDismiss?: () => void;
};

export type AppAlert = {
  readonly id: number;
  readonly title: string;
  readonly message?: string;
  readonly buttons: readonly AppAlertButton[];
  readonly options: AppAlertOptions;
};

/** A single app-level queue survives navigation and never replaces a pending confirmation. */
export function createAppAlertQueue() {
  let nextId = 0;
  let queue: AppAlert[] = [];
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((listener) => listener());
  const take = (id: number) => {
    if (queue[0]?.id !== id) return null;
    const [current, ...rest] = queue;
    queue = rest;
    emit();
    return current;
  };
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => queue[0] ?? null,
    alert(
      title: string,
      message?: string,
      buttons?: AppAlertButton[],
      options: AppAlertOptions = {},
    ) {
      // Any demo-blocked action shows one consistent prompt, never twice in a row.
      if (isDemoBlockedMessage(message)) {
        if (queue.some((a) => isDemoBlockedMessage(a.message))) return;
        title = "You're in the demo";
        buttons = [
          { text: "Keep exploring", style: "cancel" },
          { text: "Create account", onPress: leaveDemoNow },
        ];
        options = { cancelable: true };
      }
      queue = [
        ...queue,
        {
          id: ++nextId,
          title,
          message,
          buttons: buttons?.length
            ? buttons.map((button) => ({ ...button }))
            : [{ text: "Got it" }],
          options: { ...options },
        },
      ];
      emit();
    },
    choose(id: number, index: number) {
      const current = queue[0];
      if (current?.id !== id || !current.buttons[index]) return;
      // Remove before calling back: navigation and follow-up alerts are safe, and double taps are inert.
      take(id)?.buttons[index].onPress?.();
    },
    dismiss(id: number) {
      if (queue[0]?.id !== id || !queue[0].options.cancelable) return;
      take(id)?.options.onDismiss?.();
    },
  };
}

export const appAlerts = createAppAlertQueue();
// Explicit imports replace native Alert; the platform's Alert implementation is never patched.
export const Alert = { alert: appAlerts.alert };
