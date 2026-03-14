import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

type MotionSnapshot = {
  acceleration: number;
  jerk: number;
  rotation: number;
  tilt: number;
};

type DeviceOrientationEventWithPermission = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

function App() {
  const initialMotionPermission = getInitialMotionPermission();
  const secureContext = window.isSecureContext;

  const [phase, setPhase] = useState<SessionPhase>("idle");
  const [status, setStatus] = useState(
    "Press start, keep still, and wait for the strike cue.",
  );
  const [lastReactionMs, setLastReactionMs] = useState<number | null>(null);
  const [reactionTimes, setReactionTimes] = useState<ReactionEntry[]>([]);
  const [responseSource, setResponseSource] = useState<ResponseSource | null>(
    null,
  );
  const [motionPermission, setMotionPermission] =
    useState<MotionPermissionState>(initialMotionPermission);
  const [motionDetected, setMotionDetected] = useState(false);
  const [motionSnapshot, setMotionSnapshot] = useState<MotionSnapshot>({
    acceleration: 0,
    jerk: 0,
    rotation: 0,
    tilt: 0,
  });
  const [sensorEventsSeen, setSensorEventsSeen] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [currentCueType, setCurrentCueType] = useState<CueType | null>(null);

  const phaseRef = useRef<SessionPhase>("idle");
  const cueTimeoutRef = useRef<number | null>(null);
  const cueShownAtRef = useRef<number | null>(null);
  const lastMotionTriggerRef = useRef(0);
  const lastMotionUiUpdateRef = useRef(0);
  const previousAccelerationRef = useRef<{
    x: number;
    y: number;
    z: number;
  } | null>(null);
  const previousOrientationRef = useRef<{ beta: number; gamma: number } | null>(
    null,
  );
  const installPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const currentCueTypeRef = useRef<CueType | null>(null);
  const speechWarmedRef = useRef(false);

  const availableCueTypes = useMemo<CueType[]>(() => {
    const types: CueType[] = ["visual"];
    if ("vibrate" in navigator) types.push("vibration");
    if ("speechSynthesis" in window) types.push("audio");
    return types;
  }, []);

  const updatePhase = useCallback((nextPhase: SessionPhase) => {
    phaseRef.current = nextPhase;
    setPhase(nextPhase);
  }, []);

  const vibrate = useCallback((pattern: number | number[]) => {
    if ("vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  }, []);

  const clearQueuedCue = useCallback(() => {
    if (cueTimeoutRef.current !== null) {
      window.clearTimeout(cueTimeoutRef.current);
      cueTimeoutRef.current = null;
    }
    if ("speechSynthesis" in window) {
      speechSynthesis.cancel();
    }
    if ("vibrate" in navigator) {
      navigator.vibrate(0);
    }
  }, []);

  const finishRound = useCallback(
    (source: ResponseSource) => {
      if (phaseRef.current !== "ready" || cueShownAtRef.current === null) {
        return;
      }

      const reactionMs = Math.max(
        0,
        Math.round(performance.now() - cueShownAtRef.current),
      );

      const cueType = currentCueTypeRef.current ?? "visual";

      clearQueuedCue();
      cueShownAtRef.current = null;
      setLastReactionMs(reactionMs);
      setReactionTimes((previous) =>
        [{ ms: reactionMs, cueType, input: source }, ...previous].slice(0, 36),
      );
      setResponseSource(source);

      const cueLabel =
        cueType === "vibration"
          ? "Vibration"
          : cueType === "audio"
            ? "Audio"
            : "Visual";
      setStatus(
        `${cueLabel} · ${
          source === "motion" ? "Hook set" : "Manual"
        } response in ${reactionMs} ms.`,
      );
      updatePhase("responded");
      vibrate(35);
    },
    [clearQueuedCue, updatePhase, vibrate],
  );

  const startRound = useCallback(() => {
    clearQueuedCue();
    cueShownAtRef.current = null;
    setResponseSource(null);
    setMotionDetected(false);
    setCurrentCueType(null);
    currentCueTypeRef.current = null;
    setStatus("Wait for the strike cue. Keep your wrist relaxed and ready.");
    updatePhase("arming");

    if (!speechWarmedRef.current && "speechSynthesis" in window) {
      speechWarmedRef.current = true;
      const warmUp = new SpeechSynthesisUtterance("");
      warmUp.volume = 0;
      speechSynthesis.speak(warmUp);
    }

    const delay = Math.round(
      Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS) + MIN_DELAY_MS,
    );

    cueTimeoutRef.current = window.setTimeout(() => {
      const cueType =
        availableCueTypes[
          Math.floor(Math.random() * availableCueTypes.length)
        ];
      currentCueTypeRef.current = cueType;
      setCurrentCueType(cueType);
      cueShownAtRef.current = performance.now();

      if (cueType === "vibration") {
        vibrate([120, 60, 120]);
      } else if (cueType === "audio") {
        const utterance = new SpeechSynthesisUtterance("Set!");
        utterance.rate = 1.2;
        utterance.pitch = 1.1;
        utterance.volume = 1;
        speechSynthesis.speak(utterance);
      }

      if (cueType === "visual") {
        setStatus("Strike now! React to the flash.");
      }

      updatePhase("ready");
    }, delay);
  }, [clearQueuedCue, updatePhase, vibrate, availableCueTypes]);

  const requestMotionAccess = useCallback(async () => {
    if (
      typeof DeviceMotionEvent === "undefined" &&
      typeof DeviceOrientationEvent === "undefined"
    ) {
      setMotionPermission("unsupported");
      return;
    }

    const motionEvent =
      typeof DeviceMotionEvent === "undefined"
        ? null
        : (DeviceMotionEvent as DeviceMotionEventWithPermission);
    const orientationEvent =
      typeof DeviceOrientationEvent === "undefined"
        ? null
        : (DeviceOrientationEvent as DeviceOrientationEventWithPermission);

    try {
      const results = await Promise.all([
        typeof motionEvent?.requestPermission === "function"
          ? motionEvent.requestPermission()
          : Promise.resolve<"granted">("granted"),
        typeof orientationEvent?.requestPermission === "function"
          ? orientationEvent.requestPermission()
          : Promise.resolve<"granted">("granted"),
      ]);

      setMotionPermission(
        results.every((result: "granted" | "denied") => result === "granted")
          ? "granted"
          : "denied",
      );
    } catch {
      setMotionPermission("denied");
    }
  }, []);

  const installApp = useCallback(async () => {
    if (!installPromptRef.current) {
      return;
    }

    await installPromptRef.current.prompt();
    const choice = await installPromptRef.current.userChoice;

    if (choice.outcome === "accepted") {
      setCanInstall(false);
      installPromptRef.current = null;
    }
  }, []);

  useEffect(() => {
    const onMotion = (event: DeviceMotionEvent) => {
      setSensorEventsSeen(true);

      const linearAcceleration = event.acceleration;
      const gravityAcceleration = event.accelerationIncludingGravity;

      const linearX = linearAcceleration?.x ?? 0;
      const linearY = linearAcceleration?.y ?? 0;
      const linearZ = linearAcceleration?.z ?? 0;
      const linearMagnitude = Math.sqrt(
        linearX * linearX + linearY * linearY + linearZ * linearZ,
      );

      const gravityX = gravityAcceleration?.x ?? 0;
      const gravityY = gravityAcceleration?.y ?? 0;
      const gravityZ = gravityAcceleration?.z ?? 0;

      const previousAcceleration = previousAccelerationRef.current;
      const jerkMagnitude = previousAcceleration
        ? Math.sqrt(
            (gravityX - previousAcceleration.x) *
              (gravityX - previousAcceleration.x) +
              (gravityY - previousAcceleration.y) *
                (gravityY - previousAcceleration.y) +
              (gravityZ - previousAcceleration.z) *
                (gravityZ - previousAcceleration.z),
          )
        : 0;

      previousAccelerationRef.current = {
        x: gravityX,
        y: gravityY,
        z: gravityZ,
      };

      const alpha = Math.abs(event.rotationRate?.alpha ?? 0);
      const beta = Math.abs(event.rotationRate?.beta ?? 0);
      const gamma = Math.abs(event.rotationRate?.gamma ?? 0);
      const rotationMagnitude = Math.max(alpha, beta, gamma);

      const now = performance.now();
      if (now - lastMotionUiUpdateRef.current > MOTION_UI_UPDATE_MS) {
        lastMotionUiUpdateRef.current = now;
        setMotionSnapshot((previous) => ({
          ...previous,
          acceleration: roundMetric(linearMagnitude),
          jerk: roundMetric(jerkMagnitude),
          rotation: roundMetric(rotationMagnitude),
        }));
      }

      const hasStrongMotion =
        linearMagnitude >= MOTION_LINEAR_ACCELERATION_THRESHOLD ||
        jerkMagnitude >= MOTION_JERK_THRESHOLD ||
        rotationMagnitude >= MOTION_ROTATION_THRESHOLD;

      if (
        !hasStrongMotion ||
        now - lastMotionTriggerRef.current < MOTION_COOLDOWN_MS
      ) {
        return;
      }

      lastMotionTriggerRef.current = now;
      setMotionDetected(true);

      if (phaseRef.current === "ready") {
        finishRound("motion");
      }
    };

    window.addEventListener("devicemotion", onMotion);
    return () => window.removeEventListener("devicemotion", onMotion);
  }, [finishRound]);

  useEffect(() => {
    const onOrientation = (event: DeviceOrientationEvent) => {
      setSensorEventsSeen(true);

      const beta = event.beta ?? 0;
      const gamma = event.gamma ?? 0;
      const previousOrientation = previousOrientationRef.current;
      const tiltDelta = previousOrientation
        ? Math.max(
            Math.abs(beta - previousOrientation.beta),
            Math.abs(gamma - previousOrientation.gamma),
          )
        : 0;

      previousOrientationRef.current = { beta, gamma };

      const now = performance.now();
      if (now - lastMotionUiUpdateRef.current > MOTION_UI_UPDATE_MS) {
        lastMotionUiUpdateRef.current = now;
        setMotionSnapshot((previous) => ({
          ...previous,
          tilt: roundMetric(tiltDelta),
        }));
      }

      if (
        tiltDelta < MOTION_TILT_THRESHOLD ||
        now - lastMotionTriggerRef.current < MOTION_COOLDOWN_MS
      ) {
        return;
      }

      lastMotionTriggerRef.current = now;
      setMotionDetected(true);

      if (phaseRef.current === "ready") {
        finishRound("motion");
      }
    };

    window.addEventListener("deviceorientation", onOrientation);
    return () => window.removeEventListener("deviceorientation", onOrientation);
  }, [finishRound]);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      installPromptRef.current = event as BeforeInstallPromptEvent;
      setCanInstall(true);
    };

    const onAppInstalled = () => {
      setIsInstalled(true);
      setCanInstall(false);
      installPromptRef.current = null;
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  useEffect(
    () => () => {
      clearQueuedCue();
    },
    [clearQueuedCue],
  );

  const statsByType = useMemo(() => {
    const result: Record<
      CueType,
      { best: number | null; avg: number | null; count: number }
    > = {
      vibration: { best: null, avg: null, count: 0 },
      audio: { best: null, avg: null, count: 0 },
      visual: { best: null, avg: null, count: 0 },
    };

    for (const entry of reactionTimes) {
      const bucket = result[entry.cueType];
      bucket.count += 1;
      bucket.avg =
        bucket.avg === null
          ? entry.ms
          : Math.round(
              (bucket.avg * (bucket.count - 1) + entry.ms) / bucket.count,
            );
      bucket.best =
        bucket.best === null ? entry.ms : Math.min(bucket.best, entry.ms);
    }

    return result;
  }, [reactionTimes]);

  const averageReaction = useMemo(() => {
    if (reactionTimes.length === 0) return null;
    return Math.round(
      reactionTimes.reduce((sum, e) => sum + e.ms, 0) / reactionTimes.length,
    );
  }, [reactionTimes]);

  const bestReaction = useMemo(() => {
    if (reactionTimes.length === 0) return null;
    return Math.min(...reactionTimes.map((e) => e.ms));
  }, [reactionTimes]);

  const isVisualRound = phase === "ready" && currentCueType === "visual";

  const indicatorPhaseClass =
    phase === "ready" && currentCueType !== "visual"
      ? "phase-arming"
      : `phase-${phase}`;

  const indicatorLabel = isVisualRound
    ? "STRIKE"
    : phase === "responded"
      ? "LANDED"
      : phase === "arming" || (phase === "ready" && currentCueType !== "visual")
        ? "WAIT"
        : "READY";

  const cueTypeLabel = (type: CueType) =>
    type === "vibration" ? "Vibration" : type === "audio" ? "Audio" : "Visual";

  const cueTypeIcon = (type: CueType) =>
    type === "vibration" ? "\uD83D\uDCF3" : type === "audio" ? "\uD83D\uDD0A" : "\uD83D\uDCA1";

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <p className="eyebrow">Fishing reaction trainer</p>
        <h1>Train your hook set timing.</h1>
        <p className="hero-copy">
          Each round delivers a random stimulus—vibration, a voice saying
          &ldquo;Set!&rdquo;, or a visual flash—then measures how fast you
          react. Compare your response speed across all three senses.
        </p>

        <div className="control-row">
          <button className="primary-button" onClick={startRound}>
            {phase === "arming" || phase === "ready"
              ? "Reset round"
              : "Start round"}
          </button>
          <button
            className="secondary-button"
            onClick={() => finishRound("manual")}
            disabled={phase !== "ready"}
          >
            Manual strike
          </button>
          {motionPermission === "prompt" && (
            <button className="secondary-button" onClick={requestMotionAccess}>
              Enable motion
            </button>
          )}
          {canInstall && !isInstalled && (
            <button className="secondary-button" onClick={installApp}>
              Install app
            </button>
          )}
        </div>

        <div className="status-strip">
          <span
            className={`status-pill ${
              phase === "ready" && currentCueType !== "visual"
                ? "status-arming"
                : `status-${phase}`
            }`}
          >
            {phase === "responded" && currentCueType
              ? cueTypeLabel(currentCueType).toUpperCase()
              : indicatorLabel}
          </span>
          <p>{status}</p>
        </div>
      </section>

      <section className="board">
        <div className={`indicator-card ${indicatorPhaseClass}`}>
          <div className="water-ring water-ring-outer" />
          <div className="water-ring water-ring-inner" />
          <div className="indicator-core">
            <span className="indicator-title">{indicatorLabel}</span>
            <strong>
              {isVisualRound
                ? "Flick now"
                : phase === "responded"
                  ? `${lastReactionMs ?? 0} ms`
                  : "Hold steady"}
            </strong>
            {phase === "responded" && currentCueType && (
              <span className="cue-type-badge">
                {cueTypeIcon(currentCueType)} {cueTypeLabel(currentCueType)}
              </span>
            )}
          </div>
        </div>

        <div className="stimulus-stats">
          {(["vibration", "audio", "visual"] as CueType[]).map((type) => (
            <article
              key={type}
              className={`stimulus-stat-card${
                !availableCueTypes.includes(type) ? " stat-unavailable" : ""
              }${
                phase === "responded" && currentCueType === type
                  ? " stat-active"
                  : ""
              }`}
            >
              <span className="stimulus-stat-icon">
                {cueTypeIcon(type)}
              </span>
              <h3>{cueTypeLabel(type)}</h3>
              {!availableCueTypes.includes(type) && (
                <span className="stat-note">Not supported</span>
              )}
              <div className="stimulus-stat-row">
                <span>Best</span>
                <strong>
                  {statsByType[type].best !== null
                    ? `${statsByType[type].best} ms`
                    : "—"}
                </strong>
              </div>
              <div className="stimulus-stat-row">
                <span>Avg</span>
                <strong>
                  {statsByType[type].avg !== null
                    ? `${statsByType[type].avg} ms`
                    : "—"}
                </strong>
              </div>
              <div className="stimulus-stat-row">
                <span>Rounds</span>
                <strong>{statsByType[type].count}</strong>
              </div>
            </article>
          ))}
        </div>

        <div className="metric-grid">
          <article className="metric-card">
            <span>Last response</span>
            <strong>
              {lastReactionMs !== null ? `${lastReactionMs} ms` : "—"}
            </strong>
          </article>
          <article className="metric-card">
            <span>Best (overall)</span>
            <strong>
              {bestReaction !== null ? `${bestReaction} ms` : "—"}
            </strong>
          </article>
          <article className="metric-card">
            <span>Average (overall)</span>
            <strong>
              {averageReaction !== null ? `${averageReaction} ms` : "—"}
            </strong>
          </article>
          <article className="metric-card">
            <span>Input</span>
            <strong>{responseSource ?? "pending"}</strong>
          </article>
          <article className="metric-card metric-card-compact">
            <span>Accel</span>
            <strong>{motionSnapshot.acceleration.toFixed(1)}</strong>
          </article>
          <article className="metric-card metric-card-compact">
            <span>Jerk</span>
            <strong>{motionSnapshot.jerk.toFixed(1)}</strong>
          </article>
          <article className="metric-card metric-card-compact">
            <span>Rotation</span>
            <strong>{motionSnapshot.rotation.toFixed(0)}</strong>
          </article>
          <article className="metric-card metric-card-compact">
            <span>Tilt Δ</span>
            <strong>{motionSnapshot.tilt.toFixed(1)}</strong>
          </article>
        </div>
      </section>

      <section className="details-grid">
        <article className="detail-card">
          <h2>Device readiness</h2>
          <ul>
            <li>Motion input: {motionPermission}</li>
            <li>Secure context: {secureContext ? "yes" : "no"}</li>
            <li>Sensor events received: {sensorEventsSeen ? "yes" : "no"}</li>
            <li>
              Haptics: {"vibrate" in navigator ? "available" : "not supported"}
            </li>
            <li>
              Speech:{" "}
              {"speechSynthesis" in window ? "available" : "not supported"}
            </li>
            <li>
              Motion seen this session: {motionDetected ? "yes" : "not yet"}
            </li>
            <li>PWA installed: {isInstalled ? "yes" : "not yet"}</li>
            <li>
              Available cues: {availableCueTypes.map(cueTypeLabel).join(", ")}
            </li>
          </ul>
        </article>

        <article className="detail-card">
          <h2>How to use it</h2>
          <ol>
            <li>
              Open the app on your phone and enable motion access if prompted.
            </li>
            <li>
              Tap start and keep still. A random cue type will fire after a
              delay.
            </li>
            <li>
              <strong>Vibration</strong> — feel the buzz, flick your wrist.
            </li>
            <li>
              <strong>Audio</strong> — hear &ldquo;Set!&rdquo;, flick your
              wrist.
            </li>
            <li>
              <strong>Visual</strong> — see the indicator flash, flick your
              wrist.
            </li>
            <li>
              Your reaction time is measured per stimulus type so you can compare
              senses.
            </li>
          </ol>
        </article>
      </section>
    </main>
  );
}

export default App;

type SessionPhase = "idle" | "arming" | "ready" | "responded";
type MotionPermissionState = "unsupported" | "prompt" | "granted" | "denied";
type ResponseSource = "motion" | "manual";
type CueType = "vibration" | "audio" | "visual";
type ReactionEntry = { ms: number; cueType: CueType; input: ResponseSource };

const MIN_DELAY_MS = 2000;
const MAX_DELAY_MS = 6500;
const MOTION_LINEAR_ACCELERATION_THRESHOLD = 3.5;
const MOTION_JERK_THRESHOLD = 4.5;
const MOTION_ROTATION_THRESHOLD = 90;
const MOTION_TILT_THRESHOLD = 12;
const MOTION_COOLDOWN_MS = 600;
const MOTION_UI_UPDATE_MS = 120;

function getInitialMotionPermission(): MotionPermissionState {
  if (
    typeof DeviceMotionEvent === "undefined" &&
    typeof DeviceOrientationEvent === "undefined"
  ) {
    return "unsupported";
  }

  const motionEvent =
    typeof DeviceMotionEvent === "undefined"
      ? null
      : (DeviceMotionEvent as DeviceMotionEventWithPermission);
  const orientationEvent =
    typeof DeviceOrientationEvent === "undefined"
      ? null
      : (DeviceOrientationEvent as DeviceOrientationEventWithPermission);

  return typeof motionEvent?.requestPermission === "function" ||
    typeof orientationEvent?.requestPermission === "function"
    ? "prompt"
    : "granted";
}

function roundMetric(value: number): number {
  return Math.round(value * 10) / 10;
}
