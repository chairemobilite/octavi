/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';

import {
    DashboardContribution,
    Contribution,
    PanelSectionProps
} from 'chaire-lib-frontend/lib/services/dashboard/DashboardContribution';
//import BottomPanel from './OctaviBottomPanel';
import MenuBar from 'transition-frontend/lib/components/dashboard/TransitionMenuBar';
//import Toolbar from './OctaviToolbar';
//import FullSizePanel from './OctaviFullSizePanel';
import FullSizePanel from 'octavi-legacy/lib/components/dashboard/OctaviFullSizePanel';
import RightPanel from 'octavi-legacy/lib/components/dashboard/OctaviRightPanel';

/**
 * Dashboard contribution for the 'supply management' module of Transition: this
 * includes the agencies edition, GTFS import/export, routing and accessibility
 * map
 */
export class OctaviDashboardContribution extends DashboardContribution {
    getLayoutContributions = (): Contribution<PanelSectionProps>[] => [
        {
            id: 'transitionMenu',
            placement: 'menu' as const,
            create: (props: PanelSectionProps) => <MenuBar {...props}></MenuBar>
        },
        /* {
            id: 'transitionToolbar',
            placement: 'toolbar' as const,
            create: (props: PanelSectionProps) => <Toolbar {...props}></Toolbar>
        },*/
        {
            id: 'transitionFSPanel',
            placement: 'mapOverlay' as const,
            create: (props: PanelSectionProps) => <FullSizePanel {...props}></FullSizePanel>
        },
        {
            id: 'transitionRightPanel',
            placement: 'primarySidebar' as const,
            create: (props: PanelSectionProps) => <RightPanel {...props}></RightPanel>
        }
    ];
}
