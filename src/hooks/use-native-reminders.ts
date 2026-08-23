import { useCallback, useEffect, useState } from "react";
import {
  getNativeReminderReadiness,
  installNativeReminderActionHandler,
  isNativeReminderPlatform,
  requestExactAlarmAccess,
  requestNativeReminderPermission,
  scheduleNativeTestReminder,
  type NativeReminderReadiness,
} from "@/lib/native-reminders";

const initialState: NativeReminderReadiness = {
  supported: false,
  platform: "web",
  permission: "unsupported",
  exactAlarm: "unsupported",
};

export function useNativeReminders() {
  const [readiness, setReadiness] = useState<NativeReminderReadiness>(initialState);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const next = await getNativeReminderReadiness();
    setReadiness(next);
    return next;
  }, []);

  useEffect(() => {
    if (!isNativeReminderPlatform()) return;
    void refresh();
    let remove: (() => Promise<void>) | null = null;
    void installNativeReminderActionHandler().then((cleanup) => {
      remove = cleanup;
    });
    return () => {
      if (remove) void remove();
    };
  }, [refresh]);

  const requestPermission = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const next = await requestNativeReminderPermission();
      setReadiness(next);
      return next;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  const requestExactAlarm = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const next = await requestExactAlarmAccess();
      setReadiness(next);
      return next;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  const test = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await scheduleNativeTestReminder(5);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    ...readiness,
    busy,
    error,
    refresh,
    requestPermission,
    requestExactAlarm,
    test,
  };
}
