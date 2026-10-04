import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import type { TeleprompterSettings } from "@/src/store/settings";

export type TeleprompterHandle = {
  restart: () => void;
  jumpBy: (px: number) => void;
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
 * Smooth auto-scrolling teleprompter engine. Uses a requestAnimationFrame loop
 * to advance the scroll offset by `speed` px/second while `playing`, with a
 * reading-zone gradient that keeps the active line near the camera lens.
 * Manual scrolling is always available by dragging.
 */
export const Teleprompter = forwardRef<TeleprompterHandle, Props>(function Teleprompter(
  { content, settings, playing, onReachEnd, overlayOpacity = 0 },
  ref,
) {
  const scrollRef = useRef<ScrollView>(null);
  const offset = useRef(0);
  const contentHeight = useRef(0);
  const viewHeight = useRef(0);
  const raf = useRef<number | null>(null);
  const last = useRef<number>(0);
  const dragging = useRef(false);
  const [, force] = useState(0);

  useImperativeHandle(ref, () => ({
    restart: () => {
      offset.current = 0;
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    },
    jumpBy: (px: number) => {
      const max = Math.max(0, contentHeight.current - viewHeight.current);
      offset.current = Math.min(max, Math.max(0, offset.current + px));
      scrollRef.current?.scrollTo({ y: offset.current, animated: true });
    },
  }));

  useEffect(() => {
    if (!playing) {
      if (raf.current != null) cancelAnimationFrame(raf.current);
      raf.current = null;
      return;
    }
    last.current = 0;
    const tick = (ts: number) => {
      if (last.current === 0) last.current = ts;
      const dt = (ts - last.current) / 1000;
      last.current = ts;
      if (!dragging.current) {
        const max = Math.max(0, contentHeight.current - viewHeight.current);
        offset.current = Math.min(max, offset.current + settings.speed * dt);
        scrollRef.current?.scrollTo({ y: offset.current, animated: false });
        if (offset.current >= max && max > 0) {
          onReachEnd?.();
        }
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
      raf.current = null;
    };
  }, [playing, settings.speed, onReachEnd]);

  const textColor = settings.textColor === "orange" ? "#FF9500" : "#FFFFFF";
  const align =
    settings.position === "top" ? "flex-start" : settings.position === "bottom" ? "flex-end" : "center";

  return (
    <View style={styles.root} onLayout={(e) => (viewHeight.current = e.nativeEvent.layout.height)}>
      {overlayOpacity > 0 ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(0,0,0,${overlayOpacity})` }]} pointerEvents="none" />
      ) : null}
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScrollBeginDrag={() => (dragging.current = true)}
        onScrollEndDrag={(e) => {
          offset.current = e.nativeEvent.contentOffset.y;
          dragging.current = false;
        }}
        onMomentumScrollEnd={(e) => (offset.current = e.nativeEvent.contentOffset.y)}
        onContentSizeChange={(_w, h) => {
          contentHeight.current = h;
          force((n) => n + 1);
        }}
        contentContainerStyle={{
          paddingHorizontal: settings.margin,
          paddingVertical: viewHeight.current ? viewHeight.current * 0.4 : 160,
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
      </ScrollView>
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
