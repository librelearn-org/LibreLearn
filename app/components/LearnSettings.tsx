import { Button, Input, Select, Space, Switch } from "@siemsiem/beerreact";
import type Learnlib from "@siemsiem/learnlib";
import {
  type GuiConfigSection,
  globalModuleTracker,
  type multiLangString,
  type SchemaField,
} from "@siemsiem/learnlib";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

function loc(val: string | multiLangString | undefined, lang: string): string {
  if (!val) return "";
  if (typeof val === "string") return val;
  return (
    (lang.startsWith("nl") ? (val.NL ?? val.EN) : (val.EN ?? val.NL)) ?? ""
  );
}

export interface SelectedLearnModules {
  methodId: string;
  graderId: string;
  queueUpdaterId: string;
}

export function LearnSettings({
  lib,
  onChange,
  isActive,
  selectedModules,
  onModulesChange,
}: {
  lib?: Learnlib | null;
  onChange?: (configJson: string) => void;
  isActive?: boolean;
  selectedModules?: SelectedLearnModules;
  onModulesChange?: (modules: SelectedLearnModules) => void;
}) {
  const { i18n } = useTranslation();
  const lang = i18n.language || "nl";
  const [sections, setSections] = useState<GuiConfigSection[]>(() =>
    globalModuleTracker.getGuiConfigList(),
  );

  const availableMethods = useMemo(() => globalModuleTracker.getMethods(), []);
  const availableGraders = useMemo(
    () => globalModuleTracker.getGradeMakers(),
    [],
  );
  const availableQueueUpdaters = useMemo(
    () => globalModuleTracker.getQueueUpdaters(),
    [],
  );

  const [localModules, setLocalModules] = useState<SelectedLearnModules>(
    () => ({
      methodId:
        selectedModules?.methodId ??
        lib?.method.id ??
        availableMethods[0]?.id ??
        "simple",
      graderId:
        selectedModules?.graderId ??
        lib?.grader.id ??
        availableGraders[0]?.id ??
        "basic",
      queueUpdaterId:
        selectedModules?.queueUpdaterId ??
        lib?.queueUpdater.id ??
        availableQueueUpdaters[0]?.id ??
        "simple",
    }),
  );

  const currentModules = selectedModules ?? localModules;

  const updateModuleSelection = (
    key: keyof SelectedLearnModules,
    value: string,
  ) => {
    if (isActive && key === "methodId") return;
    const next = { ...currentModules, [key]: value };
    setLocalModules(next);
    if (lib) {
      if (key === "methodId") {
        const mod = globalModuleTracker.getMethod(value);
        if (mod) lib.method = mod;
      } else if (key === "graderId") {
        const mod = globalModuleTracker.getGradeMaker(value);
        if (mod) lib.grader = mod;
      } else if (key === "queueUpdaterId") {
        const mod = globalModuleTracker.getQueueUpdater(value);
        if (mod) lib.queueUpdater = mod;
      }
    }
    onModulesChange?.(next);
    onChange?.(globalModuleTracker.exportConfigJson());
  };

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
  const reset = () => {
    if (lib) {
      lib.reset();
    }
  };

  const configurable = sections.filter(
    (s) =>
      Object.keys(s.schema).length > 0 &&
      (s.type === "preprocessor" ||
        s.type === "checker" ||
        (s.type === "method" && currentModules.methodId === s.id) ||
        (s.type === "gradeMaker" && currentModules.graderId === s.id) ||
        (s.type === "queueUpdater" && currentModules.queueUpdaterId === s.id)),
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
          {isActive && <Button onClick={reset}>Herstart leren</Button>}
        </nav>
        <Space></Space>
        <div className="small-padding">
          <Select
            label={lang.startsWith("nl") ? "Leermethode" : "Learning Method"}
            value={currentModules.methodId}
            disabled={isActive}
            onChange={(e) =>
              updateModuleSelection("methodId", e.currentTarget.value)
            }
          >
            {availableMethods.map((m) => (
              <option key={m.id} value={m.id}>
                {loc(m.name, lang) || m.id}
              </option>
            ))}
          </Select>
          <Space size="small-space" />
          <Select
            label={lang.startsWith("nl") ? "Beoordelaar (Grader)" : "Grader"}
            value={currentModules.graderId}
            onChange={(e) =>
              updateModuleSelection("graderId", e.currentTarget.value)
            }
          >
            {availableGraders.map((g) => (
              <option key={g.id} value={g.id}>
                {loc(g.name, lang) || g.id}
              </option>
            ))}
          </Select>
          <Space size="small-space" />
          <Select
            label={lang.startsWith("nl") ? "Wachtrij-updater" : "Queue Updater"}
            value={currentModules.queueUpdaterId}
            onChange={(e) =>
              updateModuleSelection("queueUpdaterId", e.currentTarget.value)
            }
          >
            {availableQueueUpdaters.map((q) => (
              <option key={q.id} value={q.id}>
                {loc(q.name, lang) || q.id}
              </option>
            ))}
          </Select>
        </div>
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
                          <div className="secondary-text small-text">
                            {desc}
                          </div>
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
                    onChange={(e) =>
                      updateField(sec, key, e.currentTarget.value)
                    }
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
