import { Alert } from "../../services/appAlert";
import {
  AccountMenuGroup,
  AccountMenuRow,
} from "../../components/AccountMenuRow";
import { BackButton } from "../../components/BackButton";
import { LoadingState } from "../../components/LoadingState";
import React, { useRef, useState } from "react";
import {
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { PageHeading } from "../../components/PageHeading";
import { useAuth } from "../../store/AuthContext";
import { useLiveQuery } from "../../hooks/useLiveQuery";
import { colors, typography, weight } from "../../theme";
import {
  blockUser,
  listBlockedUsers,
  listMyReports,
  notificationPreferences,
  REPORT_REASONS,
  reportContent,
  ReportTarget,
  requestAccountDeletion,
  setAlertArea,
  setNotificationCategory,
  setPushEnabled,
  type NotificationCategory,
} from "../../services/safety";
import { switchesFor } from "../../utils/notificationSettings";
import { OnboardingLocation } from "../../components/onboarding/OnboardingLocation";
import {
  onboardingPreferences,
  type OnboardingPreferences,
} from "../../utils/onboarding";
import { enablePushNotifications } from "../../services/notifications";
import {
  legalSections,
  legalContact,
  legalTitle,
  legalUpdated,
  LegalPage,
} from "../../utils/legal";

type Nav = { goBack(): void; navigate(name: string, params?: any): void };
const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "Please try again.";
function Back({ navigation }: { navigation: Nav }) {
  return <BackButton onPress={() => navigation.goBack()} />;
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
      <AccountMenuGroup>
        <AccountMenuRow
          icon="slash"
          title="Blocked people"
          hint="People who can’t contact you or see your plans"
          onPress={() => navigation.navigate("BlockedUsers")}
        />
        <AccountMenuRow
          icon="flag"
          title="Your reports"
          hint="What you’ve reported and its review status"
          onPress={() => navigation.navigate("MyReports")}
        />
        <AccountMenuRow
          icon="bell"
          title="Notification preferences"
          hint="Choose which updates you receive"
          onPress={() => navigation.navigate("NotificationSettings")}
        />
      </AccountMenuGroup>
      <AccountMenuGroup>
        <AccountMenuRow
          icon="book-open"
          title="Privacy policy"
          hint="How Nearry handles your information"
          onPress={() => navigation.navigate("Legal", { page: "privacy" })}
        />
        <AccountMenuRow
          icon="file-text"
          title="Community guidelines & terms"
          hint="How we keep Nearry welcoming"
          onPress={() => navigation.navigate("Legal", { page: "terms" })}
        />
        {!!legalContact.email && (
          <AccountMenuRow
            icon="mail"
            title="Contact support"
            hint={legalContact.email}
            onPress={() =>
              void Linking.openURL(`mailto:${legalContact.email}`).catch(() =>
                Alert.alert("Support", legalContact.email),
              )
            }
          />
        )}
      </AccountMenuGroup>
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
      {target.kind === "conversation" && (
        <Text style={styles.copy}>
          Your report includes recent messages from this conversation for
          review.
        </Text>
      )}
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
  const { profile, demoMode, accountType } = useAuth();
  const { data, state, refresh } = useLiveQuery(
    "notification-preferences",
    notificationPreferences,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [picking, setPicking] = useState(false);
  const [pick, setPick] = useState<OnboardingPreferences>(() =>
    onboardingPreferences(null),
  );
  const [pickLabel, setPickLabel] = useState("");
  const change = async (work: () => Promise<void>) => {
    if (busy || !profile) return;
    setBusy(true);
    setError("");
    try {
      await work();
      await refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const toggle = (enabled: boolean) =>
    change(async () => {
      if (enabled && !demoMode) await enablePushNotifications(profile!.id);
      await setPushEnabled(enabled);
    });
  const toggleCategory = (key: NotificationCategory, enabled: boolean) =>
    change(() => setNotificationCategory(key, enabled));
  const switches = switchesFor(
    accountType === "business" ? "business" : "personal",
  );
  const pushOn = !!data?.pushEnabled;
  return (
    <Screen scroll style={styles.page}>
      <Back navigation={navigation} />
      <PageHeading
        greeting="Keep in touch, on your terms."
        title="Notifications"
      />
      <Text style={styles.copy}>
        Choose which push alerts Nearry sends. In-app activity stays available
        when push is off.
      </Text>
      {state === "error" ? (
        <Button title="Retry" onPress={() => void refresh()} />
      ) : state === "loading" ? (
        <LoadingState
          label="Loading notification preferences…"
          layout="compact"
        />
      ) : (
        <>
          <View style={styles.row}>
            <Text style={styles.name}>Push notifications</Text>
            <Switch
              accessibilityLabel="Push notifications"
              value={pushOn}
              disabled={busy}
              onValueChange={(value) => void toggle(value)}
              trackColor={{ true: colors.accent }}
            />
          </View>
          {switches.map((item) => (
            <View key={item.key}>
              <View style={[styles.row, !pushOn && styles.off]}>
                <View style={styles.flex}>
                  <Text style={styles.name}>{item.label}</Text>
                  <Text style={styles.hint}>{item.hint}</Text>
                </View>
                <Switch
                  accessibilityLabel={item.label}
                  value={pushOn && !!data?.[item.key]}
                  disabled={busy || !pushOn}
                  onValueChange={(value) =>
                    void toggleCategory(item.key, value)
                  }
                  trackColor={{ true: colors.accent }}
                />
              </View>
              {item.key === "nearby" && (
                <View style={styles.areaRow}>
                  <Text style={[styles.hint, styles.flex]}>
                    {data?.alertArea
                      ? `Alerts near ${data.alertArea.label}`
                      : "No area yet: you won't get nearby alerts."}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() => {
                      setPick(onboardingPreferences(null));
                      setPickLabel("");
                      setPicking(true);
                    }}
                  >
                    <Text style={styles.link}>
                      {data?.alertArea ? "Change" : "Add your area"}
                    </Text>
                  </Pressable>
                  {!!data?.alertArea && (
                    <Pressable
                      accessibilityRole="button"
                      disabled={busy}
                      onPress={() => void change(() => setAlertArea(null))}
                    >
                      <Text style={styles.link}>Remove</Text>
                    </Pressable>
                  )}
                </View>
              )}
            </View>
          ))}
        </>
      )}
      <Modal
        visible={picking}
        animationType="slide"
        transparent
        onRequestClose={() => setPicking(false)}
      >
        <View style={styles.sheetBackdrop}>
          <View style={styles.sheet}>
            <OnboardingLocation
              value={pick}
              onChange={setPick}
              manualArea={pickLabel}
              onManualArea={setPickLabel}
              busy={busy}
            />
            <Button
              title="Save area"
              disabled={!pick.area || busy}
              onPress={() => {
                const area = pick.area;
                if (!area) return;
                setPicking(false);
                void change(() => setAlertArea(area));
              }}
            />
            <Button
              title="Cancel"
              variant="secondary"
              onPress={() => setPicking(false)}
            />
          </View>
        </View>
      </Modal>
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
        greeting={`Nearry · Last updated ${legalUpdated(page)}`}
        title={legalTitle(page)}
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
  flex: { flex: 1 },
  off: { opacity: 0.5 },
  hint: { ...typography.caption, color: colors.textDim, marginTop: 2 },
  areaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingVertical: 10,
  },
  link: { ...typography.body, ...weight("700"), color: colors.amberDeep },
  sheetBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(10,14,30,0.45)",
  },
  sheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 12,
    maxHeight: "85%",
  },
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
