import * as d3 from 'd3';

import { getOuterBBox, alignment, elbowLine, horizontalLine } from './annot';
import {
    computeAll,
    computeSubstrateData,
    joinArrayWithCommasAnd,
    loadAnnotations,
    loadDataCsv,
    updateConfigWithFormats,
} from './util';
import { Sonifier } from './sonify';
import { ChartConfig, DimensionConfig, DataConfig, MarginConfig } from './core';
import { NavigationController } from './navigation-controller';
import { thresholdFreedmanDiaconis } from 'd3';

class BarChart {
    private _data: any;
    private _dimensions: any;
    private _config: ChartConfig;
    private _scales: { x: any; y: any; fill: any; tooltip: any };
    private _axes: { x: any; y: any };
    private _shapes: { area: any; line: any };
    private _legends: any;

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
            x: d3.scaleBand().padding(0.2),
            y: d3.scaleLinear(),
            tooltip: d3.scaleBand().padding(0.2),
            fill: d3.scaleOrdinal(d3.schemeCategory10),
        };
        this._axes = {
            x: d3.axisBottom(this._scales.x),
            y: d3.axisRight(this._scales.y),
        };
        this._legends = { fill: undefined };

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
            .attr('tabindex', '0')
            .attr('role', 'application')
            .attr('aria-label', 'Interactive chart. Press enter key to start.')
            .style('height', '100%')
            .style('width', '100%');

        this.$chartAfter = this.$container.append('div');

        // TODO needs to be a modal div
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
            .attr('class', 'tooltip-container tooltip-x')
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
        this.$tooltips.x.value = this.$tooltips.x.inner
            .append('span')
            .attr('class', 'tooltip-value');

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

        // TODO format x axis
        this._axes.x.tickSizeOuter(0);
        this._axes.y
            .tickSize(this._scales.x.range()[1] + 60)
            .tickFormat(this.config.y.format_short);
    }

    createDescriptions() {
        this.$chartBefore
            .attr('class', 'chart-sr-desc-container chart-sr-before')
            .attr('tabindex', 0)
            .attr('aria-hidden', 'false');
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
                'Bar chart with ' +
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
            .attr('aria-hidden', 'false');
        let $afterWrapper = this.$chartAfter
            .append('div')
            .attr('class', 'chart-sr-desc-wrapper')
            .attr('aria-hidden', 'false');
        let $afterContent = $afterWrapper
            .append('div')
            .attr('class', 'chart-sr-desc-content chart-sr-desc-exit')
            .attr('tabindex', 0)
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
            this.highlightPoint(d);
        };
        this._sonifier = new Sonifier(onPlayData);
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
                '.annotation-group-ghost.key-' + formatStringClass(d.key),
        };

        let binXNode = {
            type: 'data-sonify-values',
            level: 2,
            id: 7,
            selected: 0,
            getData: (data: any, valueAtLevels: any[]) =>
                data.all.x.map((d) => [d[0].values]),
            getClass: (d: any, valueAtLevels: any[], config: ChartConfig) => {
                return (
                    '.x-ghost.value-' +
                    formatStringClass(d[0][0][config.x.name])
                );
            },
        };

        let binYNode = {
            type: 'data-no-sonify',
            sonify: 'count',
            level: 2,
            id: 8,
            selected: 0,
            getData: (data: any, valueAtLevels: any[]) => data.all.y,
            getClass: (d: any, valueAtLevels: any[], config: ChartConfig) => {
                console.log(d);
                return '.y-ghost.value-' + d[0].key;
            },
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
            type: 'series_normal',
            jump: 'enabled',
            level: 3,
            id: 10,
            selected: 0,
            series: 0,
            getData: (data: any, valueAtLevels: any[]) => valueAtLevels[2],
            getClass: (d: any, valueAtLevels: any[], config: ChartConfig) => {
                console.log(d);
                console.log(valueAtLevels);
                return (
                    '.bar.value-' +
                    formatStringClass(d[config.x.name]) +
                    '.series-' +
                    formatStringClass(config.z ? d[config.z.name] : 'Series1')
                );
            },
        };

        let binYCombineNode = {
            type: 'data-no-sonify',
            jump: 'disabled',
            level: 3,
            id: 15,
            selected: 0,
            getData: (data: any, valueAtLevels: any[]) =>
                valueAtLevels[2][0].layout_sum,
            getClass: (d: any, valueAtLevels: any[], config: ChartConfig) => {
                return (
                    '.y-ghost.value-' +
                    valueAtLevels[2][0].key +
                    ' .y-ghost-combine.x-value-' +
                    formatStringClass(d.key) +
                    '.z-value-' +
                    formatStringClass(config.z ? d.label : 'Series1')
                );
            },
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
                formatStringClass(d[config.x.name]) +
                '.series-' +
                (config.z ? formatStringClass(d[config.z.name]) : 'Series1'),
        };

        let binYBarNode = {
            type: 'series_normal',
            jump: 'enabled',
            level: 3,
            id: 13,
            selected: 0,
            series: 0,
            getData: (data: any, valueAtLevels: any[]) => [
                valueAtLevels[3].values,
            ],
            getClass: (d: any, valueAtLevels: any[], config: ChartConfig) => {
                return (
                    '.bar.value-' +
                    formatStringClass(d[config.x.name]) +
                    '.series-' +
                    (config.z ? formatStringClass(d[config.z.name]) : 'Series1')
                );
            },
        };

        let rawBarNode = {
            type: 'series_normal',
            level: 2,
            id: 14,
            selected: 0,
            series: 0,
            getData: (data: any, valueAtLevels: any[]) => data.all.raw,
            getClass: (d: any, valueAtLevels: any[], config: ChartConfig) => {
                console.log(d);
                return (
                    '.bar.value-' +
                    formatStringClass(d[config.x.name]) +
                    '.series-' +
                    (config.z ? formatStringClass(d[config.z.name]) : 'Series1')
                );
            },
        };

        let compareXNode = {
            type: 'data-sonify-values',
            level: 2,
            id: 17,
            selected: 0,
            getData: (data: any, valueAtLevels: any[]) =>
                data.all.x.map((d) => [d[0].values]),
            getClass: (d: any, valueAtLevels: any[], config: ChartConfig) => {
                return (
                    '.x-ghost.value-' +
                    formatStringClass(d[0][0][config.x.name])
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
            getData: (data: any, valueAtLevels: any[]) => valueAtLevels[2],
            getClass: (d: any, valueAtLevels: any[], config: ChartConfig) => {
                return (
                    '.bar.value-' +
                    formatStringClass(d[config.x.name]) +
                    '.series-' +
                    formatStringClass(config.z ? d[config.z.name] : 'Series1')
                );
            },
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

        tree.set(binYCombineNode.id, {
            children: [binYBarNode.id],
            parent: binYNode.id,
            element: binYCombineNode,
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

    highlightPoint(d: any) {
        this.fadeBaseMarks();
        this.unfadeBaseMarks([d]);
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
                this._scales.x(d[this.config.x.name]) +
                    this._scales.x.bandwidth() / 2 +
                    this.margin.l +
                    'px'
            )
            .style(
                'top',
                this._scales.y(d['layout'][1]) + this.margin.t + 'px'
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
                .style('background', this._scales.fill(d[this.config.z.name]));
        }
    }

    drawBaseMarks() {
        console.log('draw base marks called');

        let $barSelect = this.$markG
            .selectAll('.column.base-mark')
            .data(this._data.all.raw.flat());

        let $barEnter = $barSelect.enter().append('rect');

        let $barMerge = $barSelect
            .merge($barEnter)
            .attr('x', (d: any) => this._scales.x(d[this.config.x.name]))
            .attr('y', (d: any) => this._scales.y(d.layout[1]))
            .attr(
                'height',
                (d: any) =>
                    this._scales.y(d.layout[0]) - this._scales.y(d.layout[1])
            )
            .attr('width', this._scales.x.bandwidth())
            .style('fill', (d) =>
                this._scales.fill(
                    this.config.z ? d[this.config.z.name] : 'Series1'
                )
            )
            .attr(
                'class',
                (d) =>
                    `column base-mark x-value-${
                        d[this.config.x.name]
                    } z-value-${
                        this.config.z
                            ? formatStringClass(d[this.config.z.name])
                            : 'Series1'
                    }`
            );

        $barSelect.exit().remove();
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
                (d) => 'x-group-container value-' + formatStringClass(d[0].key)
            );
        let $xGroupContainerMerge = $xGroupContainerSelect
            .merge($xGroupContainerEnter)
            .attr('transform', (d) => {
                let y = this._scales.y.range()[0] + 2,
                    x = this._scales.x(d[0].key);
                return 'translate(' + [x, y] + ')';
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
            .attr('ry', 6);
        let $labelXGroupSelect = $xGroupContainerMerge
            .selectAll('.x-group-label')
            .data((d) => [d[0]]);
        let $labelXGroupEnter = $labelXGroupSelect
            .enter()
            .append('text')
            .attr('class', 'x-group-label');
        let $labelXGroupMerge = $labelXGroupSelect
            .merge($labelXGroupEnter)
            .attr(
                'transform',
                (d: any) =>
                    'translate(' + [this._scales.x.bandwidth() / 2, 12] + ')'
            )
            .attr('dy', '0.3em')
            .text((d: any) => this.config.x.format_long(d.key));
        // Y Groups
        const interval: number = this.config.y.interval
            ? +this.config.y.interval
            : 1;
        let $yGroupContainerSelect = this.$markG
            .selectAll('.y-group')
            .data(this._data.all.y);
        let $yGroupContainerEnter = $yGroupContainerSelect
            .enter()
            .append('g')
            .attr('class', (d) => 'y-group value-' + d[0].key);
        let $yGroupContainerMerge = $yGroupContainerSelect.merge(
            $yGroupContainerEnter
        );

        let $thresholdYGroupSelect = $yGroupContainerMerge
            .selectAll('.threshold')
            .data((d: any) => [d[0].key * interval, (d[0].key + 1) * interval]);

        let $thresholdYGroupEnter = $thresholdYGroupSelect
            .enter()
            .append('path')
            .attr('class', (d, i) => 'threshold threshold-' + i);

        let $thresholdYGroupMerge = $thresholdYGroupSelect
            .merge($thresholdYGroupEnter)
            .attr('d', (d) => {
                let y = this._scales.y(d);
                return (
                    'M' +
                    (this._scales.x.range()[0] - 50) +
                    ',' +
                    y +
                    'L' +
                    (this._scales.x.range()[1] + 10) +
                    ',' +
                    y
                );
            });

        let $bgYGroupSelect = $yGroupContainerMerge
            .selectAll('.bg')
            .data((d: any) => [d[0].key * interval, (d[0].key + 1) * interval]);

        let $bgYGroupEnter = $bgYGroupSelect
            .enter()
            .append('rect')
            .attr('height', 14)
            .attr('width', 50)
            .attr('class', (d, i) => 'bg bg-' + i);

        let $bgYGroupMerge = $bgYGroupSelect
            .merge($bgYGroupEnter)
            .attr(
                'transform',
                (d) => 'translate(' + [-50, this._scales.y(d) - 16] + ')'
            );

        let $tickYGroupSelect = $yGroupContainerMerge
            .selectAll('.tick')
            .data((d) => [d[0].key * interval, (d[0].key + 1) * interval]);

        let $tickYGroupEnter = $tickYGroupSelect
            .enter()
            .append('text')
            .attr('class', 'tick');

        let $tickYGroupMerge = $tickYGroupSelect
            .merge($tickYGroupEnter)
            .attr(
                'transform',
                (d) => 'translate(' + [-46, this._scales.y(d) - 4] + ')'
            )
            .text((d) => this.config.y.format_short(d));
    }

    drawAnnotationLayer() {
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

            let seriesList = config.z ? d.target.series : ['Series'],
                iValues = d.target.values.map((x) =>
                    scales.x.domain().indexOf(x)
                ),
                rawValues = iValues.map((i) => raw[i]);
            d.target.data = config.z
                ? d.target.series.map((s) => {
                      const si = rawValues[0]
                          .map((ss) => ss[config.z.name])
                          .indexOf(s);
                      return { series: s, values: rawValues.map((d) => d[si]) };
                  })
                : [{ series: 'Series1', values: rawValues.map((d) => d[0]) }];
            let yValues = rawValues.flat().map((d) => scales.y(d['layout'][1]));
            let xValues = rawValues
                .flat()
                .map((d) => scales.x(d[config.x.name]));
            let l = Math.min(...xValues),
                r = Math.max(...xValues),
                t = Math.min(...yValues),
                b = Math.max(...yValues);
            d.target.height = Math.max(b - t, 10);
            d.target.width = Math.max(r - l, 10);
            d.target.y = t;
            d.target.x = l;

            d.translate = [r + scales.x.bandwidth(), b];

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
                    'annotation-group key-' +
                    formatStringClass(d.type) +
                    ' annotation-' +
                    d.index
            );
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
                .style('stroke', (t) => this._scales.fill(t.value))
                .style('fill', (t) => this._scales.fill(t.value));
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
                '.y-group.highlight,.x-group-container.highlight,.annotation-group.highlight'
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

    ghostSeriesLayer() {
        // TODO how to describe where you are in the chart based on the current data point
        // Navigate to other insights? Have it describe at a local level, mid level, global level
        // Describe where you are physically in the chart
        const interval: number = this.config.y.interval
            ? +this.config.y.interval
            : 1;
        let $yGhostSelect = this.$ariaG
            .selectAll('.y-ghost')
            .data(this._data.all.y);

        let $yGhostEnter = $yGhostSelect
            .enter()
            .append('g')
            .attr('class', (d: any) => 'y-ghost value-' + d[0].key)
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
                return (
                    'translate(-60,' +
                    this._scales.y((d[0].key + 1) * interval) +
                    ')'
                );
            });

        let $yGhostMerge = $yGhostSelect
            .merge($yGhostEnter)
            .attr('aria-label', (d: any, i: number) => {
                return (
                    this.config.y.format_long(d[0].key * interval) +
                    ' to ' +
                    this.config.y.format_long((d[0].key + 1) * interval) +
                    ' ' +
                    this.config.y.label_group +
                    ' bin contains ' +
                    (this.config.z
                        ? d[0].layout_sum.length +
                          ' stacked bars. ' +
                          [
                              ...d3
                                  .rollup(
                                      d[0].layout_sum,
                                      (v) => v,
                                      (ls) => ls.label
                                  )
                                  .values(),
                          ]
                              .map(
                                  (v: any) =>
                                      v[0].description +
                                      ' for ' +
                                      joinArrayWithCommasAnd(
                                          v.map((d) =>
                                              this.config.x.format_long(d.key)
                                          )
                                      )
                              )
                              .join('. ')
                        : d[0].values.length +
                          ' stacked data points: ' +
                          d[0].values
                              .map((dd) =>
                                  this.config.x.format_long(
                                      dd[this.config.x.name]
                                  )
                              )
                              .join(', ')) +
                    '. ' +
                    (i + 1) +
                    ' of ' +
                    this._data.all.y.length +
                    ' bins.'
                );
            })
            .on('focus', (event, d) => {
                this.clearHighlightClassed();
                this.hideTooltips();
                this.fadeBaseMarks();

                this.unfadeBaseMarks(
                    d[0].layout_sum.flatMap((ls) => ls.values)
                );

                this.$markG
                    .selectAll('.y-group.value-' + d[0].key)
                    .classed('highlight', true);

                let posY = this._scales.y((d[0].key + 0.5) * interval);

                this.$tooltips.y.base.style(
                    'transform',
                    'translate(0px, ' +
                        ((1 - posY / this._scales.y.range()[0]) * 70 + 10) +
                        '%)'
                );
                this.$tooltips.y.container
                    .style('visibility', 'visible')
                    .style('left', this.margin.l + 'px')
                    .style('top', posY + this.margin.t + 'px');
                this.$tooltips.y.label.text(
                    this.config.y.format_short(d[0].key * interval) +
                        ' to ' +
                        this.config.y.format_short((d[0].key + 1) * interval) +
                        ' ' +
                        this.config.y.label_group
                );
                let rollup = [
                    ...d3
                        .rollup(
                            d[0].layout_sum,
                            (v) => v,
                            (ls) => ls.label
                        )
                        .values(),
                ].reverse();
                let $seriesDivSelect = this.$tooltips.y.series
                    .selectAll('div')
                    .data(rollup);
                let $seriesDivEnter = $seriesDivSelect.enter().append('div');
                $seriesDivEnter
                    .append('span')
                    .attr('class', 'tooltip-series-legend-container');
                $seriesDivEnter
                    .append('span')
                    .attr('class', 'tooltip-series-label');
                $seriesDivEnter
                    .append('span')
                    .attr('class', 'tooltip-series-value');
                $seriesDivSelect.exit().remove();
                let $seriesDivMerge = $seriesDivSelect.merge($seriesDivEnter);

                let $legendDivSelect = $seriesDivMerge
                    .select('.tooltip-series-legend-container')
                    .selectAll('.tooltip-series-legend')
                    .data((v: any) =>
                        this.config.z ? v[0].series : ['Series1']
                    );
                let $legendDivEnter = $legendDivSelect
                    .enter()
                    .append('span')
                    .attr('class', 'tooltip-series-legend');
                let $legendDivMerge = $legendDivSelect
                    .merge($legendDivEnter)
                    .style('background', (s: string) => this._scales.fill(s));
                $legendDivSelect.exit().remove();
                $seriesDivMerge
                    .select('.tooltip-series-label')
                    .text((v: any) =>
                        this.config.z ? v[0].label : 'Series 1'
                    );
                $seriesDivMerge
                    .select('.tooltip-series-value')
                    .text((v: any) =>
                        v
                            .map((dd: any) =>
                                this.config.x.format_abbrev(dd.key)
                            )
                            .join(', ')
                    );
            })
            // .on('mouseover', function (event, d) {
            //     this.focus();
            // });

        let $yGhostCombineSelect = $yGhostMerge
            .selectAll('.y-ghost-combine')
            .data((d: any) => d[0].layout_sum);

        let $yGhostCombineEnter = $yGhostCombineSelect
            .enter()
            .append('g')
            .attr('aria-hidden', 'false')
            .attr('tabindex', '-1')
            .attr(
                'class',
                (d: any) =>
                    'y-ghost-combine x-value-' +
                    formatStringClass(d.key) +
                    ' z-value-' +
                    formatStringClass(this.config.z ? d.label : 'Series1')
            );

        let $yGhostCombineMerge = $yGhostCombineSelect
            .merge($yGhostCombineEnter)
            .attr('aria-label', (d: any, i: number, array: any[]) => {
                let lastValue = d.values[d.values.length - 1];
                return (
                    this.config.y.format_long(lastValue['layout'][1]) +
                    ' ' +
                    this.config.y.label_group +
                    '. ' +
                    (this.config.z ? d.description + ' for ' : '') +
                    this.config.x.format_long(d.key) +
                    '. ' +
                    (i + 1) +
                    ' of ' +
                    array.length +
                    ' stacks.'
                );
            })
            .on('focus', (event, d, i) => {
                this.clearHighlightClassed();
                this.hideTooltips();
                this.fadeBaseMarks();
                this.unfadeBaseMarks(d.values);

                this.$markG
                    .selectAll('.y-group.value-' + d.key)
                    .classed('highlight', true);

                let lastValue = d.values[d.values.length - 1];

                let pos = [
                    this._scales.x(d.key) + this._scales.x.bandwidth() / 2,
                    this._scales.y(lastValue['layout'][1]),
                ];

                this.$tooltips.x.base.style(
                    'transform',
                    'translate(' + this._scales.tooltip(d.key) + '%, 0px)'
                );
                this.$tooltips.x.container
                    .style('visibility', 'visible')
                    .style('left', pos[0] + this.margin.l + 'px')
                    .style('top', pos[1] + this.margin.t + 'px');
                this.$tooltips.x.label.text(this.config.x.format_long(d.key));
                this.$tooltips.x.value.text(
                    this.config.x.label_tooltip +
                        this.config.y.format_long(lastValue['layout'][1])
                );
            });

        let $xGhostSelect = this.$ariaG
            .selectAll('.x-ghost')
            .data(this._data.all.x);

        let $xGhostEnter = $xGhostSelect
            .enter()
            .append('g')
            .attr(
                'class',
                (d: any) => 'x-ghost value-' + formatStringClass(d[0].key)
            )
            .attr('aria-hidden', 'false')
            .attr('tabindex', '-1');

        $xGhostEnter
            .append('rect')
            .attr('height', 60)
            .attr('width', this._scales.x.bandwidth())
            .attr(
                'transform',
                (d: any) =>
                    'translate(' +
                    [
                        this._scales.x(d[0].values[0][this.config.x.name]),
                        this._scales.y.range()[0],
                    ] +
                    ')'
            );

        // TODO would get rid of this if just one series
        let $xGhostMerge = $xGhostSelect
            .merge($xGhostEnter)
            .attr('aria-label', (d: any, i: number, array: any[]) => {
                return (
                    this.config.x.format_short(
                        d[0].values[0][this.config.x.name]
                    ) +
                    ' ' +
                    this.config.x.label_group +
                    (this.config.z
                        ? ' are ' + this.config.y.format_long(d[0]['sum'])
                        : ' are ' + this.config.y.format_long(d[0]['sum'])) +
                    '. ' +
                    (i + 1) +
                    ' of ' +
                    array.length +
                    ' ' +
                    this.config.x.label_axis +
                    's.'
                );
            })
            .on('focus', (event, d) => {
                this.clearHighlightClassed();
                this.hideTooltips();
                this.fadeBaseMarks();

                this.unfadeBaseMarks(d[0].values);

                this.$markG
                    .selectAll(
                        '.x-group-container.value-' +
                            formatStringClass(d[0].key)
                    )
                    .classed('highlight', true);

                let pos = [
                    this._scales.x(d[0].key) + this._scales.x.bandwidth() / 2,
                    this._scales.y(d[0]['sum']),
                ];

                this.$tooltips.x.base.style(
                    'transform',
                    'translate(' + this._scales.tooltip(d[0].key) + '%, 0px)'
                );
                this.$tooltips.x.container
                    .style('visibility', 'visible')
                    .style('left', pos[0] + this.margin.l + 'px')
                    .style('top', pos[1] + this.margin.t + 'px');
                this.$tooltips.x.label.text(
                    this.config.x.format_long(d[0].key)
                );
                this.$tooltips.x.value.text(
                    this.config.x.label_tooltip +
                        this.config.y.format_long(d[0]['sum'])
                );
            })
            // .on('mouseover', function (event, d) {
            //     this.focus();
            // });

        let $barSelect = this.$ariaG
            .selectAll('.bar')
            .data(this._data.all.raw.flat());

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
                    formatStringClass(d[this.config.x.name]) +
                    ' series-' +
                    formatStringClass(
                        this.config.z ? d[this.config.z.name] : 'Series1'
                    )
            )
            .attr('width', this._scales.x.bandwidth())
            .attr('height', (d: any) => this._scales.y.range()[0])
            .attr('y', 0)
            .attr('x', (d: any) => this._scales.x(d[this.config.x.name]))
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
            })
            // .on('mouseover', function (event, d) {
            //     this.focus();
            // });

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
            .attr(
                'class',
                (d) => 'annotation-group-ghost key-' + formatStringClass(d.key)
            )
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

                this.unfadeBaseMarks(d.target.data.flatMap((d) => d.values));

                this.$ariaG
                    .selectAll('.annotation-ghost.annotation-' + d.index)
                    .classed('highlight', true);
                this.$markG
                    .selectAll('.annotation-group.annotation-' + d.index)
                    .classed('highlight', true);
                this.$annotG
                    .selectAll('.annotation.annotation-' + d.index)
                    .classed('highlight', true);
            })
            // .on('mouseover', function (event, d) {
            //     this.focus();
            // });
    }

    drawContainers() {
        this.$ariaG
            .select('.x-ghost-container')
            .attr(
                'aria-label',
                'X axis. This component displays stacked bars of ' +
                    this.config.x.label_group +
                    ' per ' +
                    this.config.x.label_axis +
                    '. There are ' +
                    this._data.all.x.length +
                    ' total ' +
                    this.config.x.label_axis +
                    ' categories, each with ' +
                    this._data.series.length +
                    ' data series.'
            );
        const interval: number = this.config.y.interval
            ? +this.config.y.interval
            : 1;
        this.$ariaG
            .select('.y-ghost-container')
            .attr(
                'aria-label',
                'Y axis displaying ' +
                    this.config.y.label_axis +
                    ', from ' +
                    this.config.y.format_long(
                        Math.floor(this._scales.y.domain()[0] / interval) *
                            interval
                    ) +
                    ' to ' +
                    this.config.y.format_long(
                        Math.ceil(this._scales.y.domain()[1] / interval) *
                            interval
                    ) +
                    '. This component displays stacked bars binned by increments of ' +
                    this.config.y.format_long(interval) +
                    ' ' +
                    this.config.y.label_group +
                    '. There are ' +
                    this._data.all.y.length +
                    ' total bins.'
            );
        this.$ariaG
            .select('.bar-ghost-container')
            .attr(
                'aria-label',
                'Data points displaying ' +
                    this.config.y.label_axis +
                    ' per ' +
                    this.config.x.label_axis +
                    '. There are ' +
                    this._data.series.length +
                    ' ' +
                    this.config.z.label_axis +
                    ' series.'
            );
        this.$ariaG
            .select('.compare-ghost-container')
            .attr(
                'aria-label',
                'Compare data between series with spatial audio. There are ' +
                    this._data.series.length +
                    ' ' +
                    this.config.z.label_axis +
                    ' series.'
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

    hideTooltips() {
        this.$tooltips.y.container.style('visibility', 'hidden');
        this.$tooltips.x.container.style('visibility', 'hidden');
        this.$tooltips.raw.container.style('visibility', 'hidden');
    }

    fadeBaseMarks() {
        this.$markG.selectAll('.base-mark').classed('fade', true);
    }

    unfadeBaseMarks(values: any[]) {
        let selector = values
            .map(
                (d) =>
                    `.base-mark.x-value-${d[this.config.x.name]}.z-value-${
                        this.config.z
                            ? formatStringClass(d[this.config.z.name])
                            : 'Series1'
                    }`
            )
            .join(',');
        this.$markG.selectAll(selector).classed('fade', false);
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

        const layoutMap = new Map<string, number[]>();

        this._data.filtered
            // Need to sort by z domain before applying layout
            .sort((a: any, b: any) => {
                if (this.config.z) {
                    return (
                        zDomain.indexOf(a[this.config.z.name]) -
                        zDomain.indexOf(b[this.config.z.name])
                    );
                } else {
                    return 0;
                }
            })
            .forEach((d: any) => {
                // TODO bring in the z config layout
                // TODO need to come up with a way to sort based on x or z config
                if (!layoutMap.has(d[this.config.x.name])) {
                    layoutMap.set(d[this.config.x.name], [0, 0]);
                }
                let layout = layoutMap.get(d[this.config.x.name]);
                if (layout) {
                    layout[0] = layout[1];
                    layout[1] += d[this.config.y.name];
                    d['layout'] = [...layout];
                    layoutMap.set(d[this.config.x.name], layout);
                }
            });

        this._data.series = [
            ...d3
                .rollup(
                    this._data.filtered,
                    (v) => {
                        let key = this.config.z
                            ? v[0][this.config.z.name]
                            : 'Series1';
                        return { key, raw: v };
                    },
                    (d) => (this.config.z ? d[this.config.z.name] : 'Series1')
                )
                .values(),
        ];

        this._data.all = {
            x: computeSubstrateData(
                this.config.x,
                this.config.y,
                this.config.z,
                zDomain,
                this._data.filtered
            ).map((s) => [s]),
            y: computeSubstrateData(
                this.config.y,
                this.config.x,
                this.config.z,
                zDomain,
                this._data.filtered
            ).map((s) => [s]),
            raw: computeAll(this._data.series, 'raw', this.config.x),
        };

        const xExtent = d3.map(
            this._data.filtered,
            (d) => d[this.config.x.name]
        );
        const yMax = d3.max(this._data.all.raw.flat(), (d) => d['layout'][1]);

        if (this.config.y.interval) {
            this._axes.y.tickValues(
                d3.range(
                    0,
                    (Math.ceil(yMax / +this.config.y.interval) + 1) *
                        +this.config.y.interval,
                    +this.config.y.interval
                )
            );
        } else {
            this._axes.y.ticks(6);
        }
        this._axes.x.tickValues(xExtent);

        this._scales.x.domain(xExtent);
        this._scales.y.domain([0, yMax]);
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
            ? this._data.series.map((s) => s.key)
            : ['Series1'];

        this._scales.fill.domain(zDomain);

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
}

const formatStringClass = (value: string) => {
    return value.replace(/[^a-z0-9]/g, function (s) {
        var c = s.charCodeAt(0);
        if (c == 32) return '-';
        if (c >= 65 && c <= 90) return '_' + s.toLowerCase();
        return '__' + ('000' + c.toString(16)).slice(-4);
    });
};

export { BarChart };
