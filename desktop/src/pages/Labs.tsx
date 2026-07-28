import { useMemo, useState } from "react";
import { QrModal } from "../components/QrModal";

type QR = { title: string; subtitle: string; command: string };

export function Labs({ ip }: { ip: string }) {
  const [ssid, setSsid] = useState(localStorage.getItem("gopro-ssid") ?? "");
  const [password, setPassword] = useState("");
  const [camera, setCamera] = useState(1);
  const [quality, setQuality] = useState("1080");
  const [saveCopy, setSaveCopy] = useState(true);
  const [qr, setQr] = useState<QR | null>(null);

  const rtmp = useMemo(
    () => ip ? `rtmp://${ip}/live/cam${camera}` : "rtmp://IP/live/cam1",
    [ip, camera]
  );

  const saveSSID = (value: string) => {
    setSsid(value);
    localStorage.setItem("gopro-ssid", value);
  };

  return (
    <section className="two-column">
      <div className="panel">
        <h2>Сеть и RTMP</h2>
        <p>Подтверждённые команды GoPro Labs для HERO9.</p>

        <label>SSID сети
          <input value={ssid} onChange={e => saveSSID(e.target.value)} placeholder="Travel_MEM-5G" />
        </label>
        <label>Пароль Wi‑Fi
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} />
        </label>
        <button disabled={!ssid || !password} onClick={() => setQr({
          title: "Сохранить Wi‑Fi", subtitle: ssid, command: `!MJOIN="${ssid}:${password}"`
        })}>Показать QR Wi‑Fi</button>

        <hr />

        <div className="segmented">
          {[1,2,3].map(n => <button key={n} className={camera === n ? "selected" : ""}
            onClick={() => setCamera(n)}>Камера {n}</button>)}
        </div>
        <label>RTMP-адрес<input value={rtmp} readOnly /></label>
        <button disabled={!ip} onClick={() => setQr({
          title: `Камера ${camera}: сохранить RTMP`, subtitle: rtmp,
          command: `!MRTMP="${rtmp}"`
        })}>Показать QR RTMP</button>
      </div>

      <div className="panel">
        <h2>Запуск эфира</h2>
        <label>Разрешение
          <select value={quality} onChange={e => setQuality(e.target.value)}>
            <option value="480">480p</option>
            <option value="720">720p</option>
            <option value="1080">1080p</option>
          </select>
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={saveCopy} onChange={e => setSaveCopy(e.target.checked)} />
          Сохранять копию на карте
        </label>
        <button onClick={() => setQr({
          title: `Камера ${camera}: запуск`,
          subtitle: `${quality}p${saveCopy ? " + запись копии" : ""}`,
          command: `oW1mVr${quality}!W!GL${saveCopy ? "C" : ""}`
        })}>Показать QR запуска</button>
        <button className="secondary" onClick={() => setQr({
          title: "Остановить команду", subtitle: "GoPro Labs", command: "!E"
        })}>Показать QR остановки</button>

        <div className="command-preview">
          <span>Команда запуска</span>
          <code>oW1mVr{quality}!W!GL{saveCopy ? "C" : ""}</code>
        </div>
      </div>

      {qr && <QrModal {...qr} close={() => setQr(null)} />}
    </section>
  );
}
