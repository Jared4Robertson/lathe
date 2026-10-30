import { refuseBroken, type RuleProblem } from '../../shell/prefs';
import { PANEL_LIMITS, type PanelName, type Panels } from './model';

/** What breaks the panels' rule (panel-width-within-limits, LA-PLT-INV30): a width outside its panel's limits. */
export function panelProblems(panels: Panels): RuleProblem[] {
  return (Object.keys(panels) as PanelName[]).flatMap((name) => {
    const { min, max } = PANEL_LIMITS[name];
    const { width } = panels[name];
    return Number.isInteger(width) && width >= min && width <= max ? [] : [{ rule: 'panel-width-within-limits', message: `The ${name} panel's width ${width} is outside ${min}–${max} px.` }];
  });
}

/** Refuses panels that break a rule, with every reason. */
export const holdToRules = (panels: Panels) => refuseBroken(panelProblems(panels));
