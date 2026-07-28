import { useCallback, useEffect, useRef, useState } from "react";
import mpegts from "mpegts.js";
import { openInVlc } from "../services/backend";

export type PreviewMode = "auto" | "flv" | "hls";
type PreviewEngine = "flv" | "hls";
type PreviewState =
  | "idle"
  | "connecting"
  | "playing"
  | "stalled"
  | "failed";

export function CameraPreview({
  active,
  flvUrl,
  hlsUrl,
  camera,
  mode = "auto"
}: {
  active: boolean;
  flvUrl?: string;
  hlsUrl?: string;
  camera: number;
  mode?: PreviewMode;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<mpegts.Player | null>(null);
  const timersRef = useRef<number[]>([]);
  const lastProgressRef = useRef({ mediaTime: 0, changedAt: 0 });
  const [engine, setEngine] = useState<PreviewEngine>(
    mode === "hls" ? "hls" : "flv"
  );
  const [state, setState] = useState<PreviewState>("idle");
  const [restartToken, setRestartToken] = useState(0);

  const clearTimers = () => {
    timersRef.current.forEach(timer => window.clearInterval(timer));
    timersRef.current = [];
  };

  const destroyFlv = () => {
    const player = playerRef.current;
    if (!player) return;
    try {
      player.pause();
      player.unload();
      player.detachMediaElement();
      player.destroy();
    } catch {
      // The player may already be disposed after an MSE failure.
    }
    playerRef.current = null;
  };

  const fallbackToHls = useCallback(() => {
    if (!hlsUrl || mode === "flv") {
      setState("failed");
      return;
    }
    destroyFlv();
    clearTimers();
    setEngine("hls");
    setState("connecting");
  }, [hlsUrl, mode]);

  useEffect(() => {
    setEngine(mode === "hls" ? "hls" : "flv");
    setRestartToken(value => value + 1);
  }, [mode, flvUrl, hlsUrl]);

  useEffect(() => {
    const video = videoRef.current;

    const cleanup = () => {
      clearTimers();
      destroyFlv();
      if (video) {
        video.pause();
        video.removeAttribute("src");
        video.load();
      }
    };

    cleanup();

    if (!video || !active) {
      setState("idle");
      return cleanup;
    }

    const sourceUrl = engine === "hls" ? hlsUrl : flvUrl;
    if (!sourceUrl) {
      if (engine === "flv" && hlsUrl && mode !== "flv") {
        fallbackToHls();
      } else {
        setState("failed");
      }
      return cleanup;
    }

    setState("connecting");
    lastProgressRef.current = {
      mediaTime: 0,
      changedAt: performance.now()
    };

    const markPlaying = () => {
      lastProgressRef.current = {
        mediaTime: video.currentTime,
        changedAt: performance.now()
      };
      setState("playing");
    };

    const onTimeUpdate = () => {
      const progress = lastProgressRef.current;
      if (video.currentTime > progress.mediaTime + 0.04) {
        lastProgressRef.current = {
          mediaTime: video.currentTime,
          changedAt: performance.now()
        };
        setState("playing");
      }
    };

    const onVideoError = () => {
      if (engine === "flv") {
        fallbackToHls();
      } else {
        setState("failed");
      }
    };

    video.addEventListener("playing", markPlaying);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("error", onVideoError);

    if (engine === "hls") {
      if (!video.canPlayType("application/vnd.apple.mpegurl")) {
        setState("failed");
        return cleanup;
      }
      video.src = sourceUrl;
      video.load();
      video.play().catch(() => setState("failed"));
    } else {
      if (!mpegts.isSupported()) {
        fallbackToHls();
        return cleanup;
      }

      const player = mpegts.createPlayer(
        {
          type: "flv",
          isLive: true,
          hasAudio: false,
          url: sourceUrl
        },
        {
          enableWorker: false,
          enableStashBuffer: true,
          stashInitialSize: 384,
          lazyLoad: false,
          autoCleanupSourceBuffer: true,
          autoCleanupMaxBackwardDuration: 5,
          autoCleanupMinBackwardDuration: 2,
          liveBufferLatencyChasing: true,
          liveBufferLatencyMaxLatency: 2,
          liveBufferLatencyMinRemain: 0.5,
          liveBufferLatencyChasingOnPaused: true,
          fixAudioTimestampGap: false
        }
      );

      playerRef.current = player;
      player.attachMediaElement(video);
      player.on(mpegts.Events.ERROR, fallbackToHls);
      player.load();
      player.play().catch(() => undefined);

      // Keep FLV near the live edge, but do not seek until several frames exist.
      timersRef.current.push(
        window.setInterval(() => {
          if (!video.buffered.length || video.readyState < 2) return;
          const liveEdge = video.buffered.end(video.buffered.length - 1);
          const latency = liveEdge - video.currentTime;
          if (latency > 2.5) {
            video.currentTime = Math.max(0, liveEdge - 0.5);
          } else {
            video.playbackRate = latency > 1.2 ? 1.05 : 1;
          }
        }, 750)
      );
    }

    // DJI Fly can produce a valid first frame while subsequent MSE timestamps
    // stop advancing in WebKit. Detect this case and change to native HLS.
    timersRef.current.push(
      window.setInterval(() => {
        if (video.readyState < 2 || video.paused) return;
        const progress = lastProgressRef.current;
        const frozenFor = performance.now() - progress.changedAt;
        if (frozenFor < 4000) return;

        setState("stalled");
        if (engine === "flv" && mode === "auto") {
          fallbackToHls();
        }
      }, 1000)
    );

    return () => {
      video.removeEventListener("playing", markPlaying);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("error", onVideoError);
      cleanup();
    };
  }, [
    active,
    engine,
    fallbackToHls,
    flvUrl,
    hlsUrl,
    mode,
    restartToken
  ]);

  const restart = () => {
    setEngine(mode === "hls" ? "hls" : "flv");
    setRestartToken(value => value + 1);
  };

  const vlcUrl = engine === "hls" ? hlsUrl ?? flvUrl : flvUrl ?? hlsUrl;

  if (!active) {
    return (
      <div className="preview preview-empty">
        <strong>{camera > 0 ? `Камера ${camera}` : "Источник"}</strong>
        <span>Ожидание потока</span>
      </div>
    );
  }

  return (
    <div className="preview">
      <video ref={videoRef} muted autoPlay playsInline controls={false} />

      <div className="preview-badge">
        <span className={`preview-dot ${state === "playing" ? "" : "waiting"}`} />
        {state === "playing"
          ? `LIVE · ${engine.toUpperCase()}`
          : state === "stalled"
            ? "КАДР ЗАВИС"
            : state === "failed"
              ? "НЕТ ПРЕВЬЮ"
              : `${engine.toUpperCase()} · ПОДКЛЮЧЕНИЕ`}
      </div>

      {(state === "connecting" || state === "stalled" || state === "failed") && (
        <div className="preview-overlay">
          <strong>{camera > 0 ? `Камера ${camera}` : "Источник"}</strong>
          <span>
            {state === "stalled"
              ? "Поток есть, но изображение не обновляется"
              : state === "failed"
                ? "Не удалось открыть предпросмотр"
                : engine === "hls"
                  ? "Подключение к HLS…"
                  : "Подключение к HTTP-FLV…"}
          </span>
          <div className="preview-overlay-actions">
            <button className="secondary compact" onClick={restart}>
              Перезапустить
            </button>
            {vlcUrl && (
              <button
                className="secondary compact"
                onClick={() => openInVlc(vlcUrl).catch(() => undefined)}
              >
                Открыть в VLC
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
