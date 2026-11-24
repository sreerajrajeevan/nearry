import AsyncStorage from "@react-native-async-storage/async-storage";
import { isDemoMode, requireSupabase } from "./supabase";
import { mockPosts } from "../data/mock";
import { indiaDayKey, type TodayPlan } from "../utils/planReminders";

/** The signed-in person's plans for today that haven't started, earliest first. */
export async function todayPlans(): Promise<TodayPlan[]> {
  if (isDemoMode()) return demoTodayPlans();
  const { data, error } = await requireSupabase().rpc("plans_for_day");
  if (error) throw new Error(error.message);
  return (data ?? []) as TodayPlan[];
}

/** Going / Not going for a plan the person has joined. */
export async function setPlanAttendance(
  postId: string,
  going: boolean,
): Promise<void> {
  if (isDemoMode()) {
    demoAnswers.set(postId, going ? "going" : "not_going");
    return;
  }
  const { error } = await requireSupabase().rpc("set_plan_attendance", {
    p_post: postId,
    p_going: going,
  });
  if (error) throw new Error(error.message);
}

export type AttendanceSummary = {
  going: number;
  notGoing: number;
  members: number;
};

/** Host only: how many members confirmed. */
export async function planAttendanceSummary(
  postId: string,
): Promise<AttendanceSummary | null> {
  if (isDemoMode()) return null;
  const { data, error } = await requireSupabase().rpc(
    "plan_attendance_summary",
    { p_post: postId },
  );
  if (error) return null;
  return data as AttendanceSummary;
}

const DISMISSED_KEY = "nearry.todayPlans.dismissed";

/** Plans already shown in today's pop-up (India-time day). */
export async function dismissedToday(now = new Date()): Promise<string[]> {
  try {
    const saved = JSON.parse(
      (await AsyncStorage.getItem(DISMISSED_KEY)) ?? "null",
    ) as { day: string; ids: string[] } | null;
    return saved?.day === indiaDayKey(now) ? saved.ids : [];
  } catch {
    return [];
  }
}

/** Hide these plans from the pop-up until tomorrow. */
export async function dismissForToday(
  ids: string[],
  now = new Date(),
): Promise<void> {
  const day = indiaDayKey(now);
  const ids0 = await dismissedToday(now);
  try {
    await AsyncStorage.setItem(
      DISMISSED_KEY,
      JSON.stringify({ day, ids: [...new Set([...ids0, ...ids])] }),
    );
  } catch {
    /* worst case the pop-up shows again on the next launch */
  }
}

const demoAnswers = new Map<string, "going" | "not_going">();

/** One joined plan this evening, so the demo shows the pop-up. */
function demoTodayPlans(): TodayPlan[] {
  // A sample plan later today, shown with its real time so the pop-up and
  // the plan page agree.
  const today = indiaDayKey(new Date());
  const sample = mockPosts.find(
    (p) =>
      p.authorId !== "demo-user" &&
      new Date(p.startsAt).getTime() > Date.now() &&
      indiaDayKey(new Date(p.startsAt)) === today,
  );
  if (!sample) return [];
  return [
    {
      postId: sample.id,
      title: sample.title,
      startsAt: sample.startsAt,
      place: sample.venueName ?? null,
      host: false,
      myStatus: demoAnswers.get(sample.id) ?? null,
      going: 2,
      members: 3,
    },
  ];
}
