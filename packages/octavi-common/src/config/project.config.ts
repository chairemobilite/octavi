/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import projectConfig, {
    ProjectConfiguration,
    setProjectConfiguration
} from 'chaire-lib-common/lib/config/shared/project.config';

const defaultSectionsConfig = {
    octaviHighlights: {
        localizedTitle: 'octavi:Highlights',
        iconWhite: '/dist/images/icons/interface/highlighter_white.svg',
        iconBlack: '/dist/images/icons/interface/highlighter_black.svg',
        showFullSizePanel: true,
        hasMapLayers: false
    },
    octaviMap: {
        localizedTitle: 'octavi:Map',
        iconWhite: '/dist/images/icons/interface/accessibility_map_white.svg',
        iconBlack: '/dist/images/icons/interface/accessibility_map_black.svg',
        showFullSizePanel: false,
        hasMapLayers: true
    }
};

// Make sure default values are set
setProjectConfiguration<ProjectConfiguration<unknown>>({
    sections: Object.assign({}, defaultSectionsConfig, projectConfig.sections)
});

export default projectConfig as ProjectConfiguration<unknown>;
