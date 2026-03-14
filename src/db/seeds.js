import {
  ensureDefaultHomeContentRow,
  ensureDefaultThemeSettingsRow,
} from "../services/theme.service.js";
import { seedDefaultMainSecondaryMenu } from "../services/nav.service.js";

export async function runSeeds() {
  await ensureDefaultThemeSettingsRow();
  await ensureDefaultHomeContentRow();
  await seedDefaultMainSecondaryMenu();
}
