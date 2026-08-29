import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../lib/queryClient";
import {
  getProfile,
  updateProfile,
  updatePassword,
  updateSettings,
  uploadProfileImage,
  deleteProfileImage,
  getProfileSessions,
  getProfileActivity,
  getTwoFactorStatus,
  enableTwoFactor,
  disableTwoFactor,
  revokeSession,
  revokeOtherSessions,
  type ProfileUser,
  type UserSettings,
  type ProfileSession,
  type ProfileActivityItem,
} from "../api/profile";

export const DEFAULT_SETTINGS: UserSettings = {
  language: "English",
  timezone: "Asia/Manila",
  date_format: "YYYY-MM-DD",
  theme: "system",
  email_notifications: true,
  push_notifications: true,
  low_stock_alerts: true,
  order_alerts: true,
  digest_frequency: "daily",
};

function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem("sa-auth") ||
    localStorage.getItem("token") ||
    localStorage.getItem("auth_token") ||
    sessionStorage.getItem("token") ||
    null
  );
}

export function normalizeSettings(raw: unknown): UserSettings {
  const s = (raw && typeof raw === "object" ? raw : {}) as Partial<UserSettings>;
  return {
    language: s.language ?? DEFAULT_SETTINGS.language,
    timezone: s.timezone ?? DEFAULT_SETTINGS.timezone,
    date_format: s.date_format ?? DEFAULT_SETTINGS.date_format,
    theme: s.theme ?? DEFAULT_SETTINGS.theme,
    email_notifications: s.email_notifications ?? DEFAULT_SETTINGS.email_notifications,
    push_notifications: s.push_notifications ?? DEFAULT_SETTINGS.push_notifications,
    low_stock_alerts: s.low_stock_alerts ?? DEFAULT_SETTINGS.low_stock_alerts,
    order_alerts: s.order_alerts ?? DEFAULT_SETTINGS.order_alerts,
    digest_frequency: s.digest_frequency ?? DEFAULT_SETTINGS.digest_frequency,
  };
}

/**
 * @param options.enabled  default true when token exists
 * @param options.minimal  if true, only fetch GET /profile (for Topbar)
 */
export function useProfile(options: { enabled?: boolean; minimal?: boolean } = {}) {
  const hasToken = !!getAuthToken();
  const enabled = options.enabled !== false && hasToken;
  const minimal = options.minimal === true;
  const qc = useQueryClient();

  const profileQuery = useQuery({
    queryKey: queryKeys.profile.me,
    queryFn: getProfile,
    enabled,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    retry: 1,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
  });

  const sessionsQuery = useQuery({
    queryKey: queryKeys.profile.sessions,
    queryFn: getProfileSessions,
    enabled: enabled && !minimal,
    staleTime: 60_000,
    retry: false,
  });

  const activityQuery = useQuery({
    queryKey: queryKeys.profile.activity,
    queryFn: getProfileActivity,
    enabled: enabled && !minimal,
    staleTime: 60_000,
    retry: false,
  });

  const twoFactorQuery = useQuery({
    queryKey: queryKeys.profile.twoFactor,
    queryFn: getTwoFactorStatus,
    enabled: enabled && !minimal,
    staleTime: 60_000,
    retry: false,
  });

  const user: ProfileUser | null = useMemo(() => {
    const data = profileQuery.data as
      | { user?: ProfileUser }
      | ProfileUser
      | undefined
      | null;
    if (!data) return null;
    if ("user" in data && data.user) return data.user as ProfileUser;
    if ("name" in data || "email" in data) return data as ProfileUser;
    return null;
  }, [profileQuery.data]);

  const settings = useMemo(() => {
    const data = profileQuery.data as { settings?: unknown } | undefined;
    return normalizeSettings(data?.settings);
  }, [profileQuery.data]);

  const sessions: ProfileSession[] = Array.isArray(sessionsQuery.data)
    ? sessionsQuery.data
    : [];
  const activity: ProfileActivityItem[] = Array.isArray(activityQuery.data)
    ? activityQuery.data
    : [];

  const twoFactorEnabled = useMemo(() => {
    if (typeof user?.two_factor_enabled === "boolean") {
      return user.two_factor_enabled;
    }
    const tf = twoFactorQuery.data as { enabled?: boolean } | boolean | undefined;
    if (typeof tf === "boolean") return tf;
    if (tf && typeof tf === "object") return !!tf.enabled;
    return false;
  }, [user?.two_factor_enabled, twoFactorQuery.data]);

  const invalidateProfile = async () => {
    await qc.invalidateQueries({ queryKey: queryKeys.profile.all });
  };

  const saveProfile = useMutation({
    mutationFn: updateProfile,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.profile.me });
    },
  });

  const savePassword = useMutation({
    mutationFn: updatePassword,
  });

  const saveSettings = useMutation({
    mutationFn: updateSettings,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.profile.me });
    },
  });

  const uploadImage = useMutation({
    mutationFn: uploadProfileImage,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.profile.me });
    },
  });

  const removeImage = useMutation({
    mutationFn: deleteProfileImage,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.profile.me });
    },
  });

  const enable2fa = useMutation({
    mutationFn: enableTwoFactor,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.profile.twoFactor });
      await qc.invalidateQueries({ queryKey: queryKeys.profile.me });
    },
  });

  const disable2fa = useMutation({
    mutationFn: (password: string) => disableTwoFactor(password),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.profile.twoFactor });
      await qc.invalidateQueries({ queryKey: queryKeys.profile.me });
    },
  });

  const revokeOneSession = useMutation({
    mutationFn: revokeSession,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.profile.sessions });
    },
  });

  const revokeOthers = useMutation({
    mutationFn: revokeOtherSessions,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.profile.sessions });
    },
  });

  return {
    user,
    settings,
    sessions,
    activity,
    twoFactorEnabled,

    isLoading: profileQuery.isLoading,
    isFetching: profileQuery.isFetching,
    isError: profileQuery.isError,
    error: profileQuery.error,
    refetch: profileQuery.refetch,
    invalidateProfile,
    hasToken,

    saveProfile,
    savePassword,
    saveSettings,
    uploadImage,
    removeImage,
    enable2fa,
    disable2fa,
    revokeOneSession,
    revokeOthers,

    sessionsLoading: sessionsQuery.isLoading,
    activityLoading: activityQuery.isLoading,
  };
}

export type { ProfileUser, UserSettings, ProfileSession, ProfileActivityItem };