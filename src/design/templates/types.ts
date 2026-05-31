export type DesignTemplateId = 'premium-casino' | 'stitch-mobile' | 'classic-felt';

export type DesignDensity = 'compact' | 'normal' | 'cinematic';

export interface DesignTemplate {
  templateId: DesignTemplateId;
  displayName: string;
  description: string;
  colorTokens: Record<string, string>;
  typographyTokens: Record<string, string>;
  tableLayoutPreference: 'full' | 'card' | 'auto';
  cardStyle: 'premium' | 'flat' | 'classic';
  chipStyle: 'gold-rim' | 'flat' | 'felt';
  buttonStyle: 'gold' | 'pill' | 'outline';
  density: DesignDensity;
}
