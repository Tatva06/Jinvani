import { create } from 'zustand';
import * as Notifications from 'expo-notifications';
import { storage } from './mmkvStorage';

const REMINDER_ENABLED_KEY = 'reminder-enabled';
const REMINDER_HOUR_KEY = 'reminder-hour';
const REMINDER_MINUTE_KEY = 'reminder-minute';
const REMINDER_NOTIFICATION_ID_KEY = 'reminder-notification-id';

const DEFAULT_HOUR = 8;
const DEFAULT_MINUTE = 0;

// Foreground presentation — without this, a notification that happens to
// fire while the app is already open wouldn't show anything (Expo's
// default handler suppresses foreground alerts unless you opt in).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

interface ReminderState {
  enabled: boolean;
  hour: number;
  minute: number;
  /** Set only right after a denied permission request, so the toggle UI
   * can show *why* it snapped back off instead of just silently failing.
   * Not persisted — it's a one-shot explanation, not settings state. */
  permissionDenied: boolean;
  loadReminder: () => void;
  /** Requests permission if needed; only actually enables (and persists)
   * on success. On denial, leaves `enabled` false and sets
   * `permissionDenied` — the toggle must never claim to be on when it
   * isn't. Passing `false` always succeeds (cancelling needs no
   * permission). */
  setEnabled: (enabled: boolean) => Promise<void>;
  /** Cancels whatever was scheduled and re-schedules at the new time —
   * never stacks a second scheduled notification alongside the old one. */
  setTime: (hour: number, minute: number) => Promise<void>;
}

async function cancelExisting(): Promise<void> {
  const id = storage.getString(REMINDER_NOTIFICATION_ID_KEY);
  if (id) {
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
    storage.remove(REMINDER_NOTIFICATION_ID_KEY);
  }
}

async function scheduleDaily(hour: number, minute: number): Promise<void> {
  await cancelExisting();
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Jinvani',
      body: "Your daily card is ready — today's scripture is waiting.",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
  storage.set(REMINDER_NOTIFICATION_ID_KEY, id);
}

export const useReminderStore = create<ReminderState>((set, get) => ({
  enabled: false,
  hour: DEFAULT_HOUR,
  minute: DEFAULT_MINUTE,
  permissionDenied: false,

  loadReminder: () => {
    set({
      enabled: storage.getBoolean(REMINDER_ENABLED_KEY) ?? false,
      hour: storage.getNumber(REMINDER_HOUR_KEY) ?? DEFAULT_HOUR,
      minute: storage.getNumber(REMINDER_MINUTE_KEY) ?? DEFAULT_MINUTE,
    });
  },

  setEnabled: async (enabled: boolean) => {
    if (!enabled) {
      await cancelExisting();
      storage.set(REMINDER_ENABLED_KEY, false);
      set({ enabled: false, permissionDenied: false });
      return;
    }

    const current = await Notifications.getPermissionsAsync();
    const granted = current.granted || (await Notifications.requestPermissionsAsync()).granted;
    if (!granted) {
      // Must reflect reality — never claim "enabled" when permission was
      // actually denied.
      set({ enabled: false, permissionDenied: true });
      return;
    }

    const { hour, minute } = get();
    await scheduleDaily(hour, minute);
    storage.set(REMINDER_ENABLED_KEY, true);
    set({ enabled: true, permissionDenied: false });
  },

  setTime: async (hour: number, minute: number) => {
    storage.set(REMINDER_HOUR_KEY, hour);
    storage.set(REMINDER_MINUTE_KEY, minute);
    set({ hour, minute });
    if (get().enabled) {
      await scheduleDaily(hour, minute);
    }
  },
}));
