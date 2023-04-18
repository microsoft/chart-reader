// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as d3 from 'd3';

import { getOuterBBox, alignment, elbowLine, horizontalLine } from './annot';
import {
    computeAll,
    computeAllCombine,
    computeSubstrateData,
    createDateAriaForStartEnd,
    loadAnnotations,
    loadDataCsv,
    updateConfigWithFormats,
} from './util';
import { Sonifier } from './sonify';

import {
    AxisConfig,
    ChartConfig,
    DataConfig,
    DimensionConfig,
    MarginConfig,
} from './core';
import { NavigationController } from './navigation-controller';

class LineChart {
    private _data: any;
    private _dimensions: any;
    private _config: ChartConfig;
    private _scales: { x: any; y: any; stroke: any; tooltip: any };
    private _axes: { x: any; y: any };
    private _shapes: { area: any; line: any };

    private _nav: NavigationController;

    private _sonifier: Sonifier;

    private _containerId: string;
    private $container: d3.selection;
    private $chartWrapper: d3.selection;
    private $chart: d3.selection;
    private $chartBefore: d3.selection;
    private $chartAfter: d3.selection;
    private $chartFocus: d3.selection;
    private $chartLive: d3.selection;

    private $axesG: d3.selection;
    private $markG: d3.selection;
    private $annotG: d3.selection;
    private $hoverG: d3.selection;
    private $ariaG: d3.selection;
    private $dataTip: d3.selection;

    private $tooltips: { x: any; y: any; raw: any };

    constructor(
        containerSelector: string,
        config: ChartConfig,
        dimensions: DimensionConfig,
        dataConfig: DataConfig
    ) {
        this._data = {};
        this.$container = d3.select(containerSelector);
        this._containerId = containerSelector;
        this._dimensions = dimensions;
        this._config = config;
        this._scales = {
            x: d3.scaleTime(),
            y: d3.scaleLinear(),
            tooltip: d3.scaleTime(),
            stroke: d3.scaleOrdinal(d3.schemeCategory10),
        };
        this._axes = {
            x: d3.axisBottom(this._scales.x),
            y: d3.axisRight(this._scales.y),
        };
        this._shapes = { area: d3.area(), line: d3.line() };

        if (this.config.z) {
            this._dimensions.margin.r += 140;
        }

        this.$tooltips = { x: undefined, y: undefined, raw: undefined };

        this.config.x = updateConfigWithFormats(this.config.x);
        this.config.y = updateConfigWithFormats(this.config.y);

        this.createElements();
        this.createScalesAxes();
        this.createKeyHandler();
        this.createSonification();
        this.createNavigation();

        this.loadData(dataConfig, () => {
            if (!this._data.raw) {
                console.error('Data not loaded!');
            } else {
                console.log('Data loaded');
                this.initChart();
                this.drawChart();
                this.initSonifier();
                this.createDescriptions();
            }
        });
    }

    get width(): number {
        return this._dimensions.width;
    }

    get height(): number {
        return this._dimensions.height;
    }

    get margin(): MarginConfig {
        return this._dimensions.margin;
    }

    get config(): ChartConfig {
        return this._config;
    }

    createElements() {
        console.log('create elements called');
        this.$chartBefore = this.$container.append('div');

        this.$chartWrapper = this.$container
            .append('div')
            .attr('class', 'chart-wrapper')
            .attr('aria-hidden', 'false')
            .attr('dir', 'ltr')
            .attr('tabindex', 0)
            .attr('aria-label', 'Interactive chart. Press enter key to start.')
            .attr('role', 'application')
            .style('height', '100%')
            .style('width', '100%');

        this.$chartAfter = this.$container.append('div');

        // Add to wrapper so part of application, but has document role
        this.$chartFocus = this.$chartWrapper.append('div');
        this.$chartLive = this.$chartWrapper.append('div');
        this.$chart = this.$chartWrapper
            .append('svg')
            .attr('aria-hidden', 'false')
            .attr('height', '100%')
            .attr('width', '100%')
            .append('g')
            .attr(
                'transform',
                'translate(' + [this.margin.l, this.margin.t] + ')'
            );

        this.$axesG = this.$chart.append('g').attr('aria-hidden', 'true');
        this.$markG = this.$chart.append('g').attr('aria-hidden', 'true');
        this.$annotG = this.$chart.append('g').attr('aria-hidden', 'true');
        this.$hoverG = this.$chart.append('g').attr('aria-hidden', 'true');
        this.$ariaG = this.$chart
            .append('g')
            .attr('aria-hidden', 'false')
            .attr('role', 'region');

        this.$dataTip = this.$hoverG
            .append('g')
            .attr('class', 'data-tip')
            .attr('transform', 'translate(0,0)')
            .style('visibility', 'hidden');
        this.$dataTip.append('path');

        this.$tooltips.raw = {};
        this.$tooltips.raw.container = this.$container
            .append('div')
            .attr('class', 'tooltip-container tooltip-raw')
            .attr('aria-hidden', 'true')
            .style('visibility', 'hidden');
        this.$tooltips.raw.base = this.$tooltips.raw.container
            .append('div')
            .attr('class', 'tooltip tooltip-raw');
        this.$tooltips.raw.inner = this.$tooltips.raw.base
            .append('div')
            .attr('class', 'tooltip-inner');
        this.$tooltips.raw.label = this.$tooltips.raw.inner
            .append('span')
            .attr('class', 'tooltip-label');
        this.$tooltips.raw.value = this.$tooltips.raw.inner
            .append('span')
            .attr('class', 'tooltip-value');
        if (this.config.z) {
            this.$tooltips.raw.series = this.$tooltips.raw.inner
                .append('div')
                .attr('class', 'tooltip-series');
            this.$tooltips.raw.series
                .append('span')
                .attr('class', 'tooltip-series-label')
                .text('Series:');
            this.$tooltips.raw.series
                .append('span')
                .attr('class', 'tooltip-series-legend');
            this.$tooltips.raw.series
                .append('span')
                .attr('class', 'tooltip-series-series');
        }

        this.$tooltips.x = {};
        this.$tooltips.x.container = this.$container
            .append('div')
            .attr('class', 'tooltip-container tooltip-x tooltip-right')
            .attr('aria-hidden', 'true')
            .style('visibility', 'hidden');
        this.$tooltips.x.base = this.$tooltips.x.container
            .append('div')
            .attr('class', 'tooltip tooltip-x');
        this.$tooltips.x.inner = this.$tooltips.x.base
            .append('div')
            .attr('class', 'tooltip-inner');
        this.$tooltips.x.label = this.$tooltips.x.inner
            .append('span')
            .attr('class', 'tooltip-label');
        this.$tooltips.x.series = this.$tooltips.x.inner
            .append('div')
            .attr('class', 'tooltip-series');

        this.$tooltips.y = {};
        this.$tooltips.y.container = this.$container
            .append('div')
            .attr('class', 'tooltip-container tooltip-y tooltip-left')
            .attr('aria-hidden', 'true')
            .style('visibility', 'hidden');
        this.$tooltips.y.base = this.$tooltips.y.container
            .append('div')
            .attr('class', 'tooltip tooltip-y');
        this.$tooltips.y.inner = this.$tooltips.y.base
            .append('div')
            .attr('class', 'tooltip-inner');
        this.$tooltips.y.label = this.$tooltips.y.inner
            .append('span')
            .attr('class', 'tooltip-label');
        this.$tooltips.y.series = this.$tooltips.y.inner
            .append('div')
            .attr('class', 'tooltip-series');
    }

    createScalesAxes() {
        this._scales.x.range([0, this.width - this.margin.l - this.margin.r]);
        this._scales.y.range([this.height - this.margin.t - this.margin.b, 0]);
        this._scales.tooltip.range([-10, -90]);

        this._axes.x.ticks(d3['time' + this.config.x.interval]);
        this._axes.y
            .ticks(6)
            .tickSize(this._scales.x.range()[1] + 60)
            .tickFormat(this.config.y.format_short);

        this._shapes.line
            .defined((d) => !isNaN(d[this.config.y.name]))
            .x((d) => this._scales.x(d[this.config.x.name]))
            .y((d) => this._scales.y(d[this.config.y.name]));
        this._shapes.area
            .defined((d) => !isNaN(d[this.config.y.name]))
            .x((d) => this._scales.x(d[this.config.x.name]))
            .y1((d) => this._scales.y(d[this.config.y.name]))
            .y0(this._scales.y(0));
    }

    createDescriptions() {
        this.$chartBefore
            .attr('class', 'chart-sr-desc-container chart-sr-before')
            .attr('aria-hidden', 'false')
            .attr('tabindex', 0);
        let $beforeWrapper = this.$chartBefore
            .append('div')
            .attr('class', 'chart-sr-desc-wrapper')
            .attr('aria-hidden', 'false');
        let $beforeContent = $beforeWrapper
            .append('div')
            .attr('class', 'chart-sr-desc-content chart-sr-desc-start');

        $beforeContent
            .append('div')
            .attr('aria-hidden', false)
            .attr('class', 'chart-sr-desc-title')
            .text('Chart Description');
        $beforeContent
            .append('div')
            .attr('class', 'chart-sr-desc-title')
            .text(this.config.description.title);
        $beforeContent
            .append('div')
            .attr('class', 'chart-sr-desc-type')
            .text(
                'Line chart with ' +
                    this._data.series.length +
                    ' data series.' +
                    (this._data.series.length > 1
                        ? ' The series are: ' +
                          this._data.series
                              .map((s) => this.config.z.map[s.key])
                              .join(', ') +
                          '.'
                        : '')
            );
        $beforeContent
            .append('div')
            .attr('class', 'chart-sr-desc-caption')
            .text(this.config.description.caption);
        $beforeContent
            .append('div')
            .attr('class', 'chart-sr-desc-x-axis')
            .text(
                'This chart has 1 X axis displaying ' +
                    this.config.x.label_axis +
                    '. Data ranges from ' +
                    this.config.x.format_long(this._scales.x.domain()[0]) +
                    ' to ' +
                    this.config.x.format_long(this._scales.x.domain()[1]) +
                    '.'
            );
        $beforeContent
            .append('div')
            .attr('class', 'chart-sr-desc-y-axis')
            .text(
                'This chart has 1 Y axis displaying ' +
                    this.config.y.label_axis +
                    '. Data ranges from ' +
                    this.config.y.format_long(this._scales.y.domain()[0]) +
                    ' to ' +
                    this.config.y.format_long(this._scales.y.domain()[1]) +
                    '.'
            );

        this.$chartAfter
            .attr('class', 'chart-sr-desc-container  chart-sr-after')
            .attr('aria-hidden', 'false')
            .attr('tabindex', 0);
        let $afterWrapper = this.$chartAfter
            .append('div')
            .attr('class', 'chart-sr-desc-wrapper')
            .attr('aria-hidden', 'false');
        let $afterContent = $afterWrapper
            .append('div')
            .attr('class', 'chart-sr-desc-content chart-sr-desc-exit')
            .attr('aria-hidden', false)
            .text('End of interactive chart');

        this.$chartLive
            .attr('class', 'chart-sr-desc-container chart-sr-live')
            .attr('aria-hidden', 'false')
            .attr('tabindex', '-1')
            .attr('aria-live', 'assertive')
            .attr('role', 'alert');
        let $liveWrapper = this.$chartLive
            .append('div')
            .attr('class', 'chart-sr-desc-wrapper')
            .attr('aria-hidden', 'false');
        $liveWrapper
            .append('p')
            .attr('class', 'chart-sr-desc-content chart-sr-live-content')
            .text('Aria-label goes here');

        this.$chartFocus
            .attr('class', 'chart-sr-desc-container chart-sr-focus')
            .attr('role', 'document')
            .attr('aria-hidden', 'false')
            .attr('tabindex', '-1');
        let $focusWrapper = this.$chartFocus
            .append('div')
            .attr('class', 'chart-sr-desc-wrapper')
            .attr('aria-hidden', 'false');
        $focusWrapper
            .append('p')
            .attr('class', 'chart-sr-desc-content chart-sr-focus-landing')
            .text('Document mode. Escape key to return.');
        $focusWrapper
            .append('p')
            .attr('class', 'chart-sr-desc-content chart-sr-focus-content')
            .text('Aria-label goes here');
    }

    createNavigation() {
        let tree = new Map();

        let root = {
            type: 'control',
            level: 0,
            id: 1,
            values: ['-'],
            selected: 0,
            getClass: (d: any, valueAtLevels: any[], config: ChartConfig) =>
                '.chart-wrapper',
        };

        let aNode = {
            type: 'control',
            level: 1,
            id: 2,
            selected: 0,
            values: this.config.z ? [2, 3, 4, 5, 16, 19] : [2, 3, 4, 5, 16],
            getClass: (d: any, valueAtLevels: any[], config: ChartConfig) =>
                '.annotation-ghost-container',
        };

        let xNode = {
            type: 'control',
            level: 1,
            id: 3,
            selected: 0,
            values: this.config.z ? [2, 3, 4, 5, 16, 19] : [2, 3, 4, 5, 16],
            getClass: (d: any, valueAtLevels: any[], config: ChartConfig) =>
                '.x-ghost-container',
        };

        let yNode = {
            type: 'control',
            level: 1,
            id: 4,
            selected: 0,
            values: this.config.z ? [2, 3, 4, 5, 16, 19] : [2, 3, 4, 5, 16],
            getClass: (d: any, valueAtLevels: any[], config: ChartConfig) =>
                '.y-ghost-container',
        };

        let rawNode = {
            type: 'control',
            level: 1,
            id: 5,
            selected: 0,
            values: this.config.z ? [2, 3, 4, 5, 16, 19] : [2, 3, 4, 5, 16],
            getClass: (d: any, valueAtLevels: any[], config: ChartConfig) =>
                '.bar-ghost-container',
        };

        let compareNode = {
            type: 'control',
            level: 1,
            id: 16,
            selected: 0,
            values: this.config.z ? [2, 3, 4, 5, 16, 19] : [2, 3, 4, 5, 16],
            getClass: (d: any, valueAtLevels: any[], config: ChartConfig) =>
                '.compare-ghost-container',
        };

        if (this._config.z) {
            let filterNode = {
                type: 'control',
                level: 1,
                id: 19,
                selected: 0,
                values: [2, 3, 4, 5, 16, 19],
                getClass: (d: any, valueAtLevels: any[], config: ChartConfig) =>
                    '.filter-ghost-container',
            };

            let filterTickNode = {
                type: 'filter',
                level: 2,
                id: 20,
                selected: 0,
                getData: (data: any, valueAtLevels: any[]) => data.filters,
                getClass: (
                    d: any,
                    valueAtLevels: any[],
                    config: ChartConfig
                ) => {
                    return '.filter-ghost.value-' + formatStringClass(d.value);
                },
            };
            tree.set(root.id, {
                children: [
                    aNode.id,
                    xNode.id,
                    yNode.id,
                    rawNode.id,
                    compareNode.id,
                    filterNode.id,
                ],
                parent: -1,
                element: root,
            });
            tree.set(filterNode.id, {
                children: [filterTickNode.id],
                parent: root.id,
                element: filterNode,
            });
            tree.set(filterTickNode.id, {
                children: [],
                parent: filterNode.id,
                element: filterTickNode,
            });
        }

        let groupANode = {
            type: 'data-no-sonify',
            level: 2,
            id: 6,
            selected: 0,
            getData: (data: any, valueAtLevels: any[]) => data.annotations,
            getClass: (d: any, valueAtLevels: any[], config: ChartConfig) =>
                '.annotation-group-ghost.key-' + d.key,
        };

        let binXNode = {
            type: 'data-sonify-values',
            sonify: 'mean',
            level: 2,
            id: 7,
            selected: 0,
            getData: (data: any, valueAtLevels: any[]) => data.all.x,
            getClass: (d: any, valueAtLevels: any[], config: ChartConfig) => {
                return '.x-ghost.value-' + formatDateClass(new Date(d[0].key));
            },
        };

        let binYNode = {
            type: 'data-no-sonify',
            sonify: 'values.length',
            level: 2,
            id: 8,
            selected: 0,
            getData: (data: any, valueAtLevels: any[]) => data.all.y,
            getClass: (d: any, valueAtLevels: any[], config: ChartConfig) =>
                '.y-ghost.value-' + d.key,
        };

        let aEachNode = {
            type: 'data-no-sonify',
            level: 3,
            id: 9,
            selected: 0,
            series: 0,
            getData: (data: any, valueAtLevels: any[]) =>
                valueAtLevels[2].values,
            getClass: (d: any, valueAtLevels: any[], config: ChartConfig) =>
                '.annotation-ghost.annotation-' + d.index,
        };

        let binXBarNode = {
            type: 'series_reverse',
            level: 3,
            id: 10,
            selected: 0,
            series: 0,
            getData: (data: any, valueAtLevels: any[]) => valueAtLevels[2],
            getClass: (d: any, valueAtLevels: any[], config: ChartConfig) =>
                '.bar.value-' +
                formatDateClass(d[config.x.name]) +
                '.series-' +
                formatStringClass(config.z ? d[config.z.name] : 'Series1'),
        };

        let binYCombineNode = {
            type: 'data-no-sonify',
            level: 3,
            id: 11,
            selected: 0,
            getData: (data: any, valueAtLevels: any[]) =>
                valueAtLevels[2].values,
            getClass: (d: any, valueAtLevels: any[], config: ChartConfig) =>
                '.y-ghost.value-' +
                valueAtLevels[2].key +
                ' .y-ghost-combine.value-' +
                formatDateClass(d.values[0][0][config.x.name]) +
                '_' +
                formatDateClass(
                    d.values[d.values.length - 1][0][config.x.name]
                ),
        };

        let aBarNode = {
            type: 'series_reverse',
            level: 4,
            id: 12,
            selected: 0,
            series: 0,
            getData: (data: any, valueAtLevels: any[]) =>
                valueAtLevels[3].target.data,
            getClass: (d: any, valueAtLevels: any[], config: ChartConfig) =>
                '.bar.value-' +
                formatDateClass(d[config.x.name]) +
                '.series-' +
                formatStringClass(config.z ? d[config.z.name] : 'Series1'),
        };

        let binYBarNode = {
            type: 'series_normal',
            level: 4,
            id: 13,
            selected: 0,
            series: 0,
            getData: (data: any, valueAtLevels: any[]) =>
                valueAtLevels[3].values,
            getClass: (d: any, valueAtLevels: any[], config: ChartConfig) =>
                '.bar.value-' +
                formatDateClass(d[config.x.name]) +
                '.series-' +
                formatStringClass(config.z ? d[config.z.name] : 'Series1'),
        };

        let rawBarNode = {
            type: 'series_normal',
            level: 3,
            id: 14,
            selected: 0,
            series: 0,
            getData: (data: any, valueAtLevels: any[]) => data.all.raw,
            getClass: (d: any, valueAtLevels: any[], config: ChartConfig) => {
                console.log(d);
                return (
                    '.bar.value-' +
                    formatDateClass(d[config.x.name]) +
                    '.series-' +
                    formatStringClass(config.z ? d[config.z.name] : 'Series1')
                );
            },
        };

        let compareXNode = {
            type: 'data-sonify-values',
            level: 2,
            id: 17,
            selected: 0,
            getData: (data: any, valueAtLevels: any[]) => data.all.raw,
            getClass: (d: any, valueAtLevels: any[], config: ChartConfig) => {
                console.log(d);
                return (
                    '.compare-ghost.value-' +
                    formatDateClass(new Date(d[0][config.x.name]))
                );
            },
        };

        let compareXBarNode = {
            type: 'series_normal',
            jump: 'enabled',
            level: 3,
            id: 18,
            selected: 0,
            series: 0,
            getData: (data: any, valueAtLevels: any[]) => [valueAtLevels[2]],
            getClass: (d: any, valueAtLevels: any[], config: ChartConfig) =>
                '.bar.value-' +
                formatDateClass(d[config.x.name]) +
                '.series-' +
                formatStringClass(config.z ? d[config.z.name] : 'Series1'),
        };

        if (!this.config.z) {
            tree.set(root.id, {
                children: [
                    aNode.id,
                    xNode.id,
                    yNode.id,
                    rawNode.id,
                    compareNode.id,
                ],
                parent: -1,
                element: root,
            });
        }

        tree.set(aNode.id, {
            children: [groupANode.id],
            parent: root.id,
            element: aNode,
        });

        tree.set(xNode.id, {
            children: [binXNode.id],
            parent: root.id,
            element: xNode,
        });

        tree.set(yNode.id, {
            children: [binYNode.id],
            parent: root.id,
            element: yNode,
        });

        tree.set(rawNode.id, {
            children: [rawBarNode.id],
            parent: root.id,
            element: rawNode,
        });

        tree.set(compareNode.id, {
            children: [compareXNode.id],
            parent: root.id,
            element: compareNode,
        });

        tree.set(compareXNode.id, {
            children: [compareXBarNode.id],
            parent: compareNode.id,
            element: compareXNode,
        });

        tree.set(compareXBarNode.id, {
            children: [],
            parent: compareXNode.id,
            element: compareXBarNode,
        });

        tree.set(binXNode.id, {
            children: [binXBarNode.id],
            parent: xNode.id,
            element: binXNode,
        });

        tree.set(groupANode.id, {
            children: [aEachNode.id],
            parent: aNode.id,
            element: groupANode,
        });

        tree.set(aEachNode.id, {
            children: [aBarNode.id],
            parent: groupANode.id,
            element: aEachNode,
        });

        tree.set(aBarNode.id, {
            children: [],
            parent: aEachNode.id,
            element: aBarNode,
        });

        tree.set(binYNode.id, {
            children: [binYCombineNode.id],
            parent: yNode.id,
            element: binYNode,
        });

        tree.set(rawBarNode.id, {
            children: [],
            parent: rawNode.id,
            element: rawBarNode,
        });

        tree.set(binXBarNode.id, {
            children: [],
            parent: binXNode.id,
            element: binXBarNode,
        });

        tree.set(binYCombineNode.id, {
            children: [binYBarNode.id],
            parent: binYNode.id,
            element: binYCombineNode,
        });

        tree.set(binYBarNode.id, {
            children: [],
            parent: binYCombineNode.id,
            element: binYBarNode,
        });

        this._nav = new NavigationController(
            this._sonifier,
            tree,
            root,
            (d: any) => this.highlightPoint(d)
        );
    }

    createKeyHandler() {
        this.$chartWrapper.on('keydown', (event) => {
            console.log(event);
            switch (event.keyCode) {
                // Arrow Left
                case 37:
                // Arrow Right
                case 39:
                    this._nav.action(
                        'left_right',
                        event.keyCode === 37 ? -1 : 1,
                        this._data,
                        this.config,
                        this.$ariaG,
                        this.$chartWrapper,
                        event.shiftKey
                    );
                    event.preventDefault();
                    break;
                // Arrow Up
                case 38:
                // Arrow Down
                case 40:
                    this._nav.action(
                        'series_up_down',
                        event.keyCode === 38 ? 1 : -1,
                        this._data,
                        this.config,
                        this.$ariaG,
                        this.$chartWrapper,
                        event.shiftKey
                    );
                    event.preventDefault();
                    break;
                // Enter
                case 13:
                    if (event.shiftKey) {
                        this._nav.toggleSonifier(
                            this._data,
                            this._config,
                            this.$ariaG,
                            this.$chartWrapper
                        );
                    } else {
                        this._nav.action(
                            'up_down',
                            1,
                            this._data,
                            this.config,
                            this.$ariaG,
                            this.$chartWrapper,
                            false
                        );
                    }
                    event.preventDefault();
                    break;
                // Esc
                case 27:
                    this._nav.action(
                        'up_down',
                        -1,
                        this._data,
                        this.config,
                        this.$ariaG,
                        this.$chartWrapper,
                        false
                    );
                    event.preventDefault();
                    break;
                // Space
                case 32:
                    this._nav.action(
                        'focus',
                        0,
                        this._data,
                        this.config,
                        this.$ariaG,
                        this.$chartWrapper,
                        false
                    );
                    event.preventDefault();
                    break;
                // Home
                case 36:
                // End
                case 35:
                    this._nav.action(
                        'left_right',
                        event.keyCode === 36
                            ? this._nav.getSelectedIndex() * -1
                            : this._nav.getSelectedLength() -
                                  this._nav.getSelectedIndex() -
                                  1,
                        this._data,
                        this.config,
                        this.$ariaG,
                        this.$chartWrapper,
                        event.shiftKey
                    );
                    event.preventDefault();
                    break;
                // Page Up
                case 33:
                // Page Down
                case 34:
                    this._nav.action(
                        'left_right',
                        event.keyCode === 33 ? -5 : 5,
                        this._data,
                        this.config,
                        this.$ariaG,
                        this.$chartWrapper,
                        event.shiftKey
                    );
                    event.preventDefault();
                    break;
                // CTRL
                case 17:
                    if (this._sonifier.isPlaying) {
                        this._nav.toggleSonifier(
                            this._data,
                            this._config,
                            this.$ariaG,
                            this.$chartWrapper
                        );
                    }
                    break;
                // INSERT | Num5 | 5
                case 45:
                case 12:
                case 53:
                    this._nav.action(
                        'none',
                        1,
                        this._data,
                        this.config,
                        this.$ariaG,
                        this.$chartWrapper,
                        event.shiftKey
                    );
                    event.preventDefault();
                    break;
                // I | X | Y | D | C | F
                case 73:
                case 88:
                case 89:
                case 68:
                case 67:
                case 70:
                    this._nav.action(
                        'control',
                        event.keyCode,
                        this._data,
                        this.config,
                        this.$ariaG,
                        this.$chartWrapper,
                        event.shiftKey
                    );
                    event.preventDefault();
                    break;
            }
        });
    }

    highlightPoints(values: any[]) {
        this.$dataTip
            .style('visibility', 'visible')
            .attr(
                'transform',
                'translate(' +
                    [this._scales.x(values[0][this._config.x.name]), 0] +
                    ')'
            );
        this.$dataTip
            .select('path')
            .attr(
                'd',
                'M0,' +
                    this._scales.y(
                        values[values.length - 1][this.config.y.name]
                    ) +
                    'V' +
                    this._scales.y.range()[0]
            );
        let $circleSelect = this.$dataTip.selectAll('circle').data(values);
        let $circleEnter = $circleSelect.enter().append('circle').attr('r', 4);

        let $circleMerge = $circleSelect
            .merge($circleEnter)
            .attr('cy', (d) => this._scales.y(d[this.config.y.name]))
            .style('fill', (d) =>
                this._scales.stroke(
                    this.config.z ? d[this.config.z.name] : 'Series1'
                )
            );
        $circleSelect.exit().remove();

        let pos = [
            this._scales.x(values[0][this.config.x.name]),
            this._scales.y(values[values.length - 1][this.config.y.name]),
        ];

        this.$tooltips.x.base.style(
            'transform',
            'translate(0px, ' +
                ((1 - pos[1] / this._scales.y.range()[0]) * 80 + 10) +
                '%)'
        );
        this.$tooltips.x.container
            .style('visibility', 'visible')
            .style('left', pos[0] + this.margin.l + 'px')
            .style('top', pos[1] + this.margin.t + 'px');
        this.$tooltips.x.label.text(
            this.config.x.format_group[1](values[0][this.config.x.name])
        );
        let $seriesDivSelect = this.$tooltips.x.series
            .selectAll('div')
            .data([...values].reverse()); // Reverse so in descending order
        let $seriesDivEnter = $seriesDivSelect.enter().append('div');
        $seriesDivEnter
            .append('span')
            .attr('class', 'tooltip-series-legend');
        $seriesDivEnter
            .append('span')
            .attr('class', 'tooltip-series-label');

        $seriesDivEnter
            .append('span')
            .attr('class', 'tooltip-series-value');
        $seriesDivSelect.exit().remove();
        let $seriesDivMerge = $seriesDivSelect.merge($seriesDivEnter);
        $seriesDivMerge
            .select('.tooltip-series-legend')
            .style('background', (dd) =>
                this._scales.stroke(
                    this.config.z ? dd[this.config.z.name] : 'Series1'
                )
            );
        $seriesDivMerge
            .select('.tooltip-series-label')
            .text((dd) =>
                this.config.z
                    ? this.config.z.map[dd[this.config.z.name]]
                    : 'Series1'
            );
        $seriesDivMerge
            .select('.tooltip-series-value')
            .text((dd) =>
                this.config.y.format_short(dd[this.config.y.name])
            );
    }

    highlightPoint(d: any) {
        this.$dataTip
            .style('visibility', 'visible')
            .attr(
                'transform',
                'translate(' +
                    [
                        this._scales.x(d[this._config.x.name]),
                        this._scales.y(d[this._config.y.name]),
                    ] +
                    ')'
            );
        this.$dataTip
            .select('path')
            .attr(
                'd',
                'M0,0v' +
                    (this._scales.y.range()[0] -
                        this._scales.y(d[this._config.y.name]))
            );

        let $circleSelect = this.$dataTip.selectAll('circle').data([d]);
        let $circleEnter = $circleSelect.enter().append('circle').attr('r', 4);

        let $circleMerge = $circleSelect
            .merge($circleEnter)
            .attr('cy', 0)
            .style('fill', (d) =>
                this._scales.stroke(
                    this.config.z ? d[this.config.z.name] : 'Series1'
                )
            );
        $circleSelect.exit().remove();

        this.$tooltips.raw.base.style(
            'transform',
            'translate(' +
                this._scales.tooltip(d[this._config.x.name]) +
                '%, 0px)'
        );
        this.$tooltips.raw.container
            .style('visibility', 'visible')
            .style(
                'left',
                this._scales.x(d[this.config.x.name]) + this.margin.l + 'px'
            )
            .style(
                'top',
                this._scales.y(d[this.config.y.name]) + this.margin.t + 'px'
            );
        this.$tooltips.raw.label.text(
            this.config.x.format_long(d[this.config.x.name])
        );
        this.$tooltips.raw.value.text(
            this.config.y.label_tooltip +
                this.config.y.format_long(d[this.config.y.name])
        );
        if (this.config.z) {
            this.$tooltips.raw.series
                .select('.tooltip-series-series')
                .text(this.config.z.map[d[this.config.z.name]]);
            this.$tooltips.raw.series
                .select('.tooltip-series-legend')
                .style(
                    'background',
                    this._scales.stroke(d[this.config.z.name])
                );
        }
    }

    createSonification() {
        const onPlayData = (d, i, s) => {
            this._nav.updateSonifier(
                this._data,
                this.config,
                this.$ariaG,
                this.$chartWrapper,
                i,
                s
            );
            console.log(d,i,s);
            if (d.length > 0) {
                this.highlightPoints(d);
            } else {
                this.highlightPoint(d);
            }
        };
        this._sonifier = new Sonifier(onPlayData);
    }

    filterData() {
        if (this.config.z) {
            const series = this._data.filters
                .filter((f) => !f.filtered)
                .map((f) => f.value);
            this._data.filtered = this._data.raw.filter(
                (d) => series.indexOf(d[this.config.z.name]) > -1
            );

            this.updateData();
            console.log(this._data);

            // TODO update annotations based on new data

            // this.drawChart();
            this.drawBaseMarks();
            this.drawAxisGroupLayer();
            // this.drawAnnotationLayer();
            this.drawAxesLegends();
            this.drawContainers();

            this.ghostSeriesLayer();
            // this.ghostAnnotionLayer();
        }
    }

    updateData() {
        const zDomain: any[] = this.config.z
            ? [
                  ...new Set(
                      this._data.filtered.map((d: any) => d[this.config.z.name])
                  ),
              ]
            : ['Series1'];
        this._data.series = [
            ...d3
                .rollup(
                    this._data.filtered,
                    (v) => {
                        let x = computeSubstrateData(
                            this.config.x,
                            this.config.y,
                            this.config.z,
                            zDomain,
                            v
                        );
                        let y = computeSubstrateData(
                            this.config.y,
                            this.config.x,
                            this.config.z,
                            zDomain,
                            v
                        );
                        let key = this.config.z
                            ? v[0][this.config.z.name]
                            : 'Series1';
                        return { key, raw: v, x, y };
                    },
                    (d) => (this.config.z ? d[this.config.z.name] : 'Series1')
                )
                .values(),
        ].sort((a, b) => {
            return a.x[a.x.length - 1].mean - b.x[b.x.length - 1].mean;
        });

        this._data.all = {
            x: computeAll(this._data.series, 'x', this.config.x),
            y: computeAllCombine(
                this._data,
                'y',
                this.config.y,
                this.config.x,
                this.config.z
            ),
            raw: computeAll(this._data.series, 'raw', this.config.x),
        };

        this._data.all.y = this._data.all.y.filter(
            (y) => y.values.length > 0 && y.all
        );

        const xExtent = d3.extent(
                this._data.filtered,
                (d) => d[this.config.x.name]
            ),
            yExtent = d3.extent(
                this._data.filtered,
                (d) => d[this.config.y.name]
            );

        this._scales.x.domain(xExtent);
        this._scales.y.domain([0, yExtent[1]]);
        this._scales.tooltip.domain(xExtent);
    }

    async loadData(dataConfig, dataLoadedCallback) {
        this._data.raw = await loadDataCsv(
            dataConfig.raw.url,
            dataConfig.raw.fields
        );

        this._data.filtered = [...this._data.raw];

        console.log('Load Annotations');
        this._data.annotations = await loadAnnotations(
            dataConfig.annotations.url
        );

        this.updateData();

        if (this._data.annotations[0] && this._data.annotations[0].values[0]) {
            this.$chartWrapper.attr(
                'aria-label',
                'Interactive chart. Press enter key to start. Summary Insight, ' +
                    this._data.annotations[0].values[0].note.label.join(' ')
            );
        }

        const zDomain: any[] = this.config.z
            ? this._data.all.x[this._data.all.x.length - 1].map((s) => s.series)
            : ['Series1'];

        this._scales.stroke.domain(zDomain);

        if (this.config.z) {
            this._data.filters = zDomain.map((z, i) => ({
                value: z,
                filtered: false,
                index: i,
            }));
        }

        console.log(this._data);

        dataLoadedCallback();
    }

    drawBaseMarks() {
        console.log('draw base marks called');

        let $lineSelect = this.$markG
            .selectAll('.line.base-mark')
            .data(this._data.series);

        let $lineEnter = $lineSelect
            .enter()
            .append('path')
            .attr('class', 'line base-mark');

        let $lineMerge = $lineSelect
            .merge($lineEnter)
            .style('stroke', (s) => this._scales.stroke(s.key))
            .datum((d) => d.raw)
            .attr('d', this._shapes.line);
        $lineSelect.exit().remove();
    }

    drawAxisGroupLayer() {
        let $xGroupContainerSelect = this.$markG
            .selectAll('.x-group-container')
            .data(this._data.all.x);

        let $xGroupContainerEnter = $xGroupContainerSelect
            .enter()
            .append('g')
            .attr(
                'class',
                (d) =>
                    'x-group-container value-' +
                    formatDateClass(d[0].values[0][this._config.x.name])
            );

        let $xGroupContainerMerge = $xGroupContainerSelect.merge(
            $xGroupContainerEnter
        );

        let $xGroupSelect = $xGroupContainerMerge
            .selectAll('.x-group')
            .data((d) => d);

        let $xGroupEnter = $xGroupSelect
            .enter()
            .append('g')
            .attr(
                'class',
                (d) =>
                    'x-group value-' +
                    formatDateClass(d.values[0][this._config.x.name]) +
                    ' series-' +
                    formatStringClass(
                        this.config.z
                            ? d.values[0][this.config.z.name]
                            : 'Series1'
                    )
            );

        let $xGroupMerge = $xGroupSelect.merge($xGroupEnter);

        let $lineXGroupSelect = $xGroupMerge
            .selectAll('.line')
            .data((d) => [d]);

        let $lineXGroupEnter = $lineXGroupSelect
            .enter()
            .append('path')
            .attr('class', 'line');

        let $lineXGroupMerge = $lineXGroupSelect
            .merge($lineXGroupEnter)
            .style('stroke', (d) => {
                return this._scales.stroke(
                    this.config.z ? d.values[0][this.config.z.name] : 'Series1'
                );
            })
            .datum((d) => d.values)
            .attr('d', this._shapes.line);

        let $thresholdXGroupSelect = $xGroupMerge
            .selectAll('.threshold')
            .data((d) => [d]);

        let $thresholdXGroupEnter = $thresholdXGroupSelect
            .enter()
            .append('path')
            .attr('class', 'threshold');

        let $thresholdXGroupMerge = $thresholdXGroupSelect
            .merge($thresholdXGroupEnter)
            .attr('d', (d) => {
                let y = this._scales.y(d['mean']);
                return (
                    'M' +
                    this._scales.x(d.values[0][this._config.x.name]) +
                    ',' +
                    y +
                    'L' +
                    this._scales.x(
                        d.values[d.values.length - 1][this._config.x.name]
                    ) +
                    ',' +
                    y
                );
            });

        let $bgXGroupSelect = $xGroupContainerMerge
            .selectAll('.bg')
            .data((d) => [d[0]]);

        let $bgXGroupEnter = $bgXGroupSelect
            .enter()
            .append('rect')
            .attr('class', 'bg');

        let $bgXGroupMerge = $bgXGroupSelect
            .merge($bgXGroupEnter)
            .attr('height', 36)
            .attr('width', 70)
            .attr('rx', 6)
            .attr('ry', 6)
            .attr('transform', (d) => {
                let y = this._scales.y.range()[0] + 2,
                    x =
                        this._scales.x(
                            d.values[Math.floor(d.values.length / 2)][
                                this._config.x.name
                            ]
                        ) - 35;
                return 'translate(' + [x, y] + ')';
            });

        let $labelXGroupSelect = $xGroupContainerMerge
            .selectAll('.x-group-label')
            .data((d) => [d[0]]);

        let $labelXGroupEnter = $labelXGroupSelect
            .enter()
            .append('text')
            .attr('class', 'x-group-label');

        let $labelXGroupMerge = $labelXGroupSelect
            .merge($labelXGroupEnter)
            .attr('transform', (d) => {
                let x = this._scales.x(
                    d.values[Math.floor(d.values.length / 2)][
                        this.config.x.name
                    ]
                );
                return 'translate(' + [x, this._scales.y.range()[0] + 12] + ')';
            })
            .attr('dy', '0.3em')
            .text((d) =>
                this.config.x.format_group[1](d.values[0][this.config.x.name])
            );

        let $yearXGroupSelect = $xGroupContainerMerge
            .selectAll('.year-label')
            .data((d) => [d[0]]);

        let $yearXGroupEnter = $yearXGroupSelect
            .enter()
            .append('text')
            .attr('class', 'year-label');

        let $yearXGroupMerge = $yearXGroupSelect
            .merge($yearXGroupEnter)
            .attr('transform', (d) => {
                let x = this._scales.x(
                    d.values[Math.floor(d.values.length / 2)][
                        this.config.x.name
                    ]
                );
                return 'translate(' + [x, this._scales.y.range()[0] + 22] + ')';
            })
            .attr('dy', '0.7em')
            .text((d) =>
                this.config.x.format_group[2](d.values[0][this.config.x.name])
            );

        // Y Groups
        let $yGroupContainerSelect = this.$markG
            .selectAll('.y-group-container')
            .data(this._data.all.y);

        let $yGroupContainerEnter = $yGroupContainerSelect
            .enter()
            .append('g')
            .attr('class', (d) => 'y-group-container value-' + d.key);

        let $yGroupContainerMerge = $yGroupContainerSelect.merge(
            $yGroupContainerEnter
        );

        let $yGroupSelect = $yGroupContainerMerge
            .selectAll('.y-group')
            .data((d) => d.values);

        let $yGroupEnter = $yGroupSelect
            .enter()
            .append('g')
            .attr('class', (d) => {
                return (
                    'y-group value-' +
                    formatDateClass(d.values[0][0][this.config.x.name]) +
                    '_' +
                    formatDateClass(
                        d.values[d.values.length - 1][0][this.config.x.name]
                    )
                );
            });

        let $yGroupMerge = $yGroupSelect.merge($yGroupEnter);

        let $lineYGroupSelect = $yGroupMerge.selectAll('.line').data((d, di) =>
            d.series.map((s, si) => ({
                key: s,
                index: si,
                group: di,
                values: d.values,
            }))
        );

        let $lineYGroupEnter = $lineYGroupSelect
            .enter()
            .append('path')
            .attr('class', 'line');

        let $lineYGroupMerge = $lineYGroupSelect
            .merge($lineYGroupEnter)
            .style('stroke', (s) => this._scales.stroke(s.key))
            .datum((s) => s.values.map((d) => d[s.index]))
            .attr('d', this._shapes.line);
    }

    drawAnnotationLayer() {
        const indexScale = d3
            .scaleLinear()
            .domain(this._scales.x.domain())
            .range([0, this._data.all.raw.length - 1]);

        const allAnnotations = [].concat.apply(
            [],
            this._data.annotations.map((at) => at.values)
        );

        let $annotSelect = this.$annotG
            .selectAll('.annotation')
            .data(allAnnotations);

        let $annotEnter = $annotSelect
            .enter()
            .append('g')
            .attr(
                'class',
                (d, i) => 'annotation ' + d.type + ' annotation-' + i
            );

        $annotEnter
            .append('g')
            .attr('class', 'annotation-connector')
            .append('path')
            .attr('class', 'connector');
        $annotEnter
            .append('g')
            .attr('class', 'annotation-subject')
            .append('path')
            .attr('class', 'subject');

        let $annotNoteEnter = $annotEnter
            .append('g')
            .attr('class', 'annotation-note');
        $annotNoteEnter.append('path').attr('class', 'note-line');

        let $annotContentEnter = $annotNoteEnter
            .append('g')
            .attr('class', 'annotation-note-content');
        $annotContentEnter.append('rect').attr('class', 'annotation-note-bg');
        $annotContentEnter
            .append('text')
            .attr('class', 'annotation-note-title')
            .append('tspan')
            .attr('x', 0)
            .attr('dy', '1.2em');
        $annotContentEnter
            .append('text')
            .attr('class', 'annotation-note-label')
            .attr('y', 16.5)
            .append('tspan')
            .attr('x', 0)
            .attr('dy', '1.2em');

        let $annotMerge = $annotSelect.merge($annotEnter);

        let $annotTitleSelect = $annotMerge
            .select('.annotation-note .annotation-note-title tspan')
            .selectAll('tspan')
            .data((d) => d.note.title);
        let $annotTitleEnter = $annotTitleSelect.enter().append('tspan');
        $annotTitleSelect
            .merge($annotTitleEnter)
            .attr('x', 0)
            .attr('dy', '1.2em')
            .text((d) => d);
        let $annotLabelSelect = $annotMerge
            .select('.annotation-note .annotation-note-label tspan')
            .selectAll('tspan')
            .data((d) => d.note.label);
        let $annotLabelEnter = $annotLabelSelect.enter().append('tspan');
        $annotLabelSelect
            .merge($annotLabelEnter)
            .attr('x', 0)
            .attr('dy', '1.2em')
            .text((d) => d);

        const raw = this._data.all.raw;
        const scales = this._scales;
        const config = this._config;

        // Compute all these parameters here
        $annotMerge.each(function (d, i) {
            let $annot = d3.select(this);
            d.index = i;
            // Get bbox of the note text
            d.note.bbox = getOuterBBox(
                $annot.select('.annotation-note-title').node(),
                $annot.select('.annotation-note-label').node()
            );
            d.note.align = 'dynamic';
            d.note.orientation = 'topBottom';
            d.note.offset = { x: d.dx, y: d.dy };
            d.note.padding = 5;

            d.target.dates = d.target.values.map((t) => parseDate(t));
            let iValues = d.target.dates.map((x) => Math.ceil(indexScale(x))),
                dValues = iValues.map((i) => raw[i][0]),
                rawSlice = raw.slice(iValues[0], iValues[1] + 1),
                seriesList = config.z ? d.target.series : ['Series'];
            d.target.data = config.z
                ? d.target.series.map((s) => {
                      const si = rawSlice[0]
                          .map((ss) => ss[config.z.name])
                          .indexOf(s);
                      return { series: s, values: rawSlice.map((d) => d[si]) };
                  })
                : [{ series: 'Series1', values: rawSlice.map((d) => d[0]) }];
            let yValues = d.target.data
                .map((s) => s.values)
                .flatMap((d) => scales.y(d[config.y.name]));
            let l = scales.x(dValues[0][config.x.name]),
                r = scales.x(dValues[1][config.x.name]),
                t = Math.min(...yValues),
                b = Math.max(...yValues);
            d.target.height = Math.max(b - t, 10);
            d.target.width = Math.max(r - l, 10);
            d.target.y = t;
            d.target.x = l;

            d.translate = [
                scales.x(dValues[1][config.x.name]),
                scales.y(
                    d3.median(
                        d.target.data.map((s) => s.values[s.values.length - 1]),
                        (d) => d[config.y.name]
                    )
                ),
            ];

            let { x, y } = alignment(d.note);
            d.note.dx = x;
            d.note.dy = y;

            let cd = elbowLine(d),
                nd = horizontalLine(d.note);
            d.connectorPath = 'M' + cd.join('L');

            d.subjectPath = '';
            d.note.notePath = 'M' + nd.join('L');
            d.note.width = d.note.bbox.width;
            d.note.height = d.note.bbox.height;
        });

        $annotMerge.attr('transform', (d) => 'translate(' + d.translate + ')');
        $annotMerge
            .select('.annotation-connector .connector')
            .attr('d', (d) => d.connectorPath);
        $annotMerge
            .select('.annotation-subject .subject')
            .attr('d', (d) => d.subjectPath);
        $annotMerge
            .select('.annotation-note')
            .attr('transform', (d) => 'translate(' + [d.dx, d.dy] + ')');
        $annotMerge
            .select('.annotation-note .note-line')
            .attr('d', (d) => d.note.notePath);
        $annotMerge
            .select('.annotation-note .annotation-note-content')
            .attr(
                'transform',
                (d) => 'translate(' + [d.note.dx, d.note.dy] + ')'
            );
        $annotMerge
            .select('.annotation-note .annotation-note-bg')
            .attr('width', (d) => d.note.width)
            .attr('height', (d) => d.note.height);

        // HIGHLIGHTED MARKS
        let $groupAnnotSelect = this.$markG
            .selectAll('.annotation-group')
            .data(allAnnotations);

        let $groupAnnotEnter = $groupAnnotSelect
            .enter()
            .append('g')
            .attr(
                'class',
                (d) =>
                    'annotation-group key-' + d.type + ' annotation-' + d.index
            );

        let $groupAnnotMerge = $groupAnnotSelect.merge($groupAnnotEnter);

        let $lineAnnotSelect = $groupAnnotMerge
            .selectAll('.line')
            .data((d) => d.target.data);

        let $lineAnnotEnter = $lineAnnotSelect
            .enter()
            .append('path')
            .style('stroke', (d) =>
                this._scales.stroke(
                    this.config.z ? d.values[0][this.config.z.name] : 'Series1'
                )
            )
            .attr('class', 'line');

        let $lineAnnotMerge = $lineAnnotSelect
            .merge($lineAnnotEnter)
            .datum((d) => d.values)
            .attr('d', this._shapes.line);
    }

    drawAxesLegends() {
        let $xLabelSelect = this.$axesG
            .selectAll('.axis-label.axis-label-x')
            .data([this.config.x.label_axis]);

        let $xLabelEnter = $xLabelSelect
            .enter()
            .append('text')
            .attr('class', 'axis-label axis-label-x');

        let $xLabelMerge = $xLabelSelect
            .merge($xLabelEnter)
            .attr(
                'transform',
                'translate(' +
                    [
                        this._scales.x.range()[1],
                        this._scales.y.range()[0] + 28,
                    ] +
                    ')'
            )
            .attr('dy', '0.7em')
            .style('text-anchor', 'end')
            .text((t) => t);

        let $xAxisSelect = this.$axesG
            .selectAll('.axis.axis-x')
            .data(['bottom']);

        let $xAxisEnter = $xAxisSelect
            .enter()
            .append('g')
            .attr('class', 'axis axis-x axis-temporal');

        let $xAxisMerge = $xAxisSelect
            .merge($xAxisEnter)
            .attr(
                'transform',
                'translate(' + [0, this._scales.y.range()[0]] + ')'
            )
            .call(this._axes.x)
            .call((g) => g.select('.domain').remove());

        let $yLabelSelect = this.$axesG
            .selectAll('.axis-label.axis-label-y')
            .data([this.config.y.label_axis]);

        let $yLabelEnter = $yLabelSelect
            .enter()
            .append('text')
            .attr('class', 'axis-label axis-label-y');

        let $yLabelMerge = $yLabelSelect
            .merge($yLabelEnter)
            .attr('transform', 'translate(' + [-46.5, -46] + ')')
            .attr('dy', '0.7em')
            .style('text-anchor', 'start')
            .text((t) => t);

        let $yAxisSelect = this.$axesG.selectAll('.axis.axis-y').data(['left']);

        let $yAxisEnter = $yAxisSelect
            .enter()
            .append('g')
            .attr('class', 'axis axis-y axis-quantitative');

        let $yAxisMerge = $yAxisSelect
            .merge($yAxisEnter)
            .attr('transform', 'translate(' + [-50, 0] + ')')
            .call(this._axes.y)
            .call((g) => {
                g.select('.domain').remove();
                g.selectAll('.tick text').attr('x', 4).attr('dy', -4);
            });

        const allAnnotations = [].concat.apply(
            [],
            this._data.annotations.map((at) => at.values)
        );

        let $aLabelSelect = this.$axesG
            .selectAll('.axis-label.axis-label-a')
            .data(['Data Insights']);

        let $aLabelEnter = $aLabelSelect
            .enter()
            .append('text')
            .attr('class', 'axis-label axis-label-a');

        let $aLabelMerge = $aLabelSelect
            .merge($aLabelEnter)
            .attr(
                'transform',
                'translate(' +
                    [
                        this._scales.x.range()[1] -
                            allAnnotations.length * 30 +
                            20,
                        -48,
                    ] +
                    ')'
            )
            .attr('dy', '0.7em')
            .style('text-anchor', 'start')
            .text((t) => t);

        // Draw a legend for series
        if (this.config.z) {
            let $aLabelSelect = this.$axesG
                .selectAll('.axis-label.axis-label-f')
                .data(['Series Filter']);

            let $aLabelEnter = $aLabelSelect
                .enter()
                .append('text')
                .attr('class', 'axis-label axis-label-f');

            let $aLabelMerge = $aLabelSelect
                .merge($aLabelEnter)
                .attr(
                    'transform',
                    'translate(' + [this._scales.x.range()[1] + 32, -48] + ')'
                )
                .attr('dy', '0.7em')
                .style('text-anchor', 'start')
                .text((t) => t);

            let $legendSelect = this.$axesG
                .selectAll('.legend.legend-z')
                .data(['right']);
            let $legendEnter = $legendSelect
                .enter()
                .append('g')
                .attr('class', 'legend legend-z')
                .attr(
                    'transform',
                    `translate(${[this._scales.x.range()[1] + 32, -28]})`
                );
            let $legendMerge = $legendSelect.merge($legendEnter);

            let $tickSelect = $legendMerge
                .selectAll('.legend-tick')
                .data(this._data.filters);

            let $tickEnter = $tickSelect.enter().append('g');

            let $tickMerge = $tickSelect
                .merge($tickEnter)
                .attr(
                    'class',
                    (f) =>
                        `legend-tick value-${formatStringClass(f.value)} ${
                            f.filtered ? 'filtered' : ''
                        }`
                )
                .attr('transform', (t, i) => `translate(${[0, i * 26]})`);

            $tickEnter
                .append('rect')
                .attr('class', 'legend-card')
                .attr('width', 10)
                .attr('height', 10)
                .attr('rx', 2)
                .attr('rx', 2);
            $tickMerge
                .selectAll('.legend-card')
                .style('stroke', (t) => this._scales.stroke(t.value))
                .style('fill', (t) => this._scales.stroke(t.value));
            $tickEnter
                .append('text')
                .attr('class', 'legend-value')
                .attr('x', 16)
                .attr('dy', '0.7em');
            $tickMerge
                .selectAll('.legend-value')
                .text((t) => this.config.z.map[t.value]);
        }
    }

    clearHighlightClassed() {
        this.$markG
            .selectAll(
                '.y-group.highlight,.y-group-container.highlight,.x-group-container.highlight,.annotation-group.highlight'
            )
            .classed('highlight', false);
        this.$annotG
            .selectAll('.annotation.highlight')
            .classed('highlight', false);
        this.$ariaG
            .selectAll('.annotation-ghost.highlight')
            .classed('highlight', false);
        this.$markG.selectAll('.base-mark').classed('fade', false);
    }

    hideTooltips() {
        this.$tooltips.y.container.style('visibility', 'hidden');
        this.$tooltips.x.container.style('visibility', 'hidden');
        this.$tooltips.raw.container.style('visibility', 'hidden');
        this.$dataTip.style('visibility', 'hidden');
    }

    fadeBaseMarks() {
        this.$markG.selectAll('.base-mark').classed('fade', true);
    }

    ghostSeriesLayer() {
        // TODO how to describe where you are in the chart based on the current data point
        // Navigate to other insights? Have it describe at a local level, mid level, global level
        // Describe where you are physically in the chart

        let $yGhostSelect = this.$ariaG
            .selectAll('.y-ghost')
            .data(this._data.all.y);

        let $yGhostEnter = $yGhostSelect
            .enter()
            .append('g')
            .attr('class', (d: any) => 'y-ghost value-' + d.key)
            .attr('aria-hidden', 'false')
            .attr('tabindex', '-1');

        $yGhostEnter
            .append('rect')
            .attr(
                'height',
                this._scales.y(0) - this._scales.y(this.config.y.interval)
            )
            .attr('width', 60)
            .attr('transform', (d: any) => {
                return 'translate(-60,' + this._scales.y(d.range[1]) + ')';
            });

        let $yGhostMerge = $yGhostSelect
            .merge($yGhostEnter)
            .attr('aria-label', (d: any, i: number) => {
                console.log(d);
                return (
                    this.config.y.format_long(d.range[0]) +
                    ' to ' +
                    this.config.y.format_long(d.range[1]) +
                    ' ' +
                    this.config.y.label_group +
                    ' bin contains ' +
                    (this.config.z
                        ? d.all.length +
                          ' out of ' +
                          this._data.series.length +
                          ' series. ' +
                          d.all
                              .map(
                                  (s) =>
                                      this.config.z.map[s.series] +
                                      ' for ' +
                                      // percent
                                      formatPercent(
                                          // TODO update percent for length of each series
                                          s.count / this._data.all.raw.length
                                      )
                              )
                              .join(', ')
                        : d.all
                              .map((s) =>
                                  formatPercent(
                                      s.count / this._data.all.raw.length
                                  )
                              )
                              .join(', ')) +
                    ' of ' +
                    this._data.all.raw.length +
                    ' ' +
                    this.config.x.period +
                    's. ' +
                    (i + 1) +
                    ' of ' +
                    this._data.all.y.length +
                    ' bins.'
                );
            })
            .on('focus', (event, d) => {
                // TODO need to update visuals when focused
                this.clearHighlightClassed();
                this.hideTooltips();
                this.fadeBaseMarks();

                let classYGroup = '.y-group-container.value-' + d.key;
                let $yGroup = this.$markG.selectAll(classYGroup);
                $yGroup.classed('highlight', true);
                $yGroup.selectAll('.y-group').classed('highlight', true);

                let posY = this._scales.y((d.range[0] + d.range[1]) / 2);

                this.$tooltips.y.base.style(
                    'transform',
                    'translate(0px, ' +
                        ((1 - posY / this._scales.y.range()[0]) * 80 + 10) +
                        '%)'
                );
                this.$tooltips.y.container
                    .style('visibility', 'visible')
                    .style('left', this.margin.l + 'px')
                    .style('top', posY + this.margin.t + 'px');
                this.$tooltips.y.label.text(
                    this.config.y.format_short(d.range[0]) +
                        ' to ' +
                        this.config.y.format_short(d.range[1]) +
                        ' ' +
                        this.config.y.label_group
                );
                let $seriesDivSelect = this.$tooltips.y.series
                    .selectAll('div')
                    .data([...d.all].reverse()); // Reverse so in descending order
                let $seriesDivEnter = $seriesDivSelect.enter().append('div');
                $seriesDivEnter
                    .append('span')
                    .attr('class', 'tooltip-series-legend');
                $seriesDivEnter
                    .append('span')
                    .attr('class', 'tooltip-series-label');
                $seriesDivEnter
                    .append('span')
                    .attr('class', 'tooltip-series-value');
                $seriesDivSelect.exit().remove();
                let $seriesDivMerge = $seriesDivSelect.merge($seriesDivEnter);
                $seriesDivMerge
                    .select('.tooltip-series-legend')
                    .style('background', (dd) =>
                        this._scales.stroke(dd.series)
                    );
                $seriesDivMerge
                    .select('.tooltip-series-label')
                    .text((dd) =>
                        this.config.z ? this.config.z.map[dd.series] : 'Series1'
                    );
                $seriesDivMerge
                    .select('.tooltip-series-value')
                    .text((dd) =>
                        formatPercent(dd.count / this._data.all.raw.length)
                    );
            });
        // .on('mouseover', function (event, d) {
        //     this.focus();
        // });

        // Create combine consecutive time elements

        let $yGhostCombineSelect = $yGhostMerge
            .selectAll('.y-ghost-combine')
            .data((d, i) => d.values.map((dd) => ({ ...dd, key: d.key })));

        let $yGhostCombineEnter = $yGhostCombineSelect
            .enter()
            .append('g')
            .attr('aria-hidden', 'false')
            .attr('tabindex', '-1')
            .attr(
                'class',
                (d: any) =>
                    'y-ghost-combine value-' +
                    formatDateClass(d.values[0][0][this.config.x.name]) +
                    '_' +
                    formatDateClass(
                        d.values[d.values.length - 1][0][this.config.x.name]
                    )
            );

        let $yGhostCombineMerge = $yGhostCombineSelect
            .merge($yGhostCombineEnter)
            .attr('aria-label', (d: any, i: number, array: any[]) => {
                return (
                    createDateAriaForStartEnd(
                        d.values[0][0][this.config.x.name],
                        d.values[d.values.length - 1][0][this.config.x.name],
                        this.config.x
                    ) +
                    '. ' +
                    (this.config.z ? d.series.length + ' series. ' : '') +
                    'For ' +
                    d.values.length +
                    ' consecutive ' +
                    this.config.x.period +
                    's ' +
                    (this.config.z
                        ? d.series.map((s) => this.config.z.map[s]).join(', ') +
                          ' are within '
                        : 'values are within ') +
                    d.range
                        .map((r) => this.config.y.format_long(r))
                        .join(' to ') +
                    ' bin. ' +
                    (i + 1) +
                    ' of ' +
                    array.length +
                    ' time spans.'
                );
            })
            .on('focus', (event, d, i) => {
                this.clearHighlightClassed();
                this.hideTooltips();
                this.fadeBaseMarks();

                let classYContainer = '.y-group-container.value-' + d.key;
                let $yContainer = this.$markG.selectAll(classYContainer);
                $yContainer.classed('highlight', true);
                let classYGroup =
                    '.y-group.value-' +
                    formatDateClass(d.values[0][0][this.config.x.name]) +
                    '_' +
                    formatDateClass(
                        d.values[d.values.length - 1][0][this.config.x.name]
                    );
                $yContainer.selectAll(classYGroup).classed('highlight', true);
            });

        // Navigating down a level supports navigating between consecutive days for that series

        // Going up jumps to next series, should announce if no other series for that date?

        let $xGhostSelect = this.$ariaG
            .selectAll('.x-ghost')
            .data(this._data.all.x);

        let $xGhostEnter = $xGhostSelect
            .enter()
            .append('g')
            .attr(
                'class',
                (d: any) =>
                    'x-ghost value-' + formatDateClass(new Date(d[0].key))
            )
            .attr('aria-hidden', 'false')
            .attr('tabindex', '-1');

        $xGhostEnter
            .append('rect')
            .attr('height', 60)
            .attr(
                'width',
                (d: any) =>
                    this._scales.x(
                        d[0].values[d[0].values.length - 1][this.config.x.name]
                    ) - this._scales.x(d[0].values[0][this.config.x.name])
            )
            .attr(
                'transform',
                (d) =>
                    'translate(' +
                    [
                        this._scales.x(d[0].values[0][this.config.x.name]),
                        this._scales.y.range()[0],
                    ] +
                    ')'
            );

        let $xGhostMerge = $xGhostSelect
            .merge($xGhostEnter)
            .attr('aria-label', (d: any, i: number, array: any[]) => {
                return (
                    this.config.x.format_group[0](
                        d[0].values[0][this.config.x.name]
                    ) +
                    ' ' +
                    this.config.x.label_group +
                    (this.config.z
                        ? 's are ' +
                          d
                              .map(
                                  (s) =>
                                      this.config.z.map[s.series] +
                                      ' at ' +
                                      this.config.y.format_long(s['mean'])
                              )
                              .join(', ')
                        : ' is ' +
                          d
                              .map((s) => this.config.y.format_long(s['mean']))
                              .join(', ')) +
                    '. ' +
                    (i + 1) +
                    ' of ' +
                    array.length +
                    ' bins.'
                );
            })
            .on('focus', (event, d) => {
                this.clearHighlightClassed();
                this.hideTooltips();
                this.fadeBaseMarks();

                let classXGroup =
                    '.x-group-container.value-' +
                    formatDateClass(d[0].values[0][this.config.x.name]);
                let $xGroup = this.$markG.selectAll(classXGroup);
                $xGroup.classed('highlight', true);

                let pos = [
                    this._scales.x(d[0].values[0][this.config.x.name]),
                    this._scales.y(d[d.length - 1].mean),
                ];

                this.$tooltips.x.base.style(
                    'transform',
                    'translate(0px, ' +
                        ((1 - pos[1] / this._scales.y.range()[0]) * 80 + 10) +
                        '%)'
                );
                this.$tooltips.x.container
                    .style('visibility', 'visible')
                    .style('left', pos[0] + this.margin.l + 'px')
                    .style('top', pos[1] + this.margin.t + 'px');
                this.$tooltips.x.label.text(
                    this.config.x.format_group[1](
                        d[0].values[0][this.config.x.name]
                    )
                );
                let $seriesDivSelect = this.$tooltips.x.series
                    .selectAll('div')
                    .data([...d].reverse()); // Reverse so in descending order
                let $seriesDivEnter = $seriesDivSelect.enter().append('div');
                $seriesDivEnter
                    .append('span')
                    .attr('class', 'tooltip-series-legend');
                $seriesDivEnter
                    .append('span')
                    .attr('class', 'tooltip-series-label');

                $seriesDivEnter
                    .append('span')
                    .attr('class', 'tooltip-series-value');
                $seriesDivSelect.exit().remove();
                let $seriesDivMerge = $seriesDivSelect.merge($seriesDivEnter);
                $seriesDivMerge
                    .select('.tooltip-series-legend')
                    .style('background', (dd) =>
                        this._scales.stroke(dd.series)
                    );
                $seriesDivMerge
                    .select('.tooltip-series-label')
                    .text((dd) =>
                        this.config.z ? this.config.z.map[dd.series] : 'Series1'
                    );
                $seriesDivMerge
                    .select('.tooltip-series-value')
                    .text((dd) => this.config.y.format_long(dd.mean));
            });
        // .on('mouseover', function (event, d) {
        //     this.focus();
        // });

        const barWidth = this._scales.x.range()[1] / this._data.all.raw.length;

        let $barSelect = this.$ariaG
            .selectAll('.bar')
            .data(this._data.filtered);

        let $barEnter = $barSelect
            .enter()
            .append('rect')
            .attr('aria-hidden', 'false')
            .attr('tabindex', '-1');

        // Change first and last day of month aria-label
        let $barMerge = $barSelect
            .merge($barEnter)
            .attr(
                'class',
                (d: any) =>
                    'bar value-' +
                    formatDateClass(d[this.config.x.name]) +
                    ' series-' +
                    formatStringClass(
                        this.config.z ? d[this.config.z.name] : 'Series1'
                    )
            )
            .attr('width', barWidth)
            .attr('height', (d: any) => this._scales.y.range()[0])
            .attr('y', 0)
            .attr(
                'x',
                (d: any) =>
                    this._scales.x(d[this._config.x.name]) - barWidth / 2
            )
            .attr('aria-label', (d) => {
                // TODO change data description based on what the user has heard
                return (
                    this.config.y.format_long(d[this._config.y.name]) +
                    ' ' +
                    this.config.y.label_group +
                    ', ' +
                    this.config.x.format_short(d[this._config.x.name]) +
                    (this.config.z
                        ? ', ' +
                          this.config.z.map[d[this.config.z.name]] +
                          ' series.'
                        : '.')
                );
            })
            .on('focus', (event, d) => {
                this.hideTooltips();
                this.highlightPoint(d);
            });
        // .on('mouseover', function (event, d) {
        //     this.focus();
        // });
        let $compareSelect = this.$ariaG
            .selectAll('.compare-ghost')
            .data(this._data.all.raw);

        let $compareEnter = $compareSelect
            .enter()
            .append('g')
            .attr(
                'class',
                (d: any) =>
                    'compare-ghost value-' +
                    formatDateClass(d[0][this.config.x.name])
            )
            .attr('aria-hidden', 'false')
            .attr('tabindex', '-1');

        // Change first and last day of month aria-label
        let $compareMerge = $compareSelect
            .merge($compareEnter)
            .attr('aria-label', (d) => {
                console.log(d);
                return (
                    (this.config.z
                        ? d
                              .map(
                                  (dd) =>
                                      this.config.y.format_long(
                                          dd[this.config.y.name]
                                      ) +
                                      ', ' +
                                      this.config.z.map[
                                          dd[this.config.z.name]
                                      ] +
                                      '.'
                              )
                              .join(' ')
                        : this.config.y.format_long(d[0][this.config.y.name]) +
                          ' ' +
                          this.config.y.label_group) +
                    ' ' +
                    this.config.x.format_short(d[0][this._config.x.name]) +
                    '.'
                );
            })
            .on('focus', (event, d) => {
                this.clearHighlightClassed();
                this.hideTooltips();
                this.fadeBaseMarks();
                this.highlightPoints(d);
            });

        if (this.config.z) {
            let $filterSelect = this.$ariaG
                .selectAll('.filter-ghost')
                .data(this._data.filters);

            let $filterEnter = $filterSelect
                .enter()
                .append('g')
                .attr(
                    'class',
                    (d: any) =>
                        'filter-ghost value-' + formatStringClass(d.value)
                )
                .attr('aria-hidden', 'false')
                .attr('role', 'checkbox')
                .attr('tabindex', '-1');

            $filterEnter
                .append('rect')
                .attr('class', 'bg-ghost-container')
                .attr('x', this._scales.x.range()[1] + 28)
                .attr('y', (f, i) => i * 26 - 36)
                .attr('height', 28)
                .attr('width', 140)
                .style('pointer-events', 'all');

            // Change first and last day of month aria-label
            let $filterMerge = $filterSelect
                .merge($filterEnter)
                .attr('aria-label', (f) => this.config.z.map[f.value])
                .attr('aria-checked', (f) => !f.filtered)
                .on('click', (event, f) => {
                    this.hideTooltips();
                    console.log(f);
                    this.filterData();
                });
        }
    }

    ghostAnnotionLayer() {
        const allAnnotations = [].concat.apply(
            [],
            this._data.annotations.map((at) => at.values)
        );

        let $annotContainer = this.$ariaG.select('.annotation-ghost-container');

        let $annotGroupGhostSelect = $annotContainer
            .selectAll('.annotation-group-ghost')
            .data(this._data.annotations);

        let $annotGroupGhostEnter = $annotGroupGhostSelect
            .enter()
            .append('g')
            .attr('class', (d) => 'annotation-group-ghost key-' + d.key)
            .attr('aria-hidden', 'false')
            .attr('tabindex', '-1');

        let $annotGroupGhostMerge = $annotGroupGhostSelect
            .merge($annotGroupGhostEnter)
            .attr('aria-label', (at) => {
                return (
                    at.key + ' data insights. ' + at.values.length + ' total.'
                );
            })
            .on('focus', (event, d) => {
                this.clearHighlightClassed();
                this.hideTooltips();
            });

        let $annotGhostSelect = $annotGroupGhostMerge
            .selectAll('.annotation-ghost')
            .data((at) => at.values);

        let $annotGhostEnter = $annotGhostSelect
            .enter()
            .append('g')
            .attr(
                'class',
                (d) =>
                    'annotation-ghost annotation-' + d.index + ' key-' + d.type
            )
            .attr('aria-hidden', 'false')
            .attr('tabindex', '-1')
            .attr(
                'transform',
                (d) =>
                    'translate(' +
                    [
                        this._scales.x.range()[1] -
                            (allAnnotations.length - d.index - 1) * 30,
                        -20,
                    ] +
                    ')'
            );

        $annotGhostEnter.append('circle').attr('r', 10);

        $annotGhostEnter
            .append('text')
            .style('text-anchor', 'middle')
            .attr('dy', '0.3em')
            .text((d) => d.index + 1);

        $annotGhostEnter
            .append('rect')
            .attr('width', 30)
            .attr('height', 30)
            .attr('x', -15)
            .attr('y', -15);

        let $annotGhostMerge = $annotGhostSelect
            .merge($annotGhostEnter)
            .attr('aria-label', (d, i, array) => {
                return (
                    d.note.title.join(' ') +
                    '. ' +
                    d.note.label.join(' ') + // Already a period in label
                    (i + 1) +
                    ' of ' +
                    array.length +
                    ' ' +
                    d.type +
                    '.'
                );
            })
            .on('focus', (event, d) => {
                this.clearHighlightClassed();
                this.hideTooltips();
                this.fadeBaseMarks();

                this.$ariaG
                    .selectAll('.annotation-ghost.annotation-' + d.index)
                    .classed('highlight', true);
                this.$markG
                    .selectAll('.annotation-group.annotation-' + d.index)
                    .classed('highlight', true);
                this.$annotG
                    .selectAll('.annotation.annotation-' + d.index)
                    .classed('highlight', true);
            });
        // .on('mouseover', function (event, d) {
        //     this.focus();
        // });
    }

    drawContainers() {
        this.$ariaG
            .select('.x-ghost-container')
            .attr(
                'aria-label',
                'X axis from ' +
                    this.config.x.format_group[0](this._scales.x.domain()[0]) +
                    ' to ' +
                    this.config.x.format_group[0](this._scales.x.domain()[1]) +
                    '. This component displays binned data points by ' +
                    this.config.x.interval +
                    ' as ' +
                    this.config.x.label_group +
                    '. There are ' +
                    this._data.all.x.length +
                    ' total ' +
                    this.config.x.interval +
                    ' bins, each with ' +
                    this._data.series.length +
                    ' data series.'
            );
        const interval = this.config.y.interval ? this.config.y.interval : 1;
        this.$ariaG
            .select('.y-ghost-container')
            .attr(
                'aria-label',
                'Y axis displaying ' +
                    this.config.x.label_axis +
                    ', from ' +
                    this.config.y.format_long(
                        Math.floor(this._scales.y.domain()[0] / +interval) *
                            +interval
                    ) +
                    ' to ' +
                    this.config.y.format_long(
                        Math.floor(this._scales.y.domain()[1] / +interval) *
                            +interval
                    ) +
                    '. This component displays data points binned by increments of ' +
                    this.config.y.format_long(this.config.y.interval) +
                    ' ' +
                    this.config.y.label_group +
                    ' as consecutive ' +
                    this.config.x.period +
                    's. There are ' +
                    this._data.all.y.length +
                    ' total bins, each with ' +
                    this._data.series.length +
                    ' data series.'
            );
        this.$ariaG
            .select('.bar-ghost-container')
            .attr(
                'aria-label',
                'Data points displaying ' +
                    this.config.y.label_axis +
                    ' per ' +
                    this.config.x.period +
                    '. There are ' +
                    this._data.series.length +
                    ' data series, each with ' +
                    this._data.all.raw.length +
                    ' data points.'
            );
    }

    drawChart() {
        this.drawBaseMarks();
        this.drawAxisGroupLayer();
        this.drawAnnotationLayer();
        this.drawAxesLegends();
        this.drawContainers();

        this.ghostSeriesLayer();
        this.ghostAnnotionLayer();
    }

    initChart() {
        const allAnnotations = [].concat.apply(
            [],
            this._data.annotations.map((at) => at.values)
        );

        let $annotContainer = this.$ariaG
            .append('g')
            .attr('class', 'annotation-ghost-container')
            .attr(
                'aria-label',
                'Data Insights. There are ' +
                    allAnnotations.length +
                    ' total data insights: ' +
                    this._data.annotations
                        .map((at) => at.values.length + ' ' + at.key)
                        .join(', ') +
                    '.'
            )
            .attr('aria-hidden', 'false')
            .attr('tabindex', '-1')
            .on('focus', function (event, d) {
                console.log('Annotation has focus!!');
            });

        let $xGhostContainer = this.$ariaG
            .append('g')
            .attr('class', 'x-ghost-container')
            .attr('aria-hidden', 'false')
            .attr('tabindex', '-1')
            .on('focus', (d) => {
                this.hideTooltips();
                this.clearHighlightClassed();
                console.log('X axis has focus!!');
            });
        $xGhostContainer
            .append('rect')
            .attr('class', 'bg-ghost-container')
            .attr('transform', `translate(${[0, this._scales.y.range()[0]]})`)
            .attr('width', this._scales.x.range()[1])
            .attr('height', 60);

        let $yGhostContainer = this.$ariaG
            .append('g')
            .attr('class', 'y-ghost-container')
            .attr('aria-hidden', 'false')
            .attr('tabindex', '-1')
            .on('focus', (d) => {
                this.hideTooltips();
                this.clearHighlightClassed();
                console.log('Y axis has focus!!');
            });
        $yGhostContainer
            .append('rect')
            .attr('class', 'bg-ghost-container')
            .attr('transform', `translate(${[-70, 0]})`)
            .attr('height', this._scales.y.range()[0])
            .attr('width', 70);

        let $barGhostContainer = this.$ariaG
            .append('g')
            .attr('class', 'bar-ghost-container')
            .attr('aria-hidden', 'false')
            .attr('tabindex', '-1')
            .on('focus', (d) => {
                console.log('Bar has focus!!');
                this.hideTooltips();
                this.clearHighlightClassed();
            });
        $barGhostContainer
            .append('rect')
            .attr('class', 'bg-ghost-container')
            .attr('width', this._scales.x.range()[1])
            .attr('height', this._scales.y.range()[0]);

        let $compareGhostContainer = this.$ariaG
            .append('g')
            .attr('class', 'compare-ghost-container')
            .attr(
                'aria-label',
                'Compare data between series with spatial audio.'
            )
            .attr('aria-hidden', 'false')
            .attr('tabindex', '-1')
            .on('focus', (d) => {
                console.log('Compare has focus!!');
                this.hideTooltips();
                this.clearHighlightClassed();
            });
        $compareGhostContainer
            .append('rect')
            .attr('class', 'bg-ghost-container')
            .attr('width', this._scales.x.range()[1])
            .attr('height', this._scales.y.range()[0]);
        if (this.config.z) {
            let $filterGhostContainer = this.$ariaG
                .append('g')
                .attr('class', 'filter-ghost-container')
                .attr(
                    'aria-label',
                    'Filter series from the chart. There are ' +
                        this._data.series.length +
                        ' series. '
                )
                .attr('aria-hidden', 'false')
                .attr('tabindex', '-1')
                .on('focus', (d) => {
                    console.log('Filter has focus!!');
                    this.hideTooltips();
                    this.clearHighlightClassed();
                });
            $filterGhostContainer
                .append('rect')
                .attr('class', 'bg-ghost-container')
                .attr('x', this._scales.x.range()[1] + 32)
                .attr('y', -48)
                .attr('width', 140)
                .attr('height', this._data.series.length * 26);
        }
    }

    initSonifier() {
        this._sonifier.updateDomain(
            d3.extent(this._data.filtered, (d) => d[this.config.y.name])
        );
    }

    onResize() {
        const rect = this.$chartWrapper.node().getBoundingClientRect();
        this._dimensions.height = rect.height;
        this._dimensions.width = rect.width;
    }
}

const parseDate = d3.timeParse('%Y-%m-%d'),
    formatDateClass = d3.timeFormat('%b-%d-%y'),
    formatPercent = d3.format(',.1%'),
    formatStringClass = (value: string) => {
        return value.replace(/[^a-z0-9]/g, function (s) {
            var c = s.charCodeAt(0);
            if (c == 32) return '-';
            if (c >= 65 && c <= 90) return '_' + s.toLowerCase();
            return '__' + ('000' + c.toString(16)).slice(-4);
        });
    };
// formatDate = d3.timeFormat('%b %-d, %Y'),
// formatDateLong = d3.timeFormat('%B %-d, %Y'),
// formatDateShort = d3.timeFormat('%b %-d'),
// formatDateMonth = d3.timeFormat('%B %Y'),
// formatDateMonthOnly = d3.timeFormat('%B'),
// formatValue = d3.format(',d');

export { LineChart };
