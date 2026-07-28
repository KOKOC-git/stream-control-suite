import { useCallback, useEffect, useRef, useState } from "react";
import mpegts from "mpegts.js";
import { openInVlc } from "../services/backend";

export type PreviewMode = "auto" | "flv" | "hls";
type PreviewEngine = "flv" | "hls";
type PreviewState =
  | "idle"
  | "connecting"
  | "playing"
  | "recovering"
  | "failed";

type VideoWithFrameCallback = HTMLVideoElement & {
  requestVideoFrameCallback?: (
    callback: (now: DOMHighResTimeStamp, metadata: VideoFrameCallbackMetadata) => void
  ) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

function cacheBust(url: string, token: number) {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}scc=${token}-${Date.now()}`;
}

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
  const frameCallbackRef = useRef<number | null>(null);
  const lastFrameAtRef = useRef(0);
  const recoveryCountRef = useRef(0);

  const [engine, setEngine] = useState<PreviewEngine>(
    mode === "hls" ? "hls" : "flv"
  );
  const [state, setState] = useState<PreviewState>("idle");
  const [restartToken, setRestartToken] = useState(0);

  const clearTimers = () => {
    timersRef.current.forEach(timer => window.clearInterval(timer));
    timersRef.current = [];
  };

  const stopFrameCallback = () => {
    const video = videoRef.current as VideoWithFrameCallback | null;
    if (
      video &&
      frameCallbackRef.current !== null &&
      video.cancelVideoFrameCallback
    ) {
      video.cancelVideoFrameCallback(frameCallbackRef.current);
    }
    frameCallbackRef.current = null;
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
    setRestartToken(value => value + 1);
  }, [hlsUrl, mode]);

  useEffect(() => {
    recoveryCountRef.current = 0;
    setEngine(mode === "hls" ? "hls" : "flv");
    setRestartToken(value => value + 1);
  }, [mode, flvUrl, hlsUrl]);

  useEffect(() => {
    const video = videoRef.current as VideoWithFrameCallback | null;

    const cleanup = () => {
      clearTimers();
      stopFrameCallback();
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
    lastFrameAtRef.current = performance.now();

    const markFrame = () => {
      lastFrameAtRef.current = performance.now();
      recoveryCountRef.current = 0;
      setState("playing");
    };

    const requestNextFrame = () => {
      if (!video.requestVideoFrameCallback) return;
      frameCallbackRef.current = video.requestVideoFrameCallback(() => {
        markFrame();
        requestNextFrame();
      });
    };

    const onPlaying = () => {
      markFrame();
      requestNextFrame();
    };

    const onTimeUpdate = () => {
      // Fallback for WebViews without requestVideoFrameCallback.
      if (!video.requestVideoFrameCallback) markFrame();
    };

    const onVideoError = () => {
      if (engine === "flv") {
        fallbackToHls();
      } else if (recoveryCountRef.current < 3) {
        recoveryCountRef.current += 1;
        setState("recovering");
        setRestartToken(value => value + 1);
      } else {
        setState("failed");
      }
    };

    const onWaiting = () => {
      if (state !== "connecting") setState("recovering");
    };

    video.addEventListener("playing", onPlaying);
    video.addEventListener("loadeddata", markFrame);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("error", onVideoError);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("stalled", onWaiting);

    if (engine === "hls") {
      if (!video.canPlayType("application/vnd.apple.mpegurl")) {
        setState("failed");
        return cleanup;
      }

      video.preload = "auto";
      video.src = cacheBust(sourceUrl, restartToken);
      video.load();
      video.play().catch(() => {
        // Muted autoplay normally works. A temporary rejection while the
        // playlist is loading is not treated as a fatal stream error.
        setState("connecting");
      });
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

    // Watch decoded frames rather than currentTime. DJI Fly streams can keep
    // the media element "playing" while WebKit displays only one frame.
    timersRef.current.push(
      window.setInterval(() => {
        if (video.readyState < 2 || video.paused) return;
        const frozenFor = performance.now() - lastFrameAtRef.current;
        if (frozenFor < 6000) return;

        setState("recovering");

        if (engine === "flv" && mode === "auto") {
          fallbackToHls();
          return;
        }

        // Native HLS in WKWebView occasionally stops refreshing a live
        // playlist. Re-assigning a cache-busted URL forces a fresh playlist
        // request and resumes from the newest segment.
        if (engine === "hls") {
          recoveryCountRef.current += 1;
          setRestartToken(value => value + 1);
        }
      }, 1500)
    );

    return () => {
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("loadeddata", markFrame);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("error", onVideoError);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("stalled", onWaiting);
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
    recoveryCountRef.current = 0;
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
          : state === "recovering"
            ? `ВОССТАНОВЛЕНИЕ · ${engine.toUpperCase()}`
            : state === "failed"
              ? "НЕТ ПРЕВЬЮ"
              : `${engine.toUpperCase()} · ПОДКЛЮЧЕНИЕ`}
      </div>

      {(state === "connecting" || state === "recovering" || state === "failed") && (
        <div className={`preview-overlay ${state === "recovering" ? "soft" : ""}`}>
          <strong>{camera > 0 ? `Камера ${camera}` : "Источник"}</strong>
          <span>
            {state === "recovering"
              ? "Обновляем live-плейлист и переходим к последнему кадру"
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
