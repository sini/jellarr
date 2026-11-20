import type { BrandingOptionsConfig } from "../types/config/branding-options";
import { withoutUndefined } from "../lib/objects";
import type { BrandingOptionsDtoSchema } from "../types/schema/branding-options";

export function mapBrandingOptionsConfigToSchema(
  desired: BrandingOptionsConfig,
): Partial<BrandingOptionsDtoSchema> {
  return withoutUndefined({
    LoginDisclaimer: desired.loginDisclaimer,
    CustomCss: desired.customCss,
    SplashscreenEnabled: desired.splashscreenEnabled,
  });
}
