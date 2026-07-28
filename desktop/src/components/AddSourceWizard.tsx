import { useMemo, useState } from "react";
import type {
  SourceDraft,
  SourceProfile,
  SourceType
} from "../types";
import {
  createProfileFromDraft,
  nextStreamKey,
  sanitizeStreamKey
} from "../services/sourceProfiles";

const choices: Array<{
  type: SourceType;
  title: string;
  description: string;
}> = [
  {
    type: "gopro",
    title: "GoPro",
    description: "GoPro Labs, QR Wi‑Fi и RTMP"
  },
  {
    type: "phone",
    title: "Телефон",
    description: "Larix, PRISM, CameraFi и другие"
  },
  {
    type: "dji",
    title: "DJI",
    description: "Pocket, Neo, дроны и DJI Fly"
  },
  {
    type: "rtmp",
    title: "Другой RTMP",
    description: "Энкодер, IP-камера, OBS или другое устройство"
  }
];

export function AddSourceWizard({
  profiles,
  close,
  create
}: {
  profiles: SourceProfile[];
  close: () => void;
  create: (profile: SourceProfile) => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [type, setType] = useState<SourceType>("gopro");
  const suggestedKey = useMemo(
    () => nextStreamKey(type, profiles),
    [type, profiles]
  );

  const [draft, setDraft] = useState<SourceDraft>({
    name: "Новый источник",
    streamKey: suggestedKey,
    type: "gopro",
    notes: ""
  });

  const selectType = (nextType: SourceType) => {
    setType(nextType);
    setDraft({
      name:
        nextType === "gopro"
          ? "Новая GoPro"
          : nextType === "phone"
            ? "Новый телефон"
            : nextType === "dji"
              ? "Новая DJI"
              : "Новый RTMP-источник",
      streamKey: nextStreamKey(nextType, profiles),
      type: nextType,
      notes: ""
    });
    setStep(2);
  };

  const streamKeyExists = profiles.some(
    profile => profile.streamKey === draft.streamKey
  );

  const submit = () => {
    if (
      !draft.name.trim() ||
      !draft.streamKey.trim() ||
      streamKeyExists
    ) {
      return;
    }
    create(createProfileFromDraft(draft));
  };

  return (
    <div className="modal-backdrop" onClick={close}>
      <div
        className="source-wizard"
        onClick={event => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2>Добавить источник</h2>
            <p>Шаг {step} из 2</p>
          </div>
          <button className="secondary" onClick={close}>
            Закрыть
          </button>
        </div>

        {step === 1 ? (
          <div className="source-type-grid">
            {choices.map(choice => (
              <button
                key={choice.type}
                className="source-type-choice"
                onClick={() => selectType(choice.type)}
              >
                <strong>{choice.title}</strong>
                <span>{choice.description}</span>
              </button>
            ))}
          </div>
        ) : (
          <>
            <div className="wizard-back-line">
              <button
                className="secondary compact"
                onClick={() => setStep(1)}
              >
                ← Назад
              </button>
              <strong>
                {choices.find(choice => choice.type === type)?.title}
              </strong>
            </div>

            <label>
              Название
              <input
                autoFocus
                value={draft.name}
                maxLength={60}
                onChange={event =>
                  setDraft(current => ({
                    ...current,
                    name: event.target.value
                  }))
                }
              />
            </label>

            <label>
              RTMP-ключ
              <input
                value={draft.streamKey}
                onChange={event =>
                  setDraft(current => ({
                    ...current,
                    streamKey: sanitizeStreamKey(
                      event.target.value
                    )
                  }))
                }
              />
            </label>

            {streamKeyExists && (
              <p className="field-error">
                Такой RTMP-ключ уже используется.
              </p>
            )}

            <label>
              Примечание
              <input
                value={draft.notes}
                placeholder="Например: общий план у сцены"
                onChange={event =>
                  setDraft(current => ({
                    ...current,
                    notes: event.target.value
                  }))
                }
              />
            </label>

            <div className="wizard-preview">
              <span>Адрес будет выглядеть так</span>
              <code>
                rtmp://IP/live/{draft.streamKey || "stream-key"}
              </code>
            </div>

            <div className="rename-actions">
              <button className="secondary" onClick={close}>
                Отмена
              </button>
              <button
                disabled={
                  !draft.name.trim() ||
                  !draft.streamKey.trim() ||
                  streamKeyExists
                }
                onClick={submit}
              >
                Создать источник
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
