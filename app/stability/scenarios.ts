// Shared addresses and key elements for the stability scenarios.

export const PRODUCT = '/specs/LA';
export const DOMAIN = '/specs/LA/LA-BRW';
/** A use case with requirements, links and a long body. */
export const RECORD = '/records/LA-BRW-UC91';
/** An aggregate: its page offers the Model view. */
export const AGGREGATE = '/records/LA-BRW-A4';

/** The shell's frame: the nav and the page beside it. */
export const SHELL = ['nav#nav', '#main'];
/** A focus page's frame: the first pane's bar, its title and the inspector. */
export const FOCUS = ['.focus-views > .pane:first-of-type > .pane-bar', '.focus-views > .pane:first-of-type .pane-title', '.inspector-column'];
export const WIKI_TITLE = '.pane-wiki .pane-title h1';
export const GRAPH_CANVAS = '.pane-graph .graph-canvas';
export const GRAPH_HEADER = '.pane-graph .graph-header';
export const MODEL_CANVAS = '.pane-model .model-canvas';
