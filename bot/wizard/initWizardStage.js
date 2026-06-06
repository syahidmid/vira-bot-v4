function initWizardStage(bot) {
    const { Scene, Stage } = WizardDua;  // ← tambah ini

    const wizardTest = createWizardtest(Scene);
    const viewSpendingWizard = createViewSpendingWizard(Scene);
    const saveSpendingWizard = createSaveSpendingWizard(Scene);
    const addDefaultCategoryWizard = createAddDefaultCategoryWizard(Scene);
    const inputIncomeWizard = createSaveIncomeWizard(Scene);
    const editTransactionWizard = createEditTransactionWizard(Scene);
    const findTransactionWizard = createFindTransactionWizard(Scene);

    stage = new Stage([
        wizardTest,
        viewSpendingWizard,
        saveSpendingWizard,
        addDefaultCategoryWizard,
        inputIncomeWizard,
        editTransactionWizard,
        findTransactionWizard
    ]);

    bot.use(stage.middleware());
}