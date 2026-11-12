/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { buildHeatmapStops, COLOR_STOPS } from '../HeatmapStops';

const expectStopValues = (stops: ReturnType<typeof buildHeatmapStops>, values: number[]) => {
    expect(stops).toHaveLength(COLOR_STOPS.length);
    stops.forEach((stop, index) => {
        expect(stop.value).toBeCloseTo(values[index], 8);
        expect(stop.color).toBe(COLOR_STOPS[index]);
    });
};

describe('buildHeatmapStops', () => {
    it('returns an empty list when there are no values', () => {
        expect(buildHeatmapStops([], 'intervalBased')).toEqual([]);
    });

    it('returns five evenly spaced interval stops for unsorted values', () => {
        const stops = buildHeatmapStops([10, 0, 5], 'intervalBased');

        expectStopValues(stops, [0, 2, 4, 6, 8]);
        expect(stops.map(({ label }) => label)).toEqual([
            '0.0 - 2.0',
            '2.0 - 4.0',
            '4.0 - 6.0',
            '6.0 - 8.0',
            '8.0 - 10.0'
        ]);
    });

    it('returns five quantile-based stops when there are fewer values than color intervals', () => {
        const stops = buildHeatmapStops([1, 2, 3], 'distributionBased');

        expectStopValues(stops, [1, 1.4, 1.8, 2, 2.4]);
        expect(stops.map(({ label }) => label)).toEqual([
            '1.0 - 1.4',
            '1.4 - 1.8',
            '1.8 - 2.0',
            '2.0 - 2.4',
            '2.4 - 3.0'
        ]);
        for (let index = 1; index < stops.length; index++) {
            expect(stops[index].value).toBeGreaterThan(stops[index - 1].value);
        }
    });

    it('uses evenly spaced boundaries within the data range when tied quantiles exceed the maximum', () => {
        const values = [1, 10, 10, 10, 10, 10];
        const stops = buildHeatmapStops(values, 'distributionBased');

        expectStopValues(stops, [1, 2.8, 4.6, 6.4, 8.2]);
        expect(stops.map(({ label }) => label)).toEqual([
            '1.0 - 2.8',
            '2.8 - 4.6',
            '4.6 - 6.4',
            '6.4 - 8.2',
            '8.2 - 10.0'
        ]);
        const legendBoundaries = [
            ...stops.map(({ value }) => value),
            Number(stops[stops.length - 1].label.split(' - ')[1])
        ];
        expect(legendBoundaries.every((boundary) => boundary >= 1 && boundary <= 10)).toBe(true);
    });

    it('returns five distinct stops when all values are equal', () => {
        const stops = buildHeatmapStops([5, 5, 5], 'intervalBased');

        expectStopValues(stops, [5, 5.2, 5.4, 5.6, 5.8]);
        expect(stops.map(({ label }) => label)).toEqual([
            '5.0 - 5.2',
            '5.2 - 5.4',
            '5.4 - 5.6',
            '5.6 - 5.8',
            '5.8 - 6.0'
        ]);
        for (let index = 1; index < stops.length; index++) {
            expect(stops[index].value).toBeGreaterThan(stops[index - 1].value);
        }
    });

    it('returns five distinct stops for a single value', () => {
        const stops = buildHeatmapStops([7], 'intervalBased');

        expectStopValues(stops, [7, 7.2, 7.4, 7.6, 7.8]);
        expect(stops.map(({ label }) => label)).toEqual([
            '7.0 - 7.2',
            '7.2 - 7.4',
            '7.4 - 7.6',
            '7.6 - 7.8',
            '7.8 - 8.0'
        ]);
        for (let index = 1; index < stops.length; index++) {
            expect(stops[index].value).toBeGreaterThan(stops[index - 1].value);
        }
    });

    it('produces the expected interval stops for a large dataset', () => {
        const values = Array.from({ length: 10_000 }, (_, index) => index + 1);
        const stops = buildHeatmapStops(values, 'intervalBased');

        expectStopValues(stops, [1, 2000.8, 4000.6, 6000.4, 8000.2]);
        expect(stops.map(({ label }) => label)).toEqual([
            '1.0 - 2000.8',
            '2000.8 - 4000.6',
            '4000.6 - 6000.4',
            '6000.4 - 8000.2',
            '8000.2 - 10000.0'
        ]);
    });

    it('produces the expected distribution stops for a large dataset', () => {
        const values = Array.from({ length: 10_000 }, (_, index) => index + 1);
        const stops = buildHeatmapStops(values, 'distributionBased');

        expectStopValues(stops, [1, 2000, 4000, 6000, 8000]);
        expect(stops.map(({ label }) => label)).toEqual([
            '1.0 - 2000.0',
            '2000.0 - 4000.0',
            '4000.0 - 6000.0',
            '6000.0 - 8000.0',
            '8000.0 - 10000.0'
        ]);
    });
});
