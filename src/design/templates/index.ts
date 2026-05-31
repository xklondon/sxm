import type { DesignTemplate } from './types';
import { PREMIUM_CASINO_TEMPLATE } from './premiumCasino';
import { STITCH_MOBILE_TEMPLATE } from './stitchMobile';
import { CLASSIC_FELT_TEMPLATE } from './classicFelt';

export type { DesignTemplate, DesignDensity, DesignTemplateId } from './types';
export {
  PREMIUM_CASINO_TEMPLATE,
  STITCH_MOBILE_TEMPLATE,
  CLASSIC_FELT_TEMPLATE,
};

export const DESIGN_TEMPLATE_PRESETS: readonly DesignTemplate[] = [
  PREMIUM_CASINO_TEMPLATE,
  STITCH_MOBILE_TEMPLATE,
  CLASSIC_FELT_TEMPLATE,
] as const;

export const DEFAULT_DESIGN_TEMPLATE_ID = PREMIUM_CASINO_TEMPLATE.templateId;

const TEMPLATE_BY_ID = new Map<string, DesignTemplate>(
  DESIGN_TEMPLATE_PRESETS.map((t) => [t.templateId, t]),
);

export function getDesignTemplateById(templateId: string): DesignTemplate | undefined {
  return TEMPLATE_BY_ID.get(templateId);
}

export function getDesignTemplateOrDefault(templateId?: string | null): DesignTemplate {
  if (templateId) {
    const found = TEMPLATE_BY_ID.get(templateId);
    if (found) {
      return found;
    }
  }
  return PREMIUM_CASINO_TEMPLATE;
}

export function listDesignTemplates(): DesignTemplate[] {
  return [...DESIGN_TEMPLATE_PRESETS];
}

const THEME_CLASS_PREFIX = 'theme-';

export function themeClassForTemplate(templateId: string): string {
  return `${THEME_CLASS_PREFIX}${templateId}`;
}

export function applyDesignTemplateToDocument(templateId: string): void {
  if (typeof document === 'undefined') {
    return;
  }
  const root = document.documentElement;
  for (const t of DESIGN_TEMPLATE_PRESETS) {
    root.classList.remove(themeClassForTemplate(t.templateId));
  }
  root.classList.add(themeClassForTemplate(templateId));
  const template = getDesignTemplateOrDefault(templateId);
  for (const [key, value] of Object.entries(template.colorTokens)) {
    root.style.setProperty(key, value);
  }
  for (const [key, value] of Object.entries(template.typographyTokens)) {
    root.style.setProperty(key, value);
  }
  root.dataset.designDensity = template.density;
  root.dataset.cardStyle = template.cardStyle;
  root.dataset.chipStyle = template.chipStyle;
}
