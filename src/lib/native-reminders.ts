import { Capacitor, type PermissionState } from "@capacitor/core";
import { LocalNotifications, type LocalNotificationSchema } from "@capacitor/local-notifications";
import { buildReminderPlan, type ReminderSettings, type ReminderTask } from "./reminder-plan";

const SOUND_CHANNEL_ID = "flow-day-reminders-sound-v2";
const SILENT_CHANNEL_ID = "flow-day-reminders-silent-v2";
const ACTION_TYPE_ID = "flow-day-reminder-actions";

export type NativeReminderReadiness = {
  supported: boolean;
  platform: string;
  permission: PermissionState | "unsupported";
  exactAlarm: PermissionState | "not-applicable" | "unsupported";
  pending: number;
  soundChannelReady: boolean;
};

export function isNativeReminderPlatform(): boolean {
  return typeof window !== "undefined" && Capacitor.isNativePlatform();
}

async function ensureAndroidChannels() {
  if (Capacitor.getPlatform() !== "android") return;
  const channels = await LocalNotifications.listChannels();
  const existing = new Set(channels.channels.map((channel) => channel.id));

  if (!existing.has(SOUND_CHANNEL_ID)) {
    await LocalNotifications.createChannel({
      id: SOUND_CHANNEL_ID,
      name: "Rappels Flow Day sonores",
      description: "Rappels sonores des tâches et du plan quotidien",
      sound: "flow_day_reminder.wav",
      importance: 5,
      visibility: 1,
      vibration: true,
      lights: true,
      lightColor: "#6366F1",
    });
  }

  if (!existing.has(SILENT_CHANNEL_ID)) {
    await LocalNotifications.createChannel({
      id: SILENT_CHANNEL_ID,
      name: "Rappels Flow Day silencieux",
      description: "Rappels sans son ni vibration",
      importance: 3,
      visibility: 1,
      vibration: false,
      lights: true,
      lightColor: "#6366F1",
    });
  }
}

async function ensureActionTypes() {
  await LocalNotifications.registerActionTypes({
    types: [
      {
        id: ACTION_TYPE_ID,
        actions: [
          { id: "open", title: "Ouvrir", foreground: true },
          { id: "snooze10", title: "Rappeler dans 10 min" },
        ],
      },
    ],
  });
}

async function androidExactAlarmGranted(): Promise<boolean> {
  if (Capacitor.getPlatform() !== "android") return true;
  const status = await LocalNotifications.checkExactNotificationSetting();
  return status.exact_alarm === "granted";
}

export async function getNativeReminderReadiness(): Promise<NativeReminderReadiness> {
  if (!isNativeReminderPlatform()) {
    return {
      supported: false,
      platform: "web",
      permission: "unsupported",
      exactAlarm: "unsupported",
      pending: 0,
      soundChannelReady: false,
    };
  }

  const platform = Capacitor.getPlatform();
  const permission = (await LocalNotifications.checkPermissions()).display;
  const exactAlarm =
    platform === "android"
      ? (await LocalNotifications.checkExactNotificationSetting()).exact_alarm
      : "not-applicable";
  const pending = (await LocalNotifications.getPending()).notifications.length;
  let soundChannelReady = platform !== "android";
  if (platform === "android") {
    const channels = await LocalNotifications.listChannels();
    soundChannelReady = channels.channels.some((channel) => channel.id === SOUND_CHANNEL_ID);
  }

  return { supported: true, platform, permission, exactAlarm, pending, soundChannelReady };
}

export async function requestNativeReminderPermission(): Promise<NativeReminderReadiness> {
  if (!isNativeReminderPlatform()) return getNativeReminderReadiness();
  const current = await LocalNotifications.checkPermissions();
  if (current.display !== "granted") await LocalNotifications.requestPermissions();
  await ensureAndroidChannels();
  await ensureActionTypes();
  return getNativeReminderReadiness();
}

export async function requestExactAlarmAccess(): Promise<NativeReminderReadiness> {
  if (!isNativeReminderPlatform() || Capacitor.getPlatform() !== "android") {
    return getNativeReminderReadiness();
  }
  const status = await LocalNotifications.checkExactNotificationSetting();
  if (status.exact_alarm !== "granted") {
    await LocalNotifications.changeExactNotificationSetting();
  }
  return getNativeReminderReadiness();
}

function nativeChannelId(sound: boolean) {
  if (Capacitor.getPlatform() !== "android") return undefined;
  return sound ? SOUND_CHANNEL_ID : SILENT_CHANNEL_ID;
}

function toNativeSchema(
  item: ReturnType<typeof buildReminderPlan>[number],
  allowWhileIdle: boolean,
): LocalNotificationSchema {
  if (item.kind === "daily") {
    return {
      id: item.id,
      title: item.title,
      body: item.body,
      schedule: {
        on: { hour: item.hour, minute: item.minute },
        repeats: true,
        allowWhileIdle,
      },
      sound: item.sound ? "flow_day_reminder.wav" : undefined,
      channelId: nativeChannelId(item.sound),
      actionTypeId: ACTION_TYPE_ID,
      interruptionLevel: item.sound ? "timeSensitive" : "passive",
      extra: { flowDayManaged: true, kind: "daily", url: "/today" },
    };
  }

  return {
    id: item.id,
    title: item.title,
    body: item.body,
    schedule: { at: item.at, allowWhileIdle },
    sound: item.sound ? "flow_day_reminder.wav" : undefined,
    channelId: nativeChannelId(item.sound),
    actionTypeId: ACTION_TYPE_ID,
    interruptionLevel: item.sound ? "timeSensitive" : "passive",
    extra: {
      flowDayManaged: true,
      kind: "task",
      taskId: item.taskId,
      url: "/today",
    },
  };
}

export async function syncNativeReminders(
  tasks: ReminderTask[],
  settings: ReminderSettings | null | undefined,
): Promise<{ scheduled: number; skipped: boolean; reason?: string }> {
  if (!isNativeReminderPlatform()) return { scheduled: 0, skipped: true, reason: "web" };

  const permission = await LocalNotifications.checkPermissions();
  if (permission.display !== "granted") {
    return { scheduled: 0, skipped: true, reason: "permission" };
  }

  await ensureAndroidChannels();
  await ensureActionTypes();

  const pending = await LocalNotifications.getPending();
  const managed = pending.notifications.filter(
    (notification) => notification.extra?.flowDayManaged === true,
  );
  if (managed.length > 0) {
    await LocalNotifications.cancel({
      notifications: managed.map((notification) => ({ id: notification.id })),
    });
  }

  const plan = buildReminderPlan(tasks, settings);
  if (plan.length === 0) return { scheduled: 0, skipped: false };

  const allowWhileIdle = await androidExactAlarmGranted();
  await LocalNotifications.schedule({
    notifications: plan.map((item) => toNativeSchema(item, allowWhileIdle)),
  });
  return { scheduled: plan.length, skipped: false };
}

export async function showNativeImmediateTestNotification(): Promise<void> {
  if (!isNativeReminderPlatform())
    throw new Error("Disponible uniquement dans l’application mobile");
  const ready = await requestNativeReminderPermission();
  if (ready.permission !== "granted") throw new Error("Permission de notification refusée");

  await LocalNotifications.schedule({
    notifications: [
      {
        id: 900_003,
        title: "🔔 Test immédiat Flow Day",
        body: "Si vous voyez ceci, les notifications Android fonctionnent.",
        sound: "flow_day_reminder.wav",
        channelId: nativeChannelId(true),
        actionTypeId: ACTION_TYPE_ID,
        interruptionLevel: "timeSensitive",
        extra: { flowDayManaged: false, kind: "diagnostic", url: "/settings" },
      },
    ],
  });
}

export async function scheduleNativeTestReminder(delaySeconds = 5): Promise<void> {
  if (!isNativeReminderPlatform())
    throw new Error("Disponible uniquement dans l’application mobile");
  const ready = await requestNativeReminderPermission();
  if (ready.permission !== "granted") throw new Error("Permission de notification refusée");

  const allowWhileIdle = await androidExactAlarmGranted();
  await LocalNotifications.schedule({
    notifications: [
      {
        id: 900_002,
        title: "🔔 Test Flow Day",
        body: allowWhileIdle
          ? "Le rappel local précis fonctionne."
          : "Le rappel local fonctionne en mode compatible Android.",
        schedule: {
          at: new Date(Date.now() + Math.max(2, delaySeconds) * 1000),
          allowWhileIdle,
        },
        sound: "flow_day_reminder.wav",
        channelId: nativeChannelId(true),
        actionTypeId: ACTION_TYPE_ID,
        interruptionLevel: "timeSensitive",
        extra: { flowDayManaged: true, kind: "test", url: "/settings" },
      },
    ],
  });
}

export async function installNativeReminderActionHandler(): Promise<() => Promise<void>> {
  if (!isNativeReminderPlatform()) return async () => {};

  const listener = await LocalNotifications.addListener(
    "localNotificationActionPerformed",
    async (event) => {
      const extra = event.notification.extra ?? {};
      if (event.actionId === "snooze10") {
        const allowWhileIdle = await androidExactAlarmGranted();
        await LocalNotifications.schedule({
          notifications: [
            {
              ...event.notification,
              id: Math.min(2_147_483_647, event.notification.id + 100_000_000),
              schedule: { at: new Date(Date.now() + 10 * 60_000), allowWhileIdle },
              extra: { ...extra, flowDayManaged: true, snoozed: true },
            },
          ],
        });
        return;
      }

      const url = typeof extra.url === "string" ? extra.url : "/today";
      if (typeof window !== "undefined" && window.location.pathname !== url) {
        window.location.assign(url);
      }
    },
  );

  return () => listener.remove();
}
