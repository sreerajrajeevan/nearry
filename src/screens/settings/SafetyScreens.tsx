import { LoadingState } from "../../components/LoadingState";
import React, { useRef, useState } from "react";
import { Alert, Linking, StyleSheet, Switch, Text, View } from "react-native";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { PageHeading } from "../../components/PageHeading";
import { useAuth } from "../../store/AuthContext";
import { useLiveQuery } from "../../hooks/useLiveQuery";
import { colors, typography } from "../../theme";
import {
  blockUser,
  listBlockedUsers,
  listMyReports,
  notificationPreferences,
  REPORT_REASONS,
  reportContent,
  ReportTarget,
  requestAccountDeletion,
  setPushEnabled,
} from "../../services/safety";
import { enablePushNotifications } from "../../services/notifications";
import {
  legalSections,
  legalContact,
  LegalPage,
  POLICY_VERSION,
  legalConfigured,
} from "../../utils/legal";

type Nav = { goBack(): void; navigate(name: string, params?: any): void };
const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "Please try again.";
function Back({ navigation }: { navigation: Nav }) {
  return (
    <Button title="Back" variant="ghost" onPress={() => navigation.goBack()} />
  );
}

export function SafetyPrivacyScreen({ navigation }: { navigation: Nav }) {
  return (
    <Screen scroll style={styles.page}>
      <Back navigation={navigation} />
      <PageHeading greeting="You're in control." title="Safety & privacy" />
      <Text style={styles.copy}>
        Report something that feels wrong, manage who can contact you, and
        control your account.
      </Text>
      {(
        [
          ["BlockedUsers", "Blocked people"],
          ["MyReports", "Your reports"],
          ["NotificationSettings", "Notification preferences"],
          ["Legal", "Privacy policy"],
        ] as const
      ).map(([name, label]) => (
        <Button
          key={label}
          title={label}
          variant="secondary"
          onPress={() =>
            navigation.navigate(
              name,
              name === "Legal" ? { page: "privacy" } : undefined,
            )
          }
        />
      ))}
      <Button
        title="Community guidelines & terms"
        variant="secondary"
        onPress={() => navigation.navigate("Legal", { page: "terms" })}
      />
      {!!legalContact.email && (
        <Button
          title="Contact support"
          variant="ghost"
          onPress={() =>
            void Linking.openURL(`mailto:${legalContact.email}`).catch(() =>
              Alert.alert("Support", legalContact.email),
            )
          }
        />
      )}
      <Button
        title="Delete my account"
        variant="danger"
        onPress={() => navigation.navigate("DeleteAccount")}
      />
    </Screen>
  );
}
export function ReportScreen({
  route,
  navigation,
}: {
  route: { params: { target: ReportTarget } };
  navigation: Nav;
}) {
  const { demoMode } = useAuth();
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const lock = useRef(false);
  const target = route.params.target;
  const submit = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await reportContent(target, reason, details);
      setDone(true);
    } catch (e) {
      setError(errorText(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  if (done)
    return (
      <Screen scroll style={styles.page}>
        <PageHeading
          greeting="Thank you for telling us."
          title="Report received"
        />
        <Text style={styles.copy}>
          {demoMode
            ? "This sample report stays in the demo."
            : "Your report has been sent for review. The reported person cannot see who submitted it. Check Your reports for its status."}
        </Text>
        <Text style={styles.copy}>
          Nearry is not an emergency service. For immediate danger, contact your
          local emergency services.
        </Text>
        <Button title="Done" onPress={() => navigation.goBack()} />
      </Screen>
    );
  return (
    <Screen scroll keyboard style={styles.page}>
      <Back navigation={navigation} />
      <PageHeading
        greeting={target.name ?? "Help keep Nearry welcoming."}
        title="Tell us what happened"
      />
      <Text style={styles.copy}>
        Choose the main reason. Add details that help us understand the concern;
        avoid sharing private contact or payment information.
      </Text>
      {REPORT_REASONS.map((r) => (
        <Button
          key={r.id}
          title={r.label}
          variant={reason === r.id ? "primary" : "secondary"}
          disabled={busy}
          onPress={() => setReason(r.id)}
        />
      ))}
      <Input
        label="Additional details (optional)"
        value={details}
        onChangeText={setDetails}
        multiline
        maxLength={1000}
        editable={!busy}
      />
      {!!error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      <Button
        title="Send report"
        disabled={!reason}
        loading={busy}
        onPress={() => void submit()}
      />
    </Screen>
  );
}
export function BlockedUsersScreen({ navigation }: { navigation: Nav }) {
  const { data, state, refresh } = useLiveQuery("my-blocks", listBlockedUsers);
  const [busy, setBusy] = useState("");
  return (
    <Screen scroll style={styles.page}>
      <Back navigation={navigation} />
      <PageHeading greeting="Choose your company." title="Blocked people" />
      <Text style={styles.copy}>
        Blocking hides their plans and stops new messages, join requests and
        bookings between you. Existing bookings and participation aren't
        cancelled automatically. You can still manage them in Activity or
        Bookings.
      </Text>
      {state === "error" ? (
        <Button title="Retry" onPress={() => void refresh()} />
      ) : state === "loading" ? (
        <LoadingState label="Loading blocked accounts…" layout="compact" />
      ) : !data?.length ? (
        <Text style={styles.copy}>You haven't blocked anyone.</Text>
      ) : (
        data.map((user) => (
          <View key={user.id} style={styles.row}>
            <Text style={styles.name}>{user.name}</Text>
            <Button
              title="Unblock"
              variant="ghost"
              disabled={!!busy}
              loading={busy === user.id}
              onPress={() => {
                setBusy(user.id);
                void blockUser(user.id, false)
                  .then(() => refresh())
                  .catch((e) => Alert.alert("Could not unblock", errorText(e)))
                  .finally(() => setBusy(""));
              }}
            />
          </View>
        ))
      )}
    </Screen>
  );
}
export function MyReportsScreen({ navigation }: { navigation: Nav }) {
  const { data, state, refresh } = useLiveQuery("my-reports", listMyReports);
  return (
    <Screen scroll style={styles.page}>
      <Back navigation={navigation} />
      <PageHeading
        greeting="Thanks for looking out for the neighbourhood."
        title="Your reports"
      />
      {state === "error" ? (
        <Button title="Retry" onPress={() => void refresh()} />
      ) : state === "loading" ? (
        <LoadingState label="Loading your reports…" layout="compact" />
      ) : !data?.length ? (
        <Text style={styles.copy}>You haven't submitted any reports.</Text>
      ) : (
        data.map((report) => (
          <View key={report.id} style={styles.section}>
            <Text style={styles.name}>
              {report.target_kind} · {report.reason}
            </Text>
            <Text style={styles.copy}>
              {report.status === "open"
                ? "Awaiting review"
                : report.status === "dismissed"
                  ? "Reviewed — no action taken"
                  : "Reviewed — action taken"}{" "}
              · {new Date(report.created_at).toLocaleDateString()}
            </Text>
          </View>
        ))
      )}
    </Screen>
  );
}
export function DeleteAccountScreen({ navigation }: { navigation: Nav }) {
  const { demoMode, signOut, refreshProfile } = useAuth();
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [requested, setRequested] = useState(false);
  const lock = useRef(false);
  const remove = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await requestAccountDeletion(confirmation);
      setRequested(true);
      await refreshProfile();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
      lock.current = false;
    }
  };
  return (
    <Screen scroll keyboard style={styles.page}>
      {!requested && <Back navigation={navigation} />}
      <PageHeading
        greeting="Your account, your choice."
        title={requested ? "Deletion requested" : "Delete your account"}
      />
      <Text style={styles.copy}>
        {requested
          ? "Your account is deactivated. Your stored files and sign-in account are queued for permanent deletion. You cannot undo this request."
          : "This permanently removes your account, profile, posts, photos, offers and conversations. Your upcoming plans and bookings will be cancelled, and your participation withdrawn. Other people in your conversations will lose that shared chat history. This cannot be undone."}
      </Text>
      <Text style={styles.copy}>
        Deletion runs in the background. Files may remain in caches and backups
        until those copies expire. See the privacy policy for details.
      </Text>
      {demoMode && (
        <Text style={styles.copy}>The demo has no real account to delete.</Text>
      )}
      {!requested && (
        <Input
          label="Type DELETE to confirm"
          value={confirmation}
          onChangeText={setConfirmation}
          autoCapitalize="characters"
          editable={!busy}
        />
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      {requested ? (
        <Button
          title="Sign out"
          onPress={() => void signOut().catch((e) => setError(errorText(e)))}
        />
      ) : (
        <Button
          title="Permanently delete my account"
          variant="danger"
          disabled={demoMode || confirmation !== "DELETE"}
          loading={busy}
          onPress={() => void remove()}
        />
      )}
    </Screen>
  );
}
export function NotificationSettingsScreen({
  navigation,
}: {
  navigation: Nav;
}) {
  const { profile, demoMode } = useAuth();
  const { data, state, refresh } = useLiveQuery(
    "notification-preferences",
    notificationPreferences,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const toggle = async (enabled: boolean) => {
    if (busy || !profile) return;
    setBusy(true);
    setError("");
    try {
      if (enabled && !demoMode) await enablePushNotifications(profile.id);
      await setPushEnabled(enabled);
      await refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen scroll style={styles.page}>
      <Back navigation={navigation} />
      <PageHeading
        greeting="Keep in touch, on your terms."
        title="Notifications"
      />
      <Text style={styles.copy}>
        Choose whether Nearry sends push alerts for messages, requests and
        bookings. In-app activity stays available when push is off.
      </Text>
      {state === "error" ? (
        <Button title="Retry" onPress={() => void refresh()} />
      ) : state === "loading" ? (
        <LoadingState
          label="Loading notification preferences…"
          layout="compact"
        />
      ) : (
        <View style={styles.row}>
          <Text style={styles.name}>Push notifications</Text>
          <Switch
            accessibilityLabel="Push notifications"
            value={!!data?.pushEnabled}
            disabled={busy}
            onValueChange={(value) => void toggle(value)}
            trackColor={{ true: colors.accent }}
          />
        </View>
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      <Text style={styles.copy}>
        Your phone's notification permission is separate. If permission is
        denied, enable it in system settings.
      </Text>
      {!demoMode && (
        <Button
          title="Open phone settings"
          variant="secondary"
          onPress={() =>
            void Linking.openSettings().catch(() =>
              setError("Open notification permissions in your phone settings."),
            )
          }
        />
      )}
      {demoMode && (
        <Text style={styles.copy}>
          Demo preferences stay in this session; no push is sent.
        </Text>
      )}
    </Screen>
  );
}
export function LegalScreen({
  route,
  navigation,
}: {
  route: { params?: { page?: LegalPage } };
  navigation: Nav;
}) {
  const page = route.params?.page ?? "privacy";
  return (
    <Screen scroll style={styles.page}>
      <Back navigation={navigation} />
      <PageHeading
        greeting="Nearry · Last updated 19 October 2026"
        title={
          page === "privacy" ? "Your privacy" : "Community guidelines & terms"
        }
      />
      {legalSections(page).map((section) => (
        <View key={section.title} style={styles.section}>
          <Text accessibilityRole="header" style={styles.name}>
            {section.title}
          </Text>
          <Text style={styles.copy}>{section.body}</Text>
        </View>
      ))}
    </Screen>
  );
}
const styles = StyleSheet.create({
  page: { gap: 10, paddingBottom: 32 },
  copy: {
    ...typography.body,
    color: colors.textDim,
    lineHeight: 23,
    marginVertical: 12,
  },
  name: { ...typography.heading, color: colors.text, flex: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  section: { marginVertical: 12 },
  error: { ...typography.body, color: colors.red, marginVertical: 12 },
});

export function RestrictedAccountScreen() {
  const { profile, signOut } = useAuth();
  const [page, setPage] = useState("");
  const [error, setError] = useState("");
  const nav: Nav = {
    goBack: () => setPage(""),
    navigate: () => setPage("privacy"),
  };
  if (page === "delete") return <DeleteAccountScreen navigation={nav} />;
  if (page === "privacy")
    return (
      <LegalScreen route={{ params: { page: "privacy" } }} navigation={nav} />
    );
  return (
    <Screen scroll style={styles.page}>
      <PageHeading
        greeting="Your account"
        title={
          profile?.deletionRequestedAt
            ? "Deletion requested"
            : "Account unavailable"
        }
      />
      <Text style={styles.copy}>
        {profile?.deletionRequestedAt
          ? "Your account is deactivated and permanent deletion is queued. Stored files are removed before your sign-in account. This request cannot be undone."
          : "Your account has been suspended. Contact support if you believe this was a mistake. You can still request account deletion."}
      </Text>
      <Button
        title="Privacy policy"
        variant="secondary"
        onPress={() => setPage("privacy")}
      />
      {!profile?.deletionRequestedAt && (
        <Button
          title="Delete my account"
          variant="danger"
          onPress={() => setPage("delete")}
        />
      )}
      {!!legalContact.email && (
        <Text style={styles.copy}>{legalContact.email}</Text>
      )}
      {!!error && <Text style={styles.error}>{error}</Text>}
      <Button
        title="Sign out"
        onPress={() => void signOut(true).catch((e) => setError(errorText(e)))}
      />
    </Screen>
  );
}
export function CommunityConsentScreen() {
  const { refreshProfile, signOut } = useAuth();
  const [page, setPage] = useState<LegalPage | "delete" | null>(null);
  const [adult, setAdult] = useState(false);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const nav: Nav = { goBack: () => setPage(null), navigate: () => {} };
  if (page === "delete") return <DeleteAccountScreen navigation={nav} />;
  if (page)
    return <LegalScreen route={{ params: { page } }} navigation={nav} />;
  return (
    <Screen scroll style={styles.page}>
      <PageHeading
        greeting="Good company starts with respect."
        title="Keep Nearry welcoming"
      />
      <Text style={styles.copy}>
        No harassment, scams, illegal activity or sharing someone's private
        information. Report concerns and block unwanted contact. Nearry is for
        adults aged 18 and over.
      </Text>
      <Button
        title="Read community guidelines & terms"
        variant="secondary"
        onPress={() => setPage("terms")}
      />
      <Button
        title="Read privacy policy"
        variant="secondary"
        onPress={() => setPage("privacy")}
      />
      <View style={styles.row}>
        <Text style={styles.copy}>I am 18 or older.</Text>
        <Switch
          accessibilityLabel="I am 18 or older"
          value={adult}
          onValueChange={setAdult}
        />
      </View>
      <View style={styles.row}>
        <Text style={[styles.copy, { flex: 1 }]}>
          I agree to the community guidelines and terms.
        </Text>
        <Switch
          accessibilityLabel="I agree to the community guidelines and terms"
          value={agree}
          onValueChange={setAgree}
        />
      </View>
      {!!error && <Text style={styles.error}>{error}</Text>}
      {!legalConfigured && (
        <Text style={styles.copy}>
          Account setup is not available for this preview yet. You can read the
          policies or request deletion of an existing account.
        </Text>
      )}
      <Button
        title="Agree and continue"
        disabled={!adult || !agree || !legalConfigured}
        loading={busy}
        onPress={() => {
          setBusy(true);
          void import("../../services/supabase")
            .then(async ({ requireSupabase }) => {
              const { error } = await requireSupabase().rpc(
                "accept_community_terms",
                { p_version: POLICY_VERSION, p_adult: true },
              );
              if (error) throw error;
              await refreshProfile();
            })
            .catch((e) => setError(errorText(e)))
            .finally(() => setBusy(false));
        }}
      />
      <Button
        title="Delete my account"
        variant="ghost"
        onPress={() => setPage("delete")}
      />
      <Button
        title="Sign out"
        variant="ghost"
        onPress={() => void signOut().catch((e) => setError(errorText(e)))}
      />
    </Screen>
  );
}
