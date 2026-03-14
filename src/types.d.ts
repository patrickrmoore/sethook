interface DeviceMotionEventWithPermission {
  prototype: DeviceMotionEvent;
  new (type: string, eventInitDict?: DeviceMotionEventInit): DeviceMotionEvent;
  requestPermission?: () => Promise<"granted" | "denied">;
}

interface DeviceOrientationEventWithPermission {
  prototype: DeviceOrientationEvent;
  new (
    type: string,
    eventInitDict?: DeviceOrientationEventInit,
  ): DeviceOrientationEvent;
  requestPermission?: () => Promise<"granted" | "denied">;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
}
