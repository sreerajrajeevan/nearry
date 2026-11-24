import React, { useMemo } from "react";
import { View } from "react-native";
import { qrMatrix } from "../utils/qrMatrix";

const MARGIN = 4; // modules of white around the code, as scanners expect

/** A scannable QR code drawn with plain Views, dark on white. */
export function QrCode({ value, size }: { value: string; size: number }) {
  const matrix = useMemo(() => qrMatrix(value), [value]);
  const count = matrix.length + MARGIN * 2;
  const cell = Math.floor(size / count);
  const side = cell * count;
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="QR code"
      style={{
        width: side,
        height: side,
        padding: cell * MARGIN,
        backgroundColor: "#FFFFFF",
      }}
    >
      {matrix.map((row, r) => (
        <View key={r} style={{ flexDirection: "row" }}>
          {row.map((dark, c) => (
            <View
              key={c}
              style={{
                width: cell,
                height: cell,
                backgroundColor: dark ? "#030712" : "#FFFFFF",
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}
