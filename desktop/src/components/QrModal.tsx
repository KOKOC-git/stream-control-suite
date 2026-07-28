import { QRCodeSVG } from "qrcode.react";

export function QrModal({
  title,
  subtitle,
  command,
  close
}: {
  title: string;
  subtitle: string;
  command: string;
  close: () => void;
}) {
  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="qr-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div><h2>{title}</h2><p>{subtitle}</p></div>
          <button className="secondary" onClick={close}>Закрыть</button>
        </div>
        <div className="qr-box">
          <QRCodeSVG value={command} size={430} level="M" marginSize={3} />
        </div>
        <code>{command}</code>
        <p className="center-muted">Поднеси HERO9 к экрану примерно на 15–30 см.</p>
      </div>
    </div>
  );
}
