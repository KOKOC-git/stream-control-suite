import { useState } from "react";
import type { SourceProfile, SourceType, StreamMetric } from "../types";
import { createProfileFromDraft } from "../services/sourceProfiles";

export function SaveUnknownStreamModal({
  stream,
  close,
  save
}: {
  stream: StreamMetric;
  close: () => void;
  save: (profile: SourceProfile) => void;
}) {
  const [name, setName] = useState(stream.name);
  const [type, setType] = useState<SourceType>("rtmp");
  const [notes, setNotes] = useState("");

  const submit = () => {
    if (!name.trim()) return;

    save(
      createProfileFromDraft({
        name: name.trim(),
        streamKey: stream.name,
        type,
        notes
      })
    );
  };

  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="rename-modal" onClick={event => event.stopPropagation()}>
        <h2>Сохранить обнаруженный поток</h2>
        <p>
          Поток <code>{stream.name}</code> будет добавлен как постоянный профиль.
        </p>

        <label>
          Название
          <input
            autoFocus
            value={name}
            onChange={event => setName(event.target.value)}
          />
        </label>

        <label>
          Тип источника
          <select
            value={type}
            onChange={event => setType(event.target.value as SourceType)}
          >
            <option value="gopro">GoPro</option>
            <option value="phone">Телефон</option>
            <option value="dji">DJI</option>
            <option value="rtmp">Другой RTMP</option>
          </select>
        </label>

        <label>
          Примечание
          <input
            value={notes}
            onChange={event => setNotes(event.target.value)}
          />
        </label>

        <div className="rename-actions">
          <button className="secondary" onClick={close}>Отмена</button>
          <button onClick={submit}>Сохранить профиль</button>
        </div>
      </div>
    </div>
  );
}
