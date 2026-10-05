import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  runOnJS,
  runOnUI,
  scrollTo,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useFrameCallback,
  useSharedValue,
} from "react-native-reanimated";

import type { TeleprompterSettings } from "@/src/store/settings";

export type TeleprompterHandle = {
  restart: () => void;
  jumpBy: (px: number) => void;
  getPosition: () => number;
  setPosition: (px: number) => void;
};

type Props = {
  content: string;
  settings: TeleprompterSettings;
  playing: boolean;
  onReachEnd?: () => void;
  /** darken the text area so it reads over camera; 0 = transparent */
  overlayOpacity?: number;
};

/**
 * UI-thread teleprompter engine.
 *
 * The auto-scroll loop runs on the native UI thread via reanimated's
 * `useFrameCallback` + `scrollTo` worklet, so it keeps scrolling smoothly even
 * while the JS thread is busy — most importantly during active camera video
 * recording (the previous requestAnimationFrame loop lived on the JS thread and
 * got starved while recording, so the text appeared frozen).
 *
 * Playback state (offset / speed / dragging) lives in shared values that are
 * NEVER reset by a parent re-render or by the camera recording state changing.
 * Only an explicit restart()/setPosition()/jumpBy() moves the position. Exactly
 * one frame loop ever exists — `playing` just toggles it via setActive(), so we
 * can never spawn duplicate loops that would accelerate scrolling.
 */
export const Teleprompter = forwardRef<TeleprompterHandle, Props>(function Teleprompter(
  { content, settings, playing, onReachEnd, overlayOpacity = 0 },
  ref,
) {
  const aref = useAnimatedRef<Animated.ScrollView>();

  // Persistent playback state (survives re-renders / recording-state changes).
  const offset = useSharedValue(0); // currentScriptPosition (px)
  const speed = useSharedValue(settings.speed); // scrollSpeed (px/s)
  const contentH = useSharedValue(0);
  const viewH = useSharedValue(0);
  const dragging = useSharedValue(false);
  const reachedEnd = useSharedValue(false);

  const [padV, setPadV] = useState(160); // vertical padding so lines sit near the lens

  // Keep scroll speed live WITHOUT restarting the loop -> immediate speed change.
  useEffect(() => {
    speed.value = settings.speed;
  }, [settings.speed, speed]);

  // Single UI-thread scroll loop. Advances the offset by speed*dt each frame and
  // scrolls the list. Runs on the UI thread so it is unaffected by JS-thread load
  // during recording.
  const frame = useFrameCallback((info) => {
    "worklet";
    if (dragging.value) return;
    const dt = (info.timeSincePreviousFrame ?? 16) / 1000;
    const max = Math.max(0, contentH.value - viewH.value);
    let next = offset.value + speed.value * dt;
    if (max > 0 && next >= max) {
      next = max;
      if (!reachedEnd.value) {
        reachedEnd.value = true;
        if (onReachEnd) runOnJS(onReachEnd)();
      }
    }
    offset.value = next;
    scrollTo(aref, 0, next, false);
  }, false);

  // Toggle the one loop on/off from the `playing` prop. Offset is preserved, so
  // pause/resume (and recording start) continue from the exact position; we never
  // reset to the top here.
  useEffect(() => {
    frame.setActive(!!playing);
  }, [playing, frame]);

  useImperativeHandle(
    ref,
    () => ({
      restart: () => {
        reachedEnd.value = false;
        offset.value = 0;
        runOnUI(() => {
          "worklet";
          scrollTo(aref, 0, 0, true);
        })();
      },
      jumpBy: (px: number) => {
        runOnUI(() => {
          "worklet";
          const max = Math.max(0, contentH.value - viewH.value);
          const n = Math.min(max, Math.max(0, offset.value + px));
          offset.value = n;
          if (n < max) reachedEnd.value = false;
          scrollTo(aref, 0, n, true);
        })();
      },
      getPosition: () => offset.value,
      setPosition: (px: number) => {
        runOnUI(() => {
          "worklet";
          const max = Math.max(0, contentH.value - viewH.value);
          const n = Math.min(max, Math.max(0, px));
          offset.value = n;
          reachedEnd.value = false;
          scrollTo(aref, 0, n, true);
        })();
      },
    }),
    [aref, offset, contentH, viewH, reachedEnd],
  );

  // Manual drag keeps offset in sync so auto-scroll resumes from where the user
  // left off; dragging pauses the auto-advance so it does not fight the user.
  const scrollHandler = useAnimatedScrollHandler({
    onBeginDrag: () => {
      dragging.value = true;
    },
    onScroll: (e) => {
      if (dragging.value) offset.value = e.contentOffset.y;
    },
    onEndDrag: (e) => {
      offset.value = e.contentOffset.y;
      reachedEnd.value = false;
      dragging.value = false;
    },
    onMomentumEnd: (e) => {
      offset.value = e.contentOffset.y;
      dragging.value = false;
    },
  });

  const textColor = settings.textColor === "orange" ? "#FF9500" : "#FFFFFF";
  const align =
    settings.position === "top" ? "flex-start" : settings.position === "bottom" ? "flex-end" : "center";

  return (
    <View
      style={styles.root}
      onLayout={(e) => {
        const h = e.nativeEvent.layout.height;
        viewH.value = h;
        setPadV(h ? h * 0.4 : 160);
      }}
    >
      {overlayOpacity > 0 ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(0,0,0,${overlayOpacity})` }]} pointerEvents="none" />
      ) : null}
      <Animated.ScrollView
        ref={aref}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={scrollHandler}
        onContentSizeChange={(_w, h) => {
          contentH.value = h;
        }}
        contentContainerStyle={{
          paddingHorizontal: settings.margin,
          paddingVertical: padV,
          minHeight: "100%",
          justifyContent: align,
        }}
      >
        <Text
          style={[
            styles.text,
            {
              color: textColor,
              fontSize: settings.fontSize,
              lineHeight: settings.fontSize * settings.lineSpacing,
              transform: settings.mirror ? [{ scaleX: -1 }] : undefined,
            },
          ]}
        >
          {content || " "}
        </Text>
      </Animated.ScrollView>
      {/* reading-zone marker near the lens */}
      <View style={styles.readingZone} pointerEvents="none" />
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, overflow: "hidden" },
  text: { fontWeight: "700", textAlign: "center" },
  readingZone: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "38%",
    height: 3,
    backgroundColor: "rgba(255,149,0,0.35)",
  },
});
