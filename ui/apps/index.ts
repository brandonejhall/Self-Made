// SM-023: Registry of phone apps shown on the home screen, in tile order.
// Adding an app = one new module in ui/apps/ plus one line here.

import { bankApp } from "./bank";
import { businessApp } from "./business";
import { housingApp } from "./housing";
import { jobsApp } from "./jobs";
import { propertyApp } from "./property";
import type { PhoneApp } from "./types";

export const PHONE_APPS: readonly PhoneApp[] = [jobsApp, bankApp, housingApp, businessApp, propertyApp];

export type { AppContext, PhoneApp, SimAction, UiMeta, LoanMeta } from "./types";
