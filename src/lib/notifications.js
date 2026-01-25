import { addToast } from "@heroui/react";

export const playNotificationSound = (name = "announcement") => {
  if (typeof window === "undefined") return;
  try {
    const audio = new Audio(`/audio/${name}`);
    audio.play().catch((err) => console.error("Audio play failed", err));
  } catch (e) {
    console.error("Audio error", e);
  }
};


export const sendPushNotification = async ({ title, body, tag, data } = {}) => {
  addToast({
    title,
    description: body || "",
    severity: "success",
    timeout: 0,
  });
  return true;
};

