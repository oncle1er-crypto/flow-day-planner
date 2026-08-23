import { useCallback, useEffect, useState } from "react";
import {
  getNativeReminderReadiness,
  isNativeReminderPlatform,
  requestExactAlarmAccess,
  requestNativeReminderPermission,
  scheduleNativeTestReminder,
  showNativeImmediateTestNotification,
  type NativeReminderReadiness,
} from "@/lib/native-reminders";

const initialState: NativeReminderReadiness = {
  supported: false,
  platform: "web",
  permission: "unsupported",
  exactAlarm: "unsupported",
  pending: 0,
  soundChannelReady: false,
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

  const testImmediate = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await showNativeImmediateTestNotification();
      await refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const test = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await scheduleNativeTestReminder(5);
      await refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  return {
    ...readiness,
    busy,
    error,
    refresh,
    requestPermission,
    requestExactAlarm,
    testImmediate,
    test,
  };
}
