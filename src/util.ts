// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as d3 from 'd3';
import { Aggregate, AxisConfig } from './core';

const convertToClass = (value: any) => value;

const loadDataCsv = async (dataUrl: string, dataFields) => {
    const parseFields = dataFields.map((field) => {
        let parse = (d) => d[field.name];
        switch (field.type) {
            case 'date':
                const parseFormat = d3.timeParse(field.format);
                parse = (d) => parseFormat(d[field.name]);
                break;
            case 'number':
                parse = (d) => parseFloat(d[field.name]);
                break;
        }
        return { name: field.name, parse: parse };
    });

    let raw = await d3.csv(dataUrl, (d) => {
        let row = {};
        parseFields.forEach((pf) => {
            row[pf.name] = pf.parse(d);
        });
        return row;
    });

    return raw;
};

const loadAnnotations = async (annotationUrl) => {
    const annotations = await d3.json(annotationUrl);
    return [
        ...d3
            .rollup(
                annotations,
                (v) => v,
                (a: any) => a['type']
            )
            .entries(),
    ].map((e) => ({ key: e[0], values: e[1] }));
};

const identity = (d: any) => d;

const updateConfigWithFormats = (config) => {
    if (config.type === 'number') {
        config.format_long = d3.format(
            config.format_long ? config.format_long : ',d'
        );
        config.format_short = d3.format(
            config.format_short ? config.format_short : ',d'
        );
    } else if (config.type === 'string') {
        config.format_long = config.map ? (d: any) => config.map[d] : identity;
        config.format_short = config.map ? (d: any) => config.map[d] : identity;
        config.format_abbrev = identity;
    } else if (config.type === 'date') {
        switch (config.period) {
            case 'Second':
                break;
            case 'Minute':
                break;
            case 'Hour':
                break;
            case 'Day':
                config.format_long = d3.timeFormat('%B %-d, %Y');
                config.format_short = d3.timeFormat('%B %-d');
                config.format_abbrev = d3.timeFormat('%b %-d');
                break;
            case 'Week':
                config.format_long = d3.timeFormat('%B %-d, %Y');
                config.format_short = d3.timeFormat('%B %-d');
                config.format_abbrev = d3.timeFormat('%b %-d');
                break;
            case 'Month':
                config.format_long = d3.timeFormat('%B %Y');
                config.format_short = d3.timeFormat('%B %Y');
                config.format_abbrev = d3.timeFormat('%b');
                break;
            case 'Year':
                config.format_long = d3.timeFormat('%Y');
                config.format_short = d3.timeFormat('%Y');
                config.format_abbrev = d3.timeFormat("'%y");
                break;
        }
        switch (config.interval) {
            case 'Second':
                break;
            case 'Minute':
                break;
            case 'Hour':
                break;
            case 'Day':
                config.format_group = [
                    d3.timeFormat('%B %-d, %Y'),
                    d3.timeFormat('%B %-d'),
                    d3.timeFormat('%Y'),
                ];
                break;
            case 'Week':
                config.format_group = [
                    d3.timeFormat('%B %-d, %Y'),
                    d3.timeFormat('%B %-d'),
                    d3.timeFormat('%Y'),
                ];
                break;
            case 'Month':
                config.format_group = [
                    d3.timeFormat('%B %Y'),
                    d3.timeFormat('%B'),
                    d3.timeFormat('%Y'),
                ];
                break;
            case 'Year':
                config.format_group = [
                    d3.timeFormat('%Y'),
                    d3.timeFormat('%Y'),
                    d3.timeFormat(''),
                ];
                break;
        }
    }
    return config;
};

const computeAll = (series: any[], type: string, config: AxisConfig): any[] => {
    let map = new Map();
    series.forEach((s: any) => {
        s[type].forEach((v: any) => {
            let k = type === 'raw' ? v[config.name].toString() : v.key;
            let a = map.get(k) || new Map();
            a.set(s.key, v);
            map.set(k, a);
        });
    });
    let ret = [...map.values()];
    // TODO add key + values instead of an array
    ret = ret
        .map((a) =>
            [...a.entries()]
                .map((e) => ({
                    ...e[1],
                    series: e[0],
                }))
                .sort((a: any, b: any) => {
                    // Sort count
                    if (type === 'x') {
                        return a.mean - b.mean;
                    } else if (type === 'y') {
                        return a.count - b.count;
                    } else {
                        return 0; // TODO have same series order?
                    }
                })
        )
        .sort((a: any, b: any) => {
            if (config.type === 'date') {
                return 0;
            } else {
                return a[0].key - b[0].key;
            }
        });
    return ret;
};

const computeSubstrateData = (
    configBase: AxisConfig,
    configValue: AxisConfig,
    configSeries: AxisConfig,
    configDomain: string[],
    raw: any[]
): any[] => {
    const rollupValues = (v) => {
        const r = { values: v };
        configBase.aggregate.forEach((a: Aggregate) => {
            r[a] = AGGREGATE[a](
                v,
                configBase,
                configValue,
                configSeries,
                configDomain,
                raw
            );
        });
        return r;
    };

    const rollupKey = (d) => {
        if (configBase.type === 'date') {
            let timeInterval = d3['time' + configBase.interval];
            return timeInterval(d[configBase.name]).toString();
        } else if (
            configBase.type === 'number' &&
            typeof configBase.interval === 'number' &&
            configBase.aggregate[0] !== 'layout_sum'
        ) {
            return Math.floor(d[configBase.name] / configBase.interval);
        } else if (
            configBase.type === 'number' &&
            typeof configBase.interval === 'number' &&
            configBase.aggregate[0] === 'layout_sum'
        ) {
            return Math.floor(d.layout[1] / configBase.interval);
        } else if (configBase.type === 'string') {
            return d[configBase.name];
        }
    };

    return [...d3.rollup(raw, rollupValues, rollupKey).entries()]
        .map((e) => ({
            ...e[1],
            key: e[0],
        }))
        .sort((a: any, b: any) => {
            if (
                configBase.type === 'number' &&
                typeof configBase.interval === 'number'
            ) {
                return a.key - b.key;
            } else {
                return 0;
            }
        });
};

const AGGREGATE = {
    mean: (v, configBase, configValue, configSeries?, configDomain?, raw?) =>
        d3.mean(v, (d) => d[configValue.name]),
    max: (v, configBase, configValue, configSeries?, configDomain?, raw?) =>
        d3.max(v, (d) => d[configValue.name]),
    min: (v, configBase, configValue, configSeries?, configDomain?, raw?) =>
        d3.min(v, (d) => d[configValue.name]),
    sum: (v, configBase, configValue, configSeries?, configDomain?, raw?) =>
        d3.sum(v, (d) => d[configValue.name]),
    count: (v, configBase, configValue, configSeries?, configDomain?, raw?) =>
        v.length,
    consecutive_days: (
        v,
        configBase,
        configValue,
        configSeries?,
        configDomain?,
        raw?
    ) => {
        let timePeriod = d3['time' + configValue.period];
        let ai = 0;
        let m = v.reduce((arr, d, i) => {
            let curr = arr[ai],
                p = curr ? curr[curr.length - 1] : undefined;

            if (
                p &&
                timePeriod.count(p[configValue.name], d[configValue.name]) > 1
            ) {
                ai++;
            }

            if (!arr[ai]) {
                arr[ai] = [];
            }

            arr[ai].push(d);

            return arr;
        }, []);

        return m.map((vv) => ({
            values: vv,
            days: vv.length,
            date_label: createDateLabel(vv, configBase, configValue),
            date_aria: createDateAria(vv, configBase, configValue),
            date_class: createDateClass(vv, configBase, configValue),
        }));
    },
    layout_sum: (
        v,
        configBase,
        configValue,
        configSeries?,
        configDomain?,
        raw?
    ) => {
        return v.map((ee: any) => {
            let [series, description, label] = createStackSeries(
                ee[configSeries.name],
                configSeries,
                configDomain
            );
            // TODO get rid of hardcoded values
            let values = raw.filter(
                (dd) =>
                    dd[configValue.name] === ee[configValue.name] &&
                    series.indexOf(dd[configSeries.name]) > -1
            );
            return {
                key: ee[configValue.name],
                values,
                description,
                label,
                series,
            };
        });
    },
};

const createDateLabel = (v, configBase, configValue) => {
    let d0 = v[0][configValue.name],
        d1 = v[v.length - 1][configValue.name];
    // TODO figure out a way to concatenate dates at right level if they run together
    if (v.length === 1) {
        return configValue.format_abbrev(d0);
    } else {
        return (
            configValue.format_abbrev(d0) +
            ' - ' +
            configValue.format_abbrev(d1)
        );
    }
};

const joinArrayWithCommasAnd = (v: string[]): string => {
    return (
        v.slice(0, v.length - 1).join(', ') +
        (v.length > 1 ? ', and ' : '') +
        v[v.length - 1]
    );
};

const createStackAria = (
    series: string,
    seriesConfig: AxisConfig,
    seriesDomain: string[]
): any => {
    const index = seriesDomain.indexOf(series);
    if (index === seriesDomain.length - 1) {
        return 'Total';
    } else {
        return seriesDomain.slice(0, index + 1).join(' plus ');
    }
};

const createStackSeries = (
    series: string,
    seriesConfig: AxisConfig,
    seriesDomain: string[]
): any[] => {
    const index = seriesDomain.indexOf(series);
    if (index === seriesDomain.length - 1) {
        return [
            [...seriesDomain],
            'Total',
            'Total',
        ];
    } else {
        let slice = seriesDomain.slice(0, index + 1);
        return [
            slice,
            seriesDomain.slice(0, index + 1).join(' plus '),
            slice.join(' + '),
        ];
    }
};

const createDateClass = (
    v: any,
    configBase: AxisConfig,
    configValue: AxisConfig
) => {
    let d0 = v[0][configValue.name],
        d1 = v[v.length - 1][configValue.name];
    return formatDateClass(d0) + '_' + formatDateClass(d1);
};

const createDateAria = (
    v,
    configBase: AxisConfig,
    configValue: AxisConfig
): string => {
    let d0 = v[0][configValue.name],
        d1 = v[v.length - 1][configValue.name];
    if (v.length === 1) {
        return configValue.format_long(d0);
        // TODO figure out a way to concatenate dates at right level if they run together
    } else {
        return (
            configValue.format_long(d0) + ' to ' + configValue.format_long(d1)
        );
    }
};

const createDateAriaForStartEnd = (
    start: Date,
    end: Date,
    config: AxisConfig
): string => {
    let formatYear = d3.timeFormat('%Y'),
        formatMonth = d3.timeFormat('%B'),
        formatDate = d3.timeFormat('%-d');

    let Y = [formatYear(start), formatYear(end)],
        M = [formatMonth(start), formatMonth(end)],
        D = [formatDate(start), formatDate(end)];

    switch (config.period) {
        case 'Second':
            break;
        case 'Minute':
            break;
        case 'Hour':
            break;
        case 'Day':
        case 'Week':
            if (Y[0] === Y[1]) {
                if (M[0] === M[1]) {
                    if (D[0] === D[1]) {
                        return M[0] + ' ' + D[0] + ', ' + Y[0];
                    } else {
                        return M[0] + ' ' + D[0] + ' to ' + D[1] + ', ' + Y[0];
                    }
                } else {
                    return (
                        M[0] +
                        ' ' +
                        D[0] +
                        ' to ' +
                        M[1] +
                        ' ' +
                        D[1] +
                        ', ' +
                        Y[0]
                    );
                }
            } else {
                return (
                    M[0] +
                    ' ' +
                    D[0] +
                    ', ' +
                    Y[0] +
                    ' to ' +
                    M[1] +
                    ' ' +
                    D[1] +
                    ', ' +
                    Y[1]
                );
            }
        case 'Month':
            if (Y[0] === Y[1]) {
                if (M[0] === M[1]) {
                    return M[0] + ' ' + Y[0];
                } else {
                    return M[0] + ' to ' + M[1] + ' ' + Y[0];
                }
            } else {
                return M[0] + ' ' + Y[0] + ' to ' + M[1] + ' ' + Y[1];
            }
        case 'Year':
            if (Y[0] === Y[1]) {
                return Y[0];
            } else {
                return Y[0] + ' to ' + Y[1];
            }
        default:
            return '';
    }
    return '';
};

const computeCombine = (
    raw: any[],
    type: string,
    series: string[],
    configBase: AxisConfig,
    configValue: AxisConfig,
    configSeries?: AxisConfig
): any[] => {
    const rollupValues = (v) => {
        const r = {
            values: v,
            value: v[0][configValue.name],
            series: configSeries
                ? v.map((d) => d[configSeries.name])
                : ['Series1'],
        };
        return r;
    };

    const rollupKeyBase = (d) => {
        if (configBase.type === 'date') {
            let timeInterval = d3['time' + configBase.interval];
            return timeInterval(d[configBase.name]).toString();
        } else if (
            configBase.type === 'number' &&
            typeof configBase.interval === 'number'
        ) {
            return Math.floor(d[configBase.name] / configBase.interval);
        }
    };

    let rollup = [
        ...d3
            .rollup(
                raw,
                rollupValues,
                rollupKeyBase,
                (d) => d[configValue.name]
            )
            .entries(),
    ].map((e) => ({
        values: [...e[1].values()],
        key: e[0],
    }));

    let interval = configBase.interval ? configBase.interval : 1;
    return rollup
        .map((r) => {
            const range = [r.key * +interval, (r.key + 1) * +interval];
            let combined = findAll(
                r.values,
                configSeries ? series : ['Series1'],
                configValue,
                configSeries,
                range
            );
            return {
                values: combined,
                key: r.key,
                range,
            };
        })
        .sort((a, b) => a.key - b.key);
};

const findLongestSubarray = (
    array: any[],
    series: string[],
    configValue: AxisConfig
) => {
    let max = 1,
        len = 1,
        index = -1;

    for (let i = 1; i < array.length; i++) {
        if (
            d3['time' + configValue.period].count(
                array[i - 1].value,
                array[i].value
            ) <= 1 &&
            d3.intersection(array[i].series, array[i - 1].series, series)
                .size === series.length
        ) {
            len++;
        } else {
            if (max < len) {
                max = len;
                index = i - max;
            }
            len = 1;
        }
    }

    if (max < len) {
        max = len;
        index = array.length - max;
    }

    return [index, index + max];
};

const createCombination = function (a, min) {
    var fn = function (n, src, got, all) {
        if (n == 0) {
            if (got.length > 0) {
                if (all[got.length]) {
                    all[got.length].push(got);
                } else {
                    all[got.length] = [got];
                }
            }
            return;
        }
        for (var j = 0; j < src.length; j++) {
            fn(n - 1, src.slice(j + 1), got.concat([src[j]]), all);
        }
        return;
    };
    var all: any[] = [];
    for (var i = min; i < a.length; i++) {
        fn(i, a, [], all);
    }
    all.push([a]);
    return all.reverse();
};

const findAll = (
    array: any[],
    series: string[],
    configValue: AxisConfig,
    configSeries: any,
    range: number[]
) => {
    let combinations = createCombination(series, 1).slice(0, series.length);
    let all: any[] = [];

    let copy = [...array];

    let c = 0;

    let n = 0;

    let longestSubarrayForCombinations = (arr, com) => {
        let maxIndices = [-1, 0];
        let maxComIndex = 0;
        for (let i = 0; i < com.length; i++) {
            let indices = findLongestSubarray(arr, com[i], configValue);
            if (indices[1] - indices[0] > maxIndices[1] - maxIndices[0]) {
                maxIndices = indices;
                maxComIndex = i;
            }
        }
        return [maxIndices[0], maxIndices[1], maxComIndex];
    };

    let keepOtherCombinations = (arr, com) => {
        let other: any[] = [];
        for (let i = 0; i < arr.length; i++) {
            let diff = d3.difference(arr[i].series, com);
            if (diff.size > 0) {
                let values = arr[i].values.filter((d) =>
                    diff.has(d[configSeries.name])
                );
                arr[i].values = arr[i].values.filter(
                    (d) => !diff.has(d[configSeries.name])
                );
                other.push({
                    value: new Date(arr[i].value.getTime()),
                    values,
                    series: [...diff],
                });
            }
        }
        return other;
    };

    while (c < combinations.length && copy.length > 1 && n < 10) {
        n++;
        // Check combinations at this level
        let ret = longestSubarrayForCombinations(copy, combinations[c]);

        let indices = ret.slice(0, 2);
        let cc = ret[2];

        let nextIndices = [0, 0];
        let nextCC = 0;
        if (combinations[c + 1]) {
            // Check combinations at the next level
            ret = longestSubarrayForCombinations(copy, combinations[c + 1]);
            nextIndices = ret.slice(0, 2);
            nextCC = ret[2];
        }

        if (
            indices[1] - indices[0] > 1 ||
            nextIndices[1] - nextIndices[0] > 1
        ) {
            if (
                indices[1] - indices[0] >
                (nextIndices[1] - nextIndices[0]) / 2
            ) {
                let staying = [];
                all.push({
                    series: combinations[c][cc],
                    range,
                    values: copy.slice(indices[0], indices[1]).map((v) => {
                        if (!configSeries) {
                            return v.values;
                        } else {
                            return combinations[c][cc].map((s) =>
                                v.values.find((d) => s === d[configSeries.name])
                            );
                        }
                    }),
                });
                let other = keepOtherCombinations(
                    copy.slice(indices[0], indices[1]),
                    combinations[c][cc]
                );
                copy = copy
                    .slice(0, indices[0])
                    .concat(other)
                    .concat(copy.slice(indices[1], copy.length));
            } else {
                all.push({
                    series: combinations[c + 1][nextCC],
                    range,
                    values: copy
                        .slice(nextIndices[0], nextIndices[1])
                        .map((v) => {
                            if (!configSeries) {
                                return v.values;
                            } else {
                                return combinations[c + 1][nextCC].map((s) =>
                                    v.values.find(
                                        (d) => s === d[configSeries.name]
                                    )
                                );
                            }
                        }),
                });
                let other = keepOtherCombinations(
                    copy.slice(nextIndices[0], nextIndices[1]),
                    combinations[c + 1][nextCC]
                );
                copy = copy
                    .slice(0, nextIndices[0])
                    .concat(other)
                    .concat(copy.slice(nextIndices[1], copy.length));
                c++;
            }
        } else {
            c++;
        }
    }
    return all;
};

const computeAllCombine = (
    data: any,
    type: string,
    configBase: AxisConfig,
    configValue: AxisConfig,
    configSeries?: AxisConfig
) => {
    let all = computeAll(data['series'], type, configBase);
    let combine = computeCombine(
        data['raw'],
        type,
        data['series'].map((s) => s.key),
        configBase,
        configValue,
        configSeries
    );
    for (let i = 0; i < combine.length; i++) {
        combine[i]['all'] = all[i];
    }
    return combine;
};

const formatDateClass = d3.timeFormat('%b-%d-%y');

export {
    updateConfigWithFormats,
    convertToClass,
    loadDataCsv,
    loadAnnotations,
    joinArrayWithCommasAnd,
    computeAll,
    computeAllCombine,
    computeCombine,
    computeSubstrateData,
    createDateAria,
    createDateAriaForStartEnd,
    createDateClass,
    createStackAria,
    createStackSeries,
    AGGREGATE,
};
