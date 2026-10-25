// SPDX-License-Identifier: Apache-2.0
/// <reference types="vite/client" />
import { useCallback, useEffect, useRef, useState } from "react";

type ControlMode = "controlled" | "uncontrolled";

export interface ControlModeDiagnostic {
  readonly code: "CONTROL_MODE_CHANGED";
  readonly from: ControlMode;
  readonly to: ControlMode;
}

export interface ControllableStateOptions<T> {
  value?: T | undefined;
  defaultValue: T;
  onChange?: (next: T) => void;
  onModeChange?: (diagnostic: Readonly<ControlModeDiagnostic>) => void;
}

/** Share value-based input behavior without logging component data. */
export function useControllableState<T>({
  value,
  defaultValue,
  onChange,
  onModeChange,
}: ControllableStateOptions<T>): readonly [T, (next: T) => void] {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const mode: ControlMode = value === undefined ? "uncontrolled" : "controlled";
  const previousMode = useRef(mode);
  let currentValue = uncontrolledValue;
  if (value !== undefined) {
    currentValue = value;
  }

  useEffect(() => {
    const from = previousMode.current;
    if (from !== mode) {
      previousMode.current = mode;
      if (import.meta.env.DEV) {
        onModeChange?.({ code: "CONTROL_MODE_CHANGED", from, to: mode });
      }
    }
  }, [mode, onModeChange]);

  const setValue = useCallback(
    (next: T) => {
      if (Object.is(next, currentValue)) {
        return;
      }
      if (mode === "uncontrolled") {
        setUncontrolledValue(next);
      }
      onChange?.(next);
    },
    [currentValue, mode, onChange],
  );

  return [currentValue, setValue];
}
