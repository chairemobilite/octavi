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

loginTestHelpers.startAndLogin({ context, title: 'Octavi' });

// Click on a few sections of the left menu to check that the panel switching
// works properly.
//
// FIXME: There is no title in the right pane for now, so the first small section of each panel is the title. Update as section forms are improved
testHelpers.clickLeftMenuTest({ context, section: 'octaviMap', expectedRightPanelTitle: 'Validity period' });
testHelpers.clickLeftMenuTest({ context, section: 'octaviHighlights', expectedRightPanelTitle: 'Compare two periods' });

testHelpers.logoutTest({ context });
