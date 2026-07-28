import { useMemo, useState } from "react";
import type { SourceProfile, StreamMetric } from "../types";
import { SourceManager } from "../components/SourceManager";
import { QrModal } from "../components/QrModal";

type QR = { title: string; subtitle: string; command: string };

export function GoPro({
  profiles,
  streams,
  ip,
  updateProfiles
}: {
  profiles: SourceProfile[];
  streams: StreamMetric[];
  ip: string;
  updateProfiles: (profiles: SourceProfile[]) => void;
}) {
  const [ssid, setSsid] = useState(localStorage.getItem("gopro-ssid") ?? "");
  const [password, setPassword] = useState("");
  const [quality, setQuality] = useState("1080");
  const [saveCopy, setSaveCopy] = useState(true);
  const [qr, setQr] = useState<QR | null>(null);

  const saveSSID = (value: string) => {
    setSsid(value);
    localStorage.setItem("gopro-ssid", value);
  };

  return (
    <>
      <div className="two-column gopro-settings">
        <div className="panel">
          <h2>Сеть GoPro</h2>
          <label>
            SSID
            <input value={ssid} onChange={e => saveSSID(e.target.value)} />
          </label>
          <label>
            Пароль
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </label>
          <button
            disabled={!ssid || !password}
            onClick={() =>
              setQr({
                title: "Сохранить Wi‑Fi",
                subtitle: ssid,
                command: `!MJOIN="${ssid}:${password}"`
              })
            }
          >
            QR Wi‑Fi
          </button>
        </div>

        <div className="panel">
          <h2>Параметры запуска</h2>
          <label>
            Разрешение
            <select value={quality} onChange={e => setQuality(e.target.value)}>
              <option value="480">480p</option>
              <option value="720">720p</option>
              <option value="1080">1080p</option>
            </select>
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={saveCopy}
              onChange={e => setSaveCopy(e.target.checked)}
            />
            Сохранять копию
          </label>
          <button
            onClick={() =>
              setQr({
                title: "Запустить GoPro Live",
                subtitle: `${quality}p`,
                command: `oW1mVr${quality}!W!GL${saveCopy ? "C" : ""}`
              })
            }
          >
            QR запуска
          </button>
        </div>
      </div>

      <SourceManager
        type="gopro"
        profiles={profiles}
        streams={streams}
        ip={ip}
        updateProfiles={updateProfiles}
        extra={profile => {
          const rtmp = ip
            ? `rtmp://${ip}/live/${profile.streamKey}`
            : `rtmp://IP/live/${profile.streamKey}`;
          return (
            <div className="profile-extra-actions">
              <button
                className="secondary"
                disabled={!ip}
                onClick={() =>
                  setQr({
                    title: `${profile.name}: сохранить RTMP`,
                    subtitle: rtmp,
                    command: `!MRTMP="${rtmp}"`
                  })
                }
              >
                QR RTMP
              </button>
              <button
                className="secondary"
                onClick={() =>
                  setQr({
                    title: `${profile.name}: запуск`,
                    subtitle: `${quality}p`,
                    command: `oW1mVr${quality}!W!GL${saveCopy ? "C" : ""}`
                  })
                }
              >
                QR запуска
              </button>
            </div>
          );
        }}
      />

      {qr && <QrModal {...qr} close={() => setQr(null)} />}
    </>
  );
}
