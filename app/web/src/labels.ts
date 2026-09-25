import { useSyncExternalStore } from "react";
export const DEFAULT_LABELS = [
  { name: "缺陷", color: "#eb5757" },
  { name: "特性", color: "#bb87fc" },
  { name: "for-claude", color: "#5b8cff" },
  { name: "hold", color: "#d99b25" },
  { name: "改进", color: "#4ea7fc" },
  { name: "phase-1", color: "#1d4ed8" },
  { name: "phase-2", color: "#0f766e" },
  { name: "phase-3", color: "#7c3aed" },
  { name: "phase-4", color: "#b45309" },
  { name: "phase-5", color: "#be123c" },
  { name: "phase-6", color: "#475569" },
] as const;

export function labelColor(name: string): string {
  return readColors()[name] ?? DEFAULT_LABELS.find((label) => label.name === name)?.color ?? "#8b8d92";
}

const COLOR_KEY = "taskboard.label-colors";
const COLOR_EVENT = "taskboard-label-colors-changed";
function readColors(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(COLOR_KEY) ?? "{}"); }
  catch { return {}; }
}
function subscribe(listener: () => void) {
  window.addEventListener(COLOR_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(COLOR_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}
export function useLabelColors() {
  useSyncExternalStore(subscribe, () => localStorage.getItem(COLOR_KEY));
  return labelColor;
}
export function setLabelColor(name: string, color: string) {
  localStorage.setItem(COLOR_KEY, JSON.stringify({ ...readColors(), [name]: color }));
  window.dispatchEvent(new Event(COLOR_EVENT));
}
export const LABEL_PALETTE = [
  ["红色", "#eb5757"], ["橙色", "#f2994a"], ["黄色", "#d99b25"],
  ["绿色", "#27ae60"], ["青色", "#219b94"], ["蓝色", "#4ea7fc"],
  ["紫色", "#bb87fc"], ["粉色", "#e879b0"], ["灰色", "#8b8d92"],
] as const;
