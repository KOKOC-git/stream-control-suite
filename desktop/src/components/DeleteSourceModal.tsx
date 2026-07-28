import type { SourceProfile } from "../types";

export function DeleteSourceModal({
  profile,
  active,
  close,
  confirm
}: {
  profile: SourceProfile;
  active: boolean;
  close: () => void;
  confirm: () => void;
}) {
  return (
    <div className="modal-backdrop" onClick={close}>
      <div
        className="delete-source-modal"
        onClick={event => event.stopPropagation()}
      >
        <h2>Удалить источник?</h2>
        <p>
          Профиль <strong>«{profile.name}»</strong> будет удалён из приложения.
        </p>

        <div className="delete-source-details">
          <span>RTMP-ключ</span>
          <code>{profile.streamKey}</code>
        </div>

        {active && (
          <div className="delete-warning">
            Поток сейчас активен. Удаление профиля не остановит вещание:
            источник снова появится в мультивью как неизвестный поток.
          </div>
        )}

        <p className="delete-note">
          Источники и сцены, ранее созданные в OBS, автоматически не удаляются.
        </p>

        <div className="rename-actions">
          <button className="secondary" onClick={close}>
            Отмена
          </button>
          <button className="danger" onClick={confirm}>
            Удалить профиль
          </button>
        </div>
      </div>
    </div>
  );
}
