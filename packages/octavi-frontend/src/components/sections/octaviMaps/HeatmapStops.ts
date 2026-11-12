/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
// FIXME Consider making this configurable and pass it to the buildHeatmapStops function directly, defaulting to this
export const COLOR_STOPS = ['#edf8fb', '#b2e2e2', '#66c2a4', '#2ca25f', '#006d2c'];

/**
 * Build the category boundaries for the heat buildHeatmapStops
 *
 * FIXME This was copied from the original javascript code. Revisit when the
 * data API stabilizes and the desired features are better specced.
 *
 * @param values The values that will be displayed
 * @param scaleType The scale to use, equal interval or equal count
 * @returns
 */
export const buildHeatmapStops = (
    values: number[],
    scaleType: 'distributionBased' | 'intervalBased'
): { value: number; color: string; label: string }[] => {
    if (values.length === 0) {
        return [];
    }

    const sortedValues = [...values].sort((a, b) => a - b);
    const minValue = sortedValues[0];
    const maxValue = sortedValues[sortedValues.length - 1];
    const upperBound = minValue === maxValue ? minValue + 1 : maxValue;
    const bucketSize = (upperBound - minValue) / COLOR_STOPS.length;

    const rawBreakpoints: number[] = [];
    for (let index = 0; index <= COLOR_STOPS.length; index++) {
        if (scaleType === 'distributionBased' && minValue !== maxValue) {
            const quantileIndex = Math.floor((index / COLOR_STOPS.length) * (sortedValues.length - 1));
            rawBreakpoints.push(sortedValues[quantileIndex]);
        } else {
            rawBreakpoints.push(minValue + ((upperBound - minValue) * index) / COLOR_STOPS.length);
        }
    }

    let breakpoints: number[] = [minValue];
    let useIntervalFallback = false;
    for (let index = 1; index <= COLOR_STOPS.length; index++) {
        const previous = breakpoints[breakpoints.length - 1];
        const next = rawBreakpoints[index] > previous ? rawBreakpoints[index] : previous + bucketSize;
        if (scaleType === 'distributionBased' && minValue !== maxValue && next > maxValue) {
            useIntervalFallback = true;
            break;
        }
        breakpoints.push(next);
    }

    if (useIntervalFallback) {
        breakpoints = Array.from(
            { length: COLOR_STOPS.length + 1 },
            (_, index) => minValue + ((maxValue - minValue) * index) / COLOR_STOPS.length
        );
    }

    return COLOR_STOPS.map((color, index) => ({
        value: breakpoints[index],
        color,
        label: `${breakpoints[index].toFixed(1)} - ${breakpoints[index + 1].toFixed(1)}`
    }));
};
