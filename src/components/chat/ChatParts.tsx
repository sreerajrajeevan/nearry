import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Icon } from "../Icon";
import { LinkedText } from "../LinkedText";
import { colors } from "../../theme/colors";
import { weight } from "../../theme/typography";
import { nameColour, type TimelineItem } from "../../utils/chatTimeline";

/**
 * Chat surfaces: a white header and input bar around a warm canvas, so the
 * three layers read apart. Text on the canvas stays at 4.5:1 or better.
 */
export const chatColors = {
  canvas: "#F4F0E8",
  mine: "#FCEBB6",
  mineBorder: "#F2D27A",
  theirs: colors.surface,
  theirsBorder: "#E7E1D6",
  chip: "#E9E2D5",
};

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });

export function DayChip({ label }: { label: string }) {
  return (
    <View style={styles.dayRow} accessibilityRole="header">
      <Text style={styles.dayChip}>{label.toUpperCase()}</Text>
    </View>
  );
}

export function EventLine({ text }: { text: string }) {
  return (
    <View style={styles.eventRow}>
      <Text style={styles.eventText}>{text}</Text>
    </View>
  );
}

type Message = {
  id: string;
  senderId: string;
  senderName?: string;
  body: string;
  createdAt: string;
  mine: boolean;
};

/**
 * One message. In group chats the first message of a run shows the sender's
 * initial and name in their own colour; later ones line up beside it.
 */
export function MessageRow({
  item,
  group,
  onLongPress,
  hint,
}: {
  item: Extract<TimelineItem<Message>, { type: "message" }>;
  group: boolean;
  onLongPress?: () => void;
  hint?: string;
}) {
  const { message: m, firstInRun, lastInRun, emojiOnly } = item;
  const showSender = group && !m.mine;
  const colour = nameColour(m.senderId);
  const name = m.senderName ?? "Member";
  const time = timeOf(m.createdAt);
  return (
    <View
      style={[
        styles.row,
        m.mine && styles.rowMine,
        { marginTop: firstInRun ? 10 : 3 },
      ]}
    >
      {showSender && (
        <View style={styles.avatarSlot}>
          {lastInRun && (
            <View
              style={[styles.avatar, { backgroundColor: colour }]}
              importantForAccessibility="no-hide-descendants"
            >
              <Text style={styles.avatarText}>
                {name.trim().charAt(0).toUpperCase() || "?"}
              </Text>
            </View>
          )}
        </View>
      )}
      <Pressable
        accessibilityRole="text"
        accessibilityLabel={`${m.mine ? "You" : name}, ${time}: ${m.body}`}
        accessibilityHint={hint}
        onLongPress={onLongPress}
        delayLongPress={350}
        style={[
          emojiOnly
            ? styles.emojiWrap
            : [
                styles.bubble,
                m.mine ? styles.mine : styles.theirs,
                lastInRun && (m.mine ? styles.tailMine : styles.tailTheirs),
              ],
        ]}
      >
        {showSender && firstInRun && (
          <Text style={[styles.sender, { color: colour }]} numberOfLines={1}>
            {name}
          </Text>
        )}
        {emojiOnly ? (
          <Text style={styles.emoji}>{m.body}</Text>
        ) : (
          <LinkedText style={styles.body} linkStyle={styles.link}>
            {m.body}
          </LinkedText>
        )}
        {lastInRun && (
          <Text style={[styles.time, emojiOnly && styles.timeEmoji]}>
            {time}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

/** Calendar tile + when + where + how many are going. Opens the plan. */
export function PlanChatCard({
  startsAt,
  title,
  place,
  going,
  soon,
  whenText,
  onPress,
}: {
  startsAt?: string;
  title: string;
  place?: string;
  going: number;
  soon: boolean;
  whenText: string;
  onPress: () => void;
}) {
  const date = startsAt ? new Date(startsAt) : null;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${whenText}${place ? `, ${place}` : ""}. ${going} going. Open plan details`}
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.planCard, soon && styles.planCardSoon]}
    >
      <View style={styles.tile}>
        <Text style={styles.tileMonth}>
          {date
            ? date.toLocaleDateString("en-IN", { month: "short" }).toUpperCase()
            : "—"}
        </Text>
        <Text style={styles.tileDay}>{date ? date.getDate() : ""}</Text>
      </View>
      <View style={styles.planCopy}>
        <Text
          style={[styles.planWhen, soon && { color: colors.red }]}
          numberOfLines={1}
        >
          {whenText}
        </Text>
        <Text style={styles.planWhere} numberOfLines={1}>
          {place ? `${place} · ` : ""}Plan details ›
        </Text>
      </View>
      <View style={styles.goingPill}>
        <Text style={styles.goingText}>{going} going</Text>
      </View>
    </TouchableOpacity>
  );
}

/** Input bar: the send button turns solid yellow once there is text. */
export function ChatComposer({
  value,
  onChangeText,
  onSend,
  sending,
  disabled,
  placeholder,
  label,
  sendLabel,
  bottomInset,
  inputRef,
}: {
  inputRef?: React.Ref<TextInput>;
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  sending: boolean;
  disabled?: boolean;
  placeholder: string;
  label: string;
  sendLabel: string;
  bottomInset: number;
}) {
  const ready = !!value.trim() && !sending && !disabled;
  return (
    <View style={[styles.composer, { paddingBottom: bottomInset }]}>
      <TextInput
        ref={inputRef}
        accessibilityLabel={label}
        multiline
        maxLength={2000}
        submitBehavior="newline"
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        editable={!disabled}
        placeholder={placeholder}
        placeholderTextColor={colors.textDim}
      />
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={sendLabel}
        accessibilityState={{ disabled: !ready, busy: sending }}
        disabled={!ready}
        onPress={onSend}
        style={[styles.send, ready ? styles.sendReady : styles.sendIdle]}
      >
        {sending ? (
          <ActivityIndicator color={colors.onAmber} />
        ) : (
          <Icon
            name="arrow-up"
            size={22}
            color={ready ? colors.onAmber : colors.textDim}
          />
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  dayRow: { alignItems: "center", marginTop: 16, marginBottom: 4 },
  dayChip: {
    fontSize: 11,
    letterSpacing: 0.6,
    ...weight("700"),
    color: colors.textDim,
    backgroundColor: chatColors.chip,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  eventRow: { alignItems: "center", marginVertical: 8 },
  eventText: {
    fontSize: 12,
    color: colors.textDim,
    textAlign: "center",
    ...weight("600"),
  },
  row: { flexDirection: "row", alignItems: "flex-end" },
  rowMine: { justifyContent: "flex-end" },
  avatarSlot: { width: 34 },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#FFFFFF", fontSize: 12, ...weight("700") },
  bubble: {
    maxWidth: "80%",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
    borderWidth: 1,
  },
  mine: {
    backgroundColor: chatColors.mine,
    borderColor: chatColors.mineBorder,
  },
  theirs: {
    backgroundColor: chatColors.theirs,
    borderColor: chatColors.theirsBorder,
  },
  tailMine: { borderBottomRightRadius: 4 },
  tailTheirs: { borderBottomLeftRadius: 4 },
  emojiWrap: { maxWidth: "80%", paddingHorizontal: 2 },
  emoji: { fontSize: 34, lineHeight: 42 },
  sender: { fontSize: 12, ...weight("700"), marginBottom: 2 },
  body: { fontSize: 15, lineHeight: 21, color: colors.text },
  link: { color: colors.amberDeep, ...weight("600") },
  time: {
    fontSize: 11,
    color: colors.textDim,
    alignSelf: "flex-end",
    marginTop: 2,
  },
  timeEmoji: { marginTop: 0 },
  planCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 2,
    padding: 10,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: chatColors.theirsBorder,
    borderLeftWidth: 4,
    borderLeftColor: colors.amberBright,
  },
  planCardSoon: { borderLeftColor: colors.red },
  tile: {
    width: 44,
    height: 46,
    borderRadius: 10,
    backgroundColor: colors.amberSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  tileMonth: { fontSize: 10, ...weight("700"), color: colors.amberDeep },
  tileDay: {
    fontSize: 18,
    lineHeight: 22,
    ...weight("800"),
    color: colors.text,
  },
  planCopy: { flex: 1, minWidth: 0 },
  planWhen: { fontSize: 14, ...weight("700"), color: colors.text },
  planWhere: { fontSize: 12, color: colors.textDim, marginTop: 2 },
  goingPill: {
    backgroundColor: colors.amberBright,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  goingText: { fontSize: 12, ...weight("700"), color: colors.onAmber },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingTop: 9,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderColor: chatColors.theirsBorder,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    minHeight: 46,
    maxHeight: 120,
    fontSize: 15,
    lineHeight: 21,
    borderRadius: 23,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: chatColors.canvas,
    color: colors.text,
  },
  send: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  sendIdle: { backgroundColor: chatColors.chip },
  sendReady: {
    backgroundColor: colors.amberBright,
    shadowColor: colors.amberDeep,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
});
