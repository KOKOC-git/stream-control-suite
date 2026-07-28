import { useEffect, useState } from "react";

export function RenameSourceModal({
  streamKey,
  currentName,
  close,
  save
}: {
  streamKey: string;
  currentName: string;
  close: () => void;
  save: (name: string) => void;
}) {
  const [name, setName] = useState(currentName);

  useEffect(() => {
    setName(currentName);
  }, [currentName]);

  const submit = () => {
    const clean = name.trim();
    save(clean);
  };

  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="rename-modal" onClick={event => event.stopPropagation()}>
        <h2>Переименовать источник</h2>
        <p>
          RTMP-ключ <code>{streamKey}</code> останется прежним.
        </p>

        <label>
          Отображаемое название
          <input
            autoFocus
            value={name}
            maxLength={50}
            placeholder="Например: Общий план"
            onChange={event => setName(event.target.value)}
            onKeyDown={event => {
              if (event.key === "Enter") submit();
              if (event.key === "Escape") close();
            }}
          />
        </label>

        <div className="rename-actions">
          <button className="secondary" onClick={close}>Отмена</button>
          <button onClick={submit}>Сохранить</button>
        </div>
      </div>
    </div>
  );
}
