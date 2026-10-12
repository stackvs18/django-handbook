"use client";

import { useSyncExternalStore } from "react";

// Reading progress lives in the visitor's own browser. Nothing is sent anywhere.

const DONE_KEY = "djh:done";
const LAST_KEY = "djh:last";
const EVENT = "djh:progress";

function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
    window.dispatchEvent(new Event(EVENT));
  } catch {
    // storage unavailable (private mode, blocked) - progress just won't persist
  }
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(EVENT, callback);
  };
}

function parseDone(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function useDoneChapters(): string[] {
  const raw = useSyncExternalStore(
    subscribe,
    () => read(DONE_KEY),
    () => null,
  );
  return parseDone(raw);
}

export function useLastChapter(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => read(LAST_KEY),
    () => null,
  );
}

export function setChapterDone(slug: string, done: boolean) {
  const current = new Set(parseDone(read(DONE_KEY)));
  if (done) current.add(slug);
  else current.delete(slug);
  write(DONE_KEY, JSON.stringify([...current]));
}

export function setLastChapter(slug: string) {
  if (read(LAST_KEY) !== slug) write(LAST_KEY, slug);
}

export function resetProgress() {
  try {
    localStorage.removeItem(DONE_KEY);
    localStorage.removeItem(LAST_KEY);
    window.dispatchEvent(new Event(EVENT));
  } catch {}
}
