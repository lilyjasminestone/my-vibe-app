import type { Locale } from '@/i18n'

export interface TranslationKeys {
  common: {
    loading: string;
    error: string;
    success: string;
    cancel: string;
    confirm: string;
    close: string;
    save: string;
    delete: string;
    edit: string;
    add: string;
    remove: string;
    clear: string;
    run: string;
    runAll: string;
    retry: string;
  };
  header: {
    title: string;
  };
  editPanel: {
    title: string;
    templateSection: string;
    documentSection: string;
    documentPromptSection: string;
    loadTemplate: string;
    analyzeDocument: string;
    templatePlaceholder: string;
    documentPromptPlaceholder: string;
    analyzing: string;
    contentChangedTooltip: string;
    emptyContentTooltip: string;
    noChangesTooltip: string;
    templateError: string;
    noTemplates: string;
  };
  outputPanel: {
    title: string;
    documentInfo: string;
    addComparison: string;
    comparisonLimit: string;
    comparisonCount: string;
    documentInfoTooltip: string;
    addComparisonTooltip: string;
    addComparisonLimitTooltip: string;
    runAllTooltip: string;
    contentModifiedTooltip: string;
    emptyDescription: string;
  };
  variableColumn: {
    comparison: string;
    variables: string;
    variableHint: string;
    noVariables: string;
    runTooltip: string;
    contentModifiedRunTooltip: string;
    running: string;
    generating: string;
    completed: string;
    error: string;
    retry: string;
  };
  documentDialog: {
    title: string;
    description: string;
    totalBlocks: string;
    variableCount: string;
    interactionBlocks: string;
    contentBlocks: string;
    detectedVariables: string;
    interactionBlockIndex: string;
    contentBlockIndex: string;
  };
  confirmDialog: {
    switchExample: string;
    unsavedChanges: string;
    cancel: string;
    confirmSwitch: string;
  };
  toast: {
    enterContent: string;
    analysisSuccess: string;
    analysisFailed: string;
    templateLoadFailed: string;
  };
  chatDialog: {
    title: string;
    welcomeMessage: string;
    errorMessage: string;
    confirmButton: string;
    rejectButton: string;
    confirmedStatus: string;
    rejectedStatus: string;
    inputPlaceholder: string;
    sendHint: string;
    copyTooltipCopied: string;
    copyTooltipCopy: string;
    copyAriaLabelCopied: string;
    copyAriaLabelCopy: string;
    applyToPlayground: string;
    confirmApplyTitle: string;
    confirmApplyDescription: string;
    confirmApplyButton: string;
    cancelButton: string;
    summaryLabel: string;
  };
}

// Declare the global type for next-intl
declare global {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface IntlMessages extends TranslationKeys {}
}

export type { Locale }
