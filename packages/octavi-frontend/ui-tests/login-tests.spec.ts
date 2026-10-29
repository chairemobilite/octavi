/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { test } from '@playwright/test';
import * as testHelpers from './testHelpers';
import * as loginTestHelpers from './loginTestHelpers';

const context = testHelpers.createTestContext();

// Configure the tests to run in serial mode (one after the other)
test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ browser }) => {
    context.page = await testHelpers.initializeTestPage(browser);
});

test.afterAll(async () => {
    await testHelpers.closeTestPage(context);
});

// Login using all methods enabled in the transition login page
// We switch to english only on the first login, since the language is kept after that
loginTestHelpers.startAndLogin({
    context,
    title: 'Octavi',
    loginMethod: 'clickLoginButton',
    changeToEnglish: true
});
testHelpers.logoutTest({ context });
loginTestHelpers.startAndLogin({
    context,
    title: 'Octavi',
    loginMethod: 'enterOnPasswordField',
    changeToEnglish: false
});
testHelpers.logoutTest({ context });
loginTestHelpers.startAndLogin({
    context,
    title: 'Octavi',
    loginMethod: 'enterOnUsernameField',
    changeToEnglish: false
});
testHelpers.logoutTest({ context });
