import type { AppSettings } from "../../../lib/storage/settings";
import type { FeatureSettings } from "../../../lib/storage/settings";
import type { AppearanceSettings } from "../../../lib/utils/theme";

export function updateSettings(
  settings: AppSettings,
  onChange: (settings: AppSettings) => void,
  nextSettings: Partial<AppSettings>,
) {
  onChange({ ...settings, ...nextSettings });
}

export function updateAppearance(
  settings: AppSettings,
  onChange: (settings: AppSettings) => void,
  nextAppearance: Partial<AppearanceSettings>,
) {
  updateSettings(settings, onChange, {
    appearance: { ...settings.appearance, ...nextAppearance },
  });
}

export function updateFeatures(
  settings: AppSettings,
  onChange: (settings: AppSettings) => void,
  nextFeatures: Partial<FeatureSettings>,
) {
  updateSettings(settings, onChange, {
    features: { ...settings.features, ...nextFeatures },
  });
}
