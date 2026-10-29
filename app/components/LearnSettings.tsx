import { Button, Input, Select, Space, Switch } from "@siemsiem/beerreact";
import type Learnlib from "@siemsiem/learnlib";
import {
  type GuiConfigSection,
  globalModuleTracker,
  type multiLangString,
  type SchemaField,
} from "@siemsiem/learnlib";
import { useState } from "react";
import { useTranslation } from "react-i18next";

function loc(val: string | multiLangString | undefined, lang: string): string {
  if (!val) return "";
  if (typeof val === "string") return val;
  return (
    (lang.startsWith("nl") ? (val.NL ?? val.EN) : (val.EN ?? val.NL)) ?? ""
  );
}

export function LearnSettings({
  lib,
  onChange,
}: {
  lib?: Learnlib | null;
  onChange?: (configJson: string) => void;
}) {
  const { i18n } = useTranslation();
  const lang = i18n.language || "nl";
  const [sections, setSections] = useState<GuiConfigSection[]>(() =>
    globalModuleTracker.getGuiConfigList(),
  );

  const updateField = (
    section: GuiConfigSection,
    key: string,
    value: unknown,
  ) => {
    if (lib) {
      lib.setConfig(section.id, { [key]: value }, section.type);
    } else {
      globalModuleTracker.setConfig(section.id, { [key]: value }, section.type);
    }
    setSections(globalModuleTracker.getGuiConfigList());
    onChange?.(globalModuleTracker.exportConfigJson());
  };

  const resetDefaults = () => {
    globalModuleTracker.reset();
    if (lib) {
      for (const sec of globalModuleTracker.getGuiConfigList()) {
        lib.setConfig(sec.id, sec.config, sec.type);
      }
    }
    setSections(globalModuleTracker.getGuiConfigList());
    onChange?.(globalModuleTracker.exportConfigJson());
  };

  const configurable = sections.filter(
    (s) =>
      Object.keys(s.schema).length > 0 &&
      (s.type !== "method" || !lib || s.id === lib.method.id),
  );

  return (
    <nav className="vertical left-align">
      <div>

        {/* <article className="max"> */}
        <nav className="no-space max">
          <h3 className="max">
            {lang.startsWith("nl") ? "Leerinstellingen" : "Learn Settings"}
          </h3>
          <Button
            variant="transparent"
            icon="restart_alt"
            onClick={resetDefaults}
          >
            Reset
          </Button>
        </nav>
        <Space></Space>
        {configurable.map((sec) => (
          <>
            <hr />
            <Space size="small-space" />
            {Object.entries(sec.schema).map(([key, rawField]) => {
              const field = rawField as SchemaField;
              const val = sec.config[key] ?? field.default;
              const label = loc(field.label, lang) || key;
              const desc = loc(field.description, lang);

              if (field.type === "boolean") {
                return (
                  <div key={key} className="small-padding">
                    <nav className="no-space">
                      <div className="max">
                        <div>{label}</div>
                        {desc && (
                          <div className="secondary-text small-text">{desc}</div>
                        )}
                      </div>
                      <Switch
                        checked={Boolean(val)}
                        onChange={(e) =>
                          updateField(sec, key, e.currentTarget.checked)
                        }
                        icon=""
                      />
                    </nav>
                  </div>
                );
              }

              if (field.type === "select") {
                return (
                  <div key={key} className="small-padding">
                    <Select
                      label={label}
                      value={String(val)}
                      onChange={(e) =>
                        updateField(sec, key, e.currentTarget.value)
                      }
                    >
                      {field.options.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </Select>
                    {desc && (
                      <div className="secondary-text small-text">{desc}</div>
                    )}
                  </div>
                );
              }

              if (field.type === "number") {
                return (
                  <div key={key} className="small-padding">
                    <Input
                      type="number"
                      label={label}
                      min={field.min}
                      max={field.max}
                      step={field.step}
                      value={String(val)}
                      onChange={(e) =>
                        updateField(sec, key, Number(e.currentTarget.value))
                      }
                    />
                    {desc && (
                      <div className="secondary-text small-text">{desc}</div>
                    )}
                  </div>
                );
              }

              return (
                <div key={key} className="small-padding">
                  <Input
                    type="text"
                    label={label}
                    value={String(val ?? "")}
                    onChange={(e) => updateField(sec, key, e.currentTarget.value)}
                  />
                  {desc && (
                    <div className="secondary-text small-text">{desc}</div>
                  )}
                </div>
              );
            })}
          </>
        ))}
        {/* </article> */}
      </div>

    </nav>
  );
}
