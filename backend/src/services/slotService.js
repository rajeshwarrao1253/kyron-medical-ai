import dayjs from "dayjs";
import { parseSlotLabel } from "../utils/date.js";

const bookingIndex = new Map();

const slotHours = [9, 10, 11, 14, 15, 16];

export function generateSlotsForDoctor(doctorId) {
  const slots = [];
  const today = dayjs().startOf("day");
  for (let i = 1; i <= 60; i += 1) {  // next 60 days, skip today
    const day = today.add(i, "day");
    if (day.day() === 0) continue;
    for (const hour of slotHours) {
      const slot = day.hour(hour).minute(0).second(0).millisecond(0);
      const iso = slot.toISOString();
      if (!isBooked(doctorId, iso)) {
        slots.push(parseSlotLabel(iso));
      }
    }
  }
  return slots;
}

function parseNaturalFilters(query = "") {
  const text = String(query).toLowerCase();
  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const foundDay = dayNames.find((d) => text.includes(d)) || null;

  let period = null;
  if (text.includes("morning")) period = "morning";
  else if (text.includes("afternoon")) period = "afternoon";
  else if (text.includes("evening")) period = "evening";

  let range = null;
  if (text.includes("next week")) range = "next_week";
  else if (text.includes("this week")) range = "this_week";
  else if (text.includes("today")) range = "today";
  else if (text.includes("tomorrow")) range = "tomorrow";

  return { rawQuery: query, day: foundDay, period, range };
}

function matchesPeriod(day, period) {
  const hour = day.hour();
  if (period === "morning") return hour >= 6 && hour < 12;
  if (period === "afternoon") return hour >= 12 && hour < 17;
  if (period === "evening") return hour >= 17 && hour < 21;
  return true;
}

function matchesRange(day, range) {
  const now = dayjs();
  if (!range) return true;
  if (range === "today") return day.isSame(now, "day");
  if (range === "tomorrow") return day.isSame(now.add(1, "day"), "day");
  if (range === "this_week") {
    const start = now.startOf("week");
    const end = now.endOf("week");
    return (day.isAfter(start) || day.isSame(start, "day")) && (day.isBefore(end) || day.isSame(end, "day"));
  }
  if (range === "next_week") {
    const start = now.add(1, "week").startOf("week");
    const end = now.add(1, "week").endOf("week");
    return (day.isAfter(start) || day.isSame(start, "day")) && (day.isBefore(end) || day.isSame(end, "day"));
  }
  return true;
}

function matchesDayName(day, dayName) {
  if (!dayName) return true;
  return day.format("dddd").toLowerCase() === dayName;
}

export function filterSlots(slots, query = "") {
  const filters = parseNaturalFilters(query);
  const filtered = slots.filter((slot) => {
    const day = dayjs(slot.value);
    return matchesDayName(day, filters.day) && matchesPeriod(day, filters.period) && matchesRange(day, filters.range);
  });
  return {
    filters,
    slots: filtered.length > 0 ? filtered : slots.slice(0, 8)
  };
}

function bookingKey(doctorId, slotValue) {
  return `${doctorId}::${slotValue}`;
}

export function isBooked(doctorId, slotValue) {
  return bookingIndex.has(bookingKey(doctorId, slotValue));
}

export function reserveSlot(doctorId, slotValue, appointment) {
  const key = bookingKey(doctorId, slotValue);
  if (bookingIndex.has(key)) {
    return false;
  }
  bookingIndex.set(key, appointment);
  return true;
}

export function getAvailableSlots(doctorId, naturalQuery = "") {
  const all = generateSlotsForDoctor(doctorId);
  return filterSlots(all, naturalQuery);
}
