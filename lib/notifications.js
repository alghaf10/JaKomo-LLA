// Local (on-device) daily reminder. No push, no APNs, no token storage.
import * as Notifications from 'expo-notifications';

// Show the reminder even when the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Stable id so we can cancel-and-reschedule rather than stack duplicates.
const DAILY_REMINDER_ID = 'daily-reminder';

// Bilingual copy: Spanish hook (the thing they're learning) + English support.
const REMINDER_TITLE = '¡Ándale! Cinco minutos de español te esperan.';
const REMINDER_BODY = 'Your five minutes of Spanish are waiting.';

// Request notification permission. Returns true if granted.
export async function requestPermission() {
  const { granted } = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true },
  });
  return granted;
}

// Schedule ONE repeating daily local notification at `hour`:00. Cancels any
// existing one first so changing the time never stacks reminders.
export async function scheduleDailyReminder(hour = 19) {
  await Notifications.cancelScheduledNotificationAsync(DAILY_REMINDER_ID).catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier: DAILY_REMINDER_ID,
    content: { title: REMINDER_TITLE, body: REMINDER_BODY },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute: 0,
    },
  });
}

export async function cancelDailyReminder() {
  await Notifications.cancelScheduledNotificationAsync(DAILY_REMINDER_ID).catch(() => {});
}
