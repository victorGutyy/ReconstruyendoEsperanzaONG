"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

import {
  CHANNEL_LABELS,
  CHANNELS,
  type Channel,
  MINOR_OPINION_LABELS,
  MINOR_OPINIONS,
  type MinorOpinion,
  SIGNER_LABELS,
  SIGNER_TYPES,
  type SignerType,
  todayInBogota,
} from "../schema";

export type ConsentFieldValues = {
  subjectName: string;
  isMinor: boolean;
  minorOpinion: MinorOpinion | null;
  signerType: SignerType;
  signerName: string | null;
  scopeDescription: string;
  grantedOn: string;
  validUntil: string | null;
  channel: Channel;
  formVersion: string;
};

const textareaClass =
  "min-h-20 w-full rounded-md border-[1.5px] border-input bg-card px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/**
 * Fields of an authorization. For a minor, the legal guardian signs and the
 * child's opinion is recorded (docs/09 §4.1); those fields appear only then.
 */
export function ConsentFields({ values }: { values?: ConsentFieldValues }) {
  const [isMinor, setIsMinor] = useState(values?.isMinor ?? false);
  const [signerType, setSignerType] = useState<SignerType>(values?.signerType ?? "self");
  const effectiveSigner = isMinor ? "legal_guardian" : signerType;

  return (
    <div className="grid gap-5">
      <div className="space-y-2">
        <Label htmlFor="consent-subject">Persona que aparece en las fotos</Label>
        <Input
          id="consent-subject"
          name="subjectName"
          defaultValue={values?.subjectName}
          autoComplete="off"
          required
          maxLength={120}
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          id="consent-minor"
          name="isMinor"
          type="checkbox"
          checked={isMinor}
          onChange={(event) => setIsMinor(event.target.checked)}
          className="size-5 accent-green-700"
        />
        <Label htmlFor="consent-minor">Es menor de edad</Label>
      </div>

      {isMinor ? (
        <fieldset className="space-y-2" aria-describedby="consent-opinion-help">
          <legend className="text-sm font-medium">Opinión del menor</legend>
          <p id="consent-opinion-help" className="text-sm text-ink-muted">
            Si no quiere aparecer, no se publica aunque su representante firme.
          </p>
          <div className="grid gap-1">
            {MINOR_OPINIONS.map((opinion) => (
              <label key={opinion} className="flex min-h-11 items-center gap-2">
                <input
                  type="radio"
                  name="minorOpinion"
                  value={opinion}
                  defaultChecked={values?.minorOpinion === opinion}
                  className="size-5 accent-green-700"
                />
                {MINOR_OPINION_LABELS[opinion]}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="consent-signer">Quién firmó</Label>
          {isMinor ? (
            <>
              <input type="hidden" name="signerType" value="legal_guardian" />
              <p id="consent-signer" className="flex min-h-12 items-center text-base">
                {SIGNER_LABELS.legal_guardian}
              </p>
            </>
          ) : (
            <NativeSelect
              id="consent-signer"
              name="signerType"
              value={signerType}
              onChange={(event) => setSignerType(event.target.value as SignerType)}
            >
              {SIGNER_TYPES.map((type) => (
                <option key={type} value={type}>
                  {SIGNER_LABELS[type]}
                </option>
              ))}
            </NativeSelect>
          )}
        </div>
        {effectiveSigner === "legal_guardian" ? (
          <div className="space-y-2">
            <Label htmlFor="consent-signer-name">Nombre del representante legal</Label>
            <Input
              id="consent-signer-name"
              name="signerName"
              defaultValue={values?.signerName ?? ""}
              autoComplete="off"
              required
              maxLength={120}
            />
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="consent-scope">Qué cubre</Label>
        <p id="consent-scope-help" className="text-sm text-ink-muted">
          Por ejemplo: «Fotos y videos de la jornada del 12/03/2026 en el sitio web».
        </p>
        <textarea
          id="consent-scope"
          name="scopeDescription"
          defaultValue={values?.scopeDescription}
          aria-describedby="consent-scope-help"
          required
          maxLength={500}
          className={textareaClass}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="consent-granted">Fecha de firma</Label>
          <Input
            id="consent-granted"
            name="grantedOn"
            type="date"
            max={todayInBogota()}
            defaultValue={values?.grantedOn}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="consent-valid-until">Válida hasta (opcional)</Label>
          <Input
            id="consent-valid-until"
            name="validUntil"
            type="date"
            defaultValue={values?.validUntil ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="consent-channel">Se firmó en</Label>
          <NativeSelect
            id="consent-channel"
            name="channel"
            defaultValue={values?.channel ?? "paper"}
          >
            {CHANNELS.map((channel) => (
              <option key={channel} value={channel}>
                {CHANNEL_LABELS[channel]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="consent-version">Versión del formato</Label>
          <Input
            id="consent-version"
            name="formVersion"
            defaultValue={values?.formVersion}
            placeholder="p. ej. v1"
            autoComplete="off"
            required
            maxLength={40}
          />
        </div>
      </div>
    </div>
  );
}
