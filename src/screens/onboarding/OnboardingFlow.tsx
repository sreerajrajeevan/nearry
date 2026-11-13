import React, { useCallback, useRef, useState } from "react";
import {
  BackHandler,
  Image,
  Platform,
  Text,
  View,
  StyleSheet,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../navigation/types";
import { useAuth } from "../../store/AuthContext";
import { pickAvatar, uploadAvatar } from "../../services/avatars";
import { updateProfile } from "../../services/profile";
import { TermsAgreement } from "../../components/TermsAgreement";
import { MotionPressable } from "../../components/Motion";
import { Icon } from "../../components/Icon";
import { OnboardingLocation } from "../../components/onboarding/OnboardingLocation";
import { BirthdayField } from "../../components/onboarding/BirthdayField";
import {
  OnboardingLayout,
  OnboardingHeading,
  OnboardingButton,
  OnboardingInput,
  OnboardingLink,
  OnboardingRules,
  ob,
  onboardingColors as c,
} from "../../components/onboarding/OnboardingKit";
import {
  ageFromBirthday,
  onboardingPreferences,
  ONBOARDING_DAYS,
  ONBOARDING_TIMES,
} from "../../utils/onboarding";
import { validatePersonalDetails } from "../../utils/profileReadiness";
import { isValidBusinessName } from "../../utils/validation";
import { POLICY_VERSION } from "../../utils/legal";

const INTERESTS = [
  ["🏋️", "Gym"],
  ["⚽", "Football"],
  ["🏸", "Badminton"],
  ["☕", "Cafés"],
  ["🥾", "Outdoors"],
  ["🎲", "Board games"],
  ["🎵", "Music"],
  ["🍜", "Food"],
  ["🧘", "Wellness"],
];
const CATEGORIES = [
  ["☕", "Café"],
  ["🍽️", "Restaurant"],
  ["🏟️", "Games"],
  ["🏋️", "Fitness"],
  ["🎨", "Culture"],
  ["🛍️", "Retail"],
];
const TIME_ART = ["🌅", "☀️", "🌇", "🌙"],
  TIME_HINT = ["6–10 AM", "12–4 PM", "5–8 PM", "8–11 PM"];

export function OnboardingFlow({
  business = false,
  onFinished,
}: {
  business?: boolean;
  onFinished?: () => void;
}) {
  const {
    profile,
    completeOnboarding,
    deferOnboarding,
    dismissOnboarding,
    signOut,
    demoMode,
    loading,
  } = useAuth();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [step, setStep] = useState(0),
    [done, setDone] = useState(false),
    [saving, setSaving] = useState(false),
    [picking, setPicking] = useState(false),
    [locationBusy, setLocationBusy] = useState(false),
    [error, setError] = useState("");
  const [name, setName] = useState(profile?.displayName ?? ""),
    [dob, setDob] = useState(""),
    [gender, setGender] = useState(profile?.gender);
  const [businessName, setBusinessName] = useState(profile?.businessName ?? ""),
    [category, setCategory] = useState(
      String(profile?.businessDetails.category ?? ""),
    );
  const [interests, setInterests] = useState<string[]>(
    profile?.interests ?? [],
  );
  const [preferences, setPreferences] = useState(() =>
    onboardingPreferences(profile?.onboardingPreferences),
  );
  const [area, setArea] = useState(String(profile?.businessDetails.area ?? ""));
  const [agreed, setAgreed] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null),
    [uploadedPhoto, setUploadedPhoto] = useState<string | null>(null);
  const lock = useRef(false);
  const busy = saving || loading || picking || locationBusy;
  const agreementNeeded = profile?.termsVersion !== POLICY_VERSION;
  const review = business ? 2 : 4,
    total = business ? 3 : 5;
  const age = dob ? ageFromBirthday(dob) : (profile?.age ?? null);
  const invalidProfile = business
    ? !isValidBusinessName(businessName) ||
      name.trim().length < 2 ||
      name.trim().length > 40 ||
      !category
    : !!validatePersonalDetails(name, gender, age?.toString() ?? "");
  const advance = (next: number) => {
    setError("");
    setStep(next);
  };
  const back = useCallback(() => {
    if (busy || done) return true;
    if (step > 0) {
      setError("");
      setStep(step - 1);
    } else if (onFinished) onFinished();
    else if (!business) deferOnboarding();
    else void signOut().catch((e) => setError(e.message));
    return true;
  }, [busy, done, step, onFinished, business, deferOnboarding, signOut]);
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === "web") return;
      const sub = BackHandler.addEventListener("hardwareBackPress", back);
      return () => sub.remove();
    }, [back]),
  );
  const choosePhoto = async () => {
    if (busy) return;
    setPicking(true);
    setError("");
    try {
      const uri = await pickAvatar();
      if (uri) {
        setPhoto(uri);
        setUploadedPhoto(null);
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not open your photos. Please try again.",
      );
    } finally {
      setPicking(false);
    }
  };
  const save = async () => {
    if (lock.current || busy) return;
    if (invalidProfile) {
      setError(
        business
          ? "Enter your name, business name and category."
          : "Add your name, birthday and gender before continuing.",
      );
      setStep(0);
      return;
    }
    if (business && !area.trim()) {
      setError("Choose your business area.");
      setStep(1);
      return;
    }
    if (agreementNeeded && !agreed) {
      setError("Please agree to the current Terms & Community Guidelines.");
      return;
    }
    lock.current = true;
    setSaving(true);
    setError("");
    try {
      if (!business && photo && !demoMode) {
        if (!profile) throw new Error("Please sign in again.");
        const url = uploadedPhoto ?? (await uploadAvatar(profile.id, photo));
        setUploadedPhoto(url);
        await updateProfile(profile.id, { avatarUrl: url });
      }
      await completeOnboarding({
        termsAccepted: agreed,
        celebrate: !onFinished,
        preferences,
        ...(business
          ? {
              displayName: name.trim(),
              businessName: businessName.trim(),
              businessDetails: {
                ...profile?.businessDetails,
                category,
                area: area.trim(),
                ...(preferences.area
                  ? {
                      latitude: preferences.area.latitude,
                      longitude: preferences.area.longitude,
                      locationSource: preferences.area.source,
                      locationCachedAt: preferences.area.acquiredAt,
                    }
                  : {}),
              },
            }
          : {
              personalDetails: {
                displayName: name.trim(),
                gender: gender!,
                age: age!,
              },
              interests,
            }),
      });
      if (onFinished) onFinished();
      else setDone(true);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not save your setup. Please try again.",
      );
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };
  const toggleInterest = (item: string) =>
    setInterests((current) =>
      current.includes(item)
        ? current.filter((x) => x !== item)
        : [...current, item],
    );
  const togglePreference = (key: "days" | "times", item: string) =>
    setPreferences((current) => ({
      ...current,
      [key]: current[key].includes(item)
        ? current[key].filter((x) => x !== item)
        : [...current[key], item],
    }));
  const needsArea = business && step === 1 && !area.trim();
  const footer = done ? (
    <OnboardingButton
      title={business ? "Open dashboard" : "Find my next plan"}
      onPress={dismissOnboarding}
    />
  ) : (
    <>
      <OnboardingButton
        title={step === review ? "Finish setup" : "Continue"}
        onPress={() => (step === review ? void save() : advance(step + 1))}
        disabled={
          busy ||
          (step === 0 && invalidProfile) ||
          needsArea ||
          (step === review && agreementNeeded && !agreed)
        }
        loading={saving}
      />
      {!business && step === 0 && !onFinished && (
        <OnboardingLink
          title="Explore first, finish my profile later"
          onPress={deferOnboarding}
          disabled={busy}
        />
      )}{" "}
      {((!business && step === 2) || (!business && step === 3)) && (
        <OnboardingLink
          title={step === 2 ? "Skip for now" : "Choose an area later"}
          disabled={busy}
          onPress={() => {
            if (step === 2)
              setPreferences((p) => ({ ...p, days: [], times: [] }));
            else setPreferences((p) => ({ ...p, area: undefined }));
            advance(step + 1);
          }}
        />
      )}
    </>
  );
  return (
    <OnboardingLayout
      onBack={done ? undefined : back}
      step={done ? total : step + 1}
      total={total}
      busy={busy}
      screenKey={done ? "done" : step}
      footer={footer}
    >
      {done ? (
        <View style={styles.done}>
          <View style={styles.party}>
            <Text style={{ fontSize: 66 }}>🎉</Text>
          </View>
          <OnboardingHeading
            kicker="Hello, new possibilities"
            title={
              business
                ? "Your next chapter\nstarts nearby."
                : `You’re all set,\n${name.trim().split(" ")[0]}!`
            }
            subtitle={
              business
                ? "Your business profile is ready. Complete business verification from your dashboard to publish offers."
                : "A new game. A coffee. A new friend. Let’s see what’s around the corner."
            }
          />
          <View style={ob.card}>
            <Text style={styles.summaryTitle}>
              {business
                ? businessName
                : (preferences.area?.label ?? "Your next plan is out there")}
            </Text>
            <Text style={ob.help}>
              {business
                ? area
                : `Your nearby · within ${preferences.radiusKm} km`}
            </Text>
          </View>
          {!business && (
            <View style={styles.tags}>
              {interests.map((item) => (
                <Text key={item} style={styles.tag}>
                  {item}
                </Text>
              ))}
            </View>
          )}
        </View>
      ) : (
        <>
          {step === 0 && (
            <>
              <OnboardingHeading
                kicker={business ? "Your business" : "About you"}
                title={
                  business
                    ? "Make your place\npart of the plan."
                    : "Put a face to your hello."
                }
                subtitle={
                  business
                    ? "Start with the essentials. You can add more details later."
                    : "A few details help people know who they’re meeting."
                }
              />
              {!business && (
                <View style={[ob.row, { marginBottom: 4 }]}>
                  <MotionPressable
                    accessibilityRole="button"
                    accessibilityLabel="Add a profile photo"
                    disabled={busy}
                    onPress={() => void choosePhoto()}
                    style={styles.photo}
                  >
                    {photo || profile?.avatarUrl ? (
                      <Image
                        source={{ uri: photo ?? profile?.avatarUrl }}
                        style={styles.photoImage}
                      />
                    ) : (
                      <Text style={{ fontSize: 34 }}>😎</Text>
                    )}
                    <View style={styles.camera}>
                      <Icon name="camera" size={13} color={c.white} />
                    </View>
                  </MotionPressable>
                  <View style={ob.full}>
                    <Text style={styles.summaryTitle}>
                      {picking
                        ? "Opening photos…"
                        : photo
                          ? "Looking good!"
                          : "Add a photo"}
                    </Text>
                    <Text style={ob.help}>
                      Optional. A familiar face makes the first hello easier.
                    </Text>
                  </View>
                </View>
              )}
              <OnboardingInput
                label="Your name"
                placeholder={
                  business
                    ? "Owner or contact person"
                    : "What should we call you?"
                }
                value={name}
                onChangeText={setName}
                editable={!busy}
                maxLength={40}
                autoCapitalize="words"
                autoComplete="name"
              />
              {business ? (
                <>
                  <OnboardingInput
                    label="Business name"
                    placeholder="e.g. Sunday Coffee"
                    value={businessName}
                    onChangeText={setBusinessName}
                    editable={!busy}
                    maxLength={80}
                    autoCapitalize="words"
                  />
                  <Text style={ob.label}>What kind of place?</Text>
                  <View
                    style={ob.grid}
                    accessibilityRole="radiogroup"
                    accessibilityLabel="Business category"
                  >
                    {CATEGORIES.map(([emoji, label]) => (
                      <MotionPressable
                        key={label}
                        disabled={busy}
                        accessibilityRole="radio"
                        accessibilityLabel={
                          label === "Games" ? "Sports & games" : label
                        }
                        accessibilityState={{ checked: category === label }}
                        aria-checked={category === label}
                        onPress={() => setCategory(label)}
                        style={[ob.tile, category === label && ob.selected]}
                      >
                        <Text style={ob.emoji}>{emoji}</Text>
                        <Text style={ob.tileText}>
                          {label === "Games" ? "Sports & games" : label}
                        </Text>
                      </MotionPressable>
                    ))}
                  </View>
                </>
              ) : (
                <>
                  <BirthdayField
                    value={dob}
                    onChange={setDob}
                    disabled={busy}
                    savedAge={profile?.age}
                  />
                  <Text style={ob.label}>Gender</Text>
                  <View
                    style={[ob.row, { flexWrap: "wrap" }]}
                    accessibilityRole="radiogroup"
                    accessibilityLabel="Gender"
                  >
                    {(
                      [
                        { value: "female", label: "Woman" },
                        { value: "male", label: "Man" },
                        { value: "other", label: "Other" },
                      ] as const
                    ).map((item) => (
                      <MotionPressable
                        key={item.value}
                        accessibilityRole="radio"
                        accessibilityLabel={item.label}
                        accessibilityState={{ checked: gender === item.value }}
                        aria-checked={gender === item.value}
                        disabled={busy}
                        onPress={() => setGender(item.value)}
                        style={[
                          ob.segment,
                          gender === item.value && ob.selected,
                        ]}
                      >
                        <Text style={ob.segmentText}>{item.label}</Text>
                      </MotionPressable>
                    ))}
                  </View>
                  <Text style={ob.help}>
                    Used to check eligibility for gender-specific plans.
                  </Text>
                </>
              )}
            </>
          )}
          {!business && step === 1 && (
            <>
              <OnboardingHeading
                kicker="Your kind of plans"
                title="What brings you out?"
                subtitle="Pick what you love. A game, good food, fresh air — there’s room for all of it."
              />
              <View style={ob.grid}>
                {INTERESTS.map(([emoji, label]) => (
                  <MotionPressable
                    key={label}
                    accessibilityRole="checkbox"
                    accessibilityLabel={label}
                    accessibilityState={{ checked: interests.includes(label) }}
                    aria-checked={interests.includes(label)}
                    disabled={busy}
                    onPress={() => toggleInterest(label)}
                    style={[ob.tile, interests.includes(label) && ob.selected]}
                  >
                    <Text style={ob.emoji}>{emoji}</Text>
                    <Text style={ob.tileText}>{label}</Text>
                    {interests.includes(label) && (
                      <View style={styles.tick}>
                        <Icon name="check" size={11} color={c.white} />
                      </View>
                    )}
                  </MotionPressable>
                ))}
              </View>
              <Text style={ob.help}>
                {interests.length
                  ? `${interests.length} picked. A good place to start.`
                  : "Choose a few, or keep an open mind."}
              </Text>
            </>
          )}
          {!business && step === 2 && (
            <>
              <OnboardingHeading
                kicker="Your week, your way"
                title={"When are you\nusually free?"}
                subtitle="Save the days and times that suit you. You can skip this."
              />
              <Text style={ob.label}>Days</Text>
              <View style={[ob.row, { flexWrap: "wrap", gap: 6 }]}>
                {ONBOARDING_DAYS.map((day) => (
                  <MotionPressable
                    accessibilityRole="checkbox"
                    accessibilityLabel={day}
                    aria-checked={preferences.days.includes(day)}
                    accessibilityState={{
                      checked: preferences.days.includes(day),
                    }}
                    key={day}
                    disabled={busy}
                    onPress={() => togglePreference("days", day)}
                    style={[
                      styles.day,
                      preferences.days.includes(day) && styles.darkSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        preferences.days.includes(day) && styles.lightText,
                      ]}
                    >
                      {day}
                    </Text>
                  </MotionPressable>
                ))}
              </View>
              <Text style={ob.label}>Times</Text>
              <View style={ob.grid}>
                {ONBOARDING_TIMES.map((time, i) => (
                  <MotionPressable
                    key={time}
                    accessibilityRole="checkbox"
                    accessibilityLabel={time}
                    aria-checked={preferences.times.includes(time)}
                    accessibilityState={{
                      checked: preferences.times.includes(time),
                    }}
                    disabled={busy}
                    onPress={() => togglePreference("times", time)}
                    style={[
                      styles.time,
                      preferences.times.includes(time) && styles.darkSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.timeTitle,
                        preferences.times.includes(time) && styles.lightText,
                      ]}
                    >
                      {TIME_ART[i]} {time}
                    </Text>
                    <Text
                      style={[
                        styles.timeHint,
                        preferences.times.includes(time) && {
                          color: "#D5D8D3",
                        },
                      ]}
                    >
                      {TIME_HINT[i]}
                    </Text>
                  </MotionPressable>
                ))}
              </View>
            </>
          )}
          {step === (business ? 1 : 3) && (
            <OnboardingLocation
              business={business}
              value={preferences}
              onChange={(next) => {
                setPreferences(next);
                setError("");
              }}
              manualArea={area}
              onManualArea={setArea}
              busy={busy}
              onBusyChange={setLocationBusy}
            />
          )}
          {step === review && (
            <>
              <OnboardingHeading
                kicker={business ? "One last look" : "Good company starts here"}
                title={
                  business
                    ? "Ready to say hello?"
                    : "A few things we\nall agree on."
                }
                subtitle={
                  business
                    ? "Your place is nearly ready for its Nearry debut."
                    : "Small things that make plans better for everyone."
                }
              />
              <View style={ob.card}>
                <Text style={styles.summaryTitle}>
                  {business ? businessName : name}
                </Text>
                <Text style={ob.help}>
                  {business
                    ? `${category} · ${area}`
                    : `${age} · ${gender === "female" ? "Woman" : gender === "male" ? "Man" : "Other"}${preferences.area ? " · " + preferences.area.label : ""}`}
                </Text>
                {business && <Text style={ob.help}>Contact: {name}</Text>}
              </View>
              <OnboardingRules />
              {agreementNeeded ? (
                <TermsAgreement
                  checked={agreed}
                  onChange={setAgreed}
                  disabled={busy}
                  onTerms={() =>
                    navigation.navigate("Legal", { page: "terms" })
                  }
                  onPrivacy={() =>
                    navigation.navigate("Legal", { page: "privacy" })
                  }
                />
              ) : (
                <View style={{ marginTop: 12 }}>
                  <Text style={ob.help}>
                    You’ve accepted the current community terms.
                  </Text>
                  <View style={ob.row}>
                    <OnboardingLink
                      title="Read the guidelines"
                      onPress={() =>
                        navigation.navigate("Legal", { page: "terms" })
                      }
                    />
                    <OnboardingLink
                      title="Privacy Policy"
                      onPress={() =>
                        navigation.navigate("Legal", { page: "privacy" })
                      }
                    />
                  </View>
                </View>
              )}
            </>
          )}
          {!!error && (
            <Text
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={ob.error}
            >
              {error}
            </Text>
          )}
          {business && step === 0 && (
            <OnboardingLink
              title="Use a different account"
              disabled={busy}
              onPress={() => void signOut().catch((e) => setError(e.message))}
            />
          )}
        </>
      )}
    </OnboardingLayout>
  );
}
const styles = StyleSheet.create({
  photo: {
    width: 74,
    height: 74,
    borderRadius: 24,
    backgroundColor: c.peach,
    alignItems: "center",
    justifyContent: "center",
  },
  photoImage: { width: 74, height: 74, borderRadius: 24 },
  camera: {
    position: "absolute",
    right: -4,
    bottom: -3,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 3,
    borderColor: c.paper,
    backgroundColor: c.orange,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryTitle: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
    color: c.ink,
  },
  tick: {
    position: "absolute",
    right: 5,
    top: 5,
    width: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: c.orange,
    alignItems: "center",
    justifyContent: "center",
  },
  day: {
    minWidth: 44,
    minHeight: 48,
    padding: 10,
    borderRadius: 12,
    backgroundColor: c.white,
    alignItems: "center",
    justifyContent: "center",
  },
  dayText: { fontSize: 12, color: c.ink, fontWeight: "600" },
  darkSelected: { backgroundColor: c.ink },
  lightText: { color: c.white },
  time: {
    width: "46%",
    flexGrow: 1,
    minHeight: 83,
    padding: 16,
    borderRadius: 16,
    backgroundColor: c.white,
  },
  timeTitle: { fontSize: 13, lineHeight: 21, color: c.ink, fontWeight: "600" },
  timeHint: { fontSize: 11, lineHeight: 18, color: c.muted, marginTop: 2 },
  done: { paddingTop: 25 },
  party: {
    alignSelf: "center",
    width: 132,
    height: 132,
    borderRadius: 38,
    backgroundColor: "#FFB832",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 30,
    transform: [{ rotate: "-7deg" }],
  },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: {
    backgroundColor: c.peach,
    color: c.orange,
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 10,
    fontSize: 12,
  },
});
