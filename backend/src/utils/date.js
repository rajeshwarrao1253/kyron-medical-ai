import dayjs from "dayjs";

export function formatSlotForDisplay(isoString) {
  return dayjs(isoString).format("ddd, MMM D • h:mm A");
}

export function parseSlotLabel(slot) {
  return {
    value: slot,
    label: formatSlotForDisplay(slot)
  };
}
