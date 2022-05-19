import * as d3 from 'd3';

import { getOuterBBox, alignment, elbowLine, horizontalLine } from './annot';
import { loadAnnotations, loadDataCsv } from './util';
import { Sonifier } from './sonify';

class Chart {
    constructor(
        containerSelector,
        config = {
            x: '',
            y: '',
        },
        dimensions = {
            width: 100,
            height: 100,
            margin: { r: 0, l: 0, b: 0, t: 0 },
        },
        dataConfig
    ) {
        this._data = {};
        this.$container = d3.select(containerSelector);
        this._containerId = containerSelector;
        this._dimensions = dimensions;
        this._config = config;
        this._scales = {};
        this._axes = {};
        this._shapes = {};
        this._legends = {};
        updateConfigWithFormats(this._config.x);
        updateConfigWithFormats(this._config.y);
        console.log(this._config);
        this.createElements();
        this.createScalesAxes();
        this.createNavigation();
        this.createSonification();
        this.createDescriptions();
        this.loadData(dataConfig, () => {
            this.drawChart();
        });
    }

    get width() {
        return this._dimensions.width;
    }

    get height() {
        return this._dimensions.height;
    }

    get margin() {
        return this._dimensions.margin;
    }

    get config() {
        return this._config;
    }

    createElements() {
        this.$chartWrapper = this.$container
            .append('div')
            .attr('class', 'chart-wrapper')
            .attr('aria-hidden', 'false')
            .attr('dir', 'ltr')
            .attr('tabindex', '0')
            .attr('role', 'application')
            .attr('aria-label', 'Need aria label here')
            .style('height', '100%')
            .style('width', '100%');

        this.$chartBefore = this.$container
            .append('div')
            .attr('class', 'chart-before');

        this.$chartAfter = this.$container
            .append('div')
            .attr('class', 'chart-after');

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
        this.$ghostG = this.$chart
            .append('g')
            .attr('aria-hidden', 'false')
            .attr('role', 'region');

        this.$dataTip = this.$hoverG
            .append('g')
            .attr('class', 'data-tip')
            .attr('transform', 'translate(0,0)')
            .style('visibility', 'hidden');
        this.$dataTip.append('path');
        this.$dataTip.append('circle').attr('r', 4);

        this.$tooltipContainer = this.$container
            .append('div')
            .attr('class', 'tooltip-container')
            .attr('aria-hidden', 'true')
            .style('visibility', 'hidden');
        this.$tooltip = this.$tooltipContainer
            .append('div')
            .attr('class', 'tooltip');
        const $tooltipInner = this.$tooltip
            .append('div')
            .attr('class', 'tooltip-inner');
        this.$tooltipDate = $tooltipInner
            .append('span')
            .attr('class', 'tooltip-date');
        this.$tooltipValue = $tooltipInner
            .append('span')
            .attr('class', 'tooltip-value');

        this.$style = this.$chart.append('style').html(`
                ${this._containerId} .line {
                    stroke: ${this.config.color.primary};
                }
                ${this._containerId} .line.fade {
                    stroke: ${this.config.color.primaryfade}
                }
                ${this._containerId} .area {
                    fill: ${this.config.color.secondary};
                }
                ${this._containerId} .area.fade {
                    fill: ${this.config.color.secondaryfade}
                }
                ${this._containerId} .data-tip circle {
                    fill: ${this.config.color.primary};
                }
                `);
    }

    createScalesAxes() {
        this._scales.x = d3
            .scaleTime()
            .range([0, this.width - this.margin.l - this.margin.r]);
        this._scales.y = d3
            .scaleLinear()
            .range([this.height - this.margin.t - this.margin.b, 0]);
        this._scales.tooltip = d3.scaleTime().range([-10, -90]);

        this._axes.x = d3
            .axisBottom(this._scales.x)
            .ticks(d3['time' + this.config.x.interval]);
        this._axes.y = d3
            .axisRight(this._scales.y)
            .ticks(6)
            .tickSize(this._scales.x.range()[1] + 60)
            .tickFormat(this.config.y.format_short);

        this._shapes.line = d3
            .line()
            .defined((d) => !isNaN(d[this.config.y.name]))
            .x((d) => this._scales.x(d[this.config.x.name]))
            .y((d) => this._scales.y(d[this.config.y.name]));
        this._shapes.area = d3
            .area()
            .defined((d) => !isNaN(d[this.config.y.name]))
            .x((d) => this._scales.x(d[this.config.x.name]))
            .y1((d) => this._scales.y(d[this.config.y.name]))
            .y0(this._scales.y(0));
    }

    createDescriptions() {
        this.$chartBefore
            .attr('class', 'chart-sr-desc-container')
            .attr('aria-hidden', 'false');
        let $beforeWrapper = this.$chartBefore
            .append('div')
            .attr('class', 'chart-sr-desc-wrapper')
            .attr('aria-hidden', 'false');
        let $beforeContent = $beforeWrapper
            .append('div')
            .attr('class', 'chart-sr-desc-content chart-sr-desc-start')
            .attr('tabindex', 0)
            .attr('aria-hidden', false)
            .text('End of interactive chart');

        // <div
        //     id='highcharts-screen-reader-region-before-0'
        //     aria-hidden='false'
        //     style='position: relative;'
        // >
        //     <div
        //         aria-hidden='false'
        //         style='position: absolute; width: 1px; height: 1px; overflow: hidden; white-space: nowrap; clip: rect(1px, 1px, 1px, 1px); margin-top: -3px; opacity: 0.01;'
        //     >
        //         <p>Most common desktop screen readers</p>
        //         <div>Line chart with 6 lines.</div>
        //         <div>
        //             Source: WebAIM. Click on points to visit official screen
        //             reader website
        //         </div>
        //         <div>
        //             Line chart demonstrating some accessibility features of
        //             Highcharts. The chart displays the most commonly used screen
        //             readers in surveys taken by WebAIM from December 2010 to
        //             September 2019. JAWS was the most used screen reader until
        //             2019, when NVDA took over. VoiceOver is the third most used
        //             screen reader, followed by Narrator. ZoomText/Fusion had a
        //             surge in 2015, but usage is otherwise low. The overall use
        //             of other screen readers has declined drastically the past
        //             few years.
        //         </div>
        //         <div>
        //             <button
        //                 id='hc-linkto-highcharts-data-table-0'
        //                 tabindex='-1'
        //                 aria-expanded='false'
        //             >
        //                 View as data table, Most common desktop screen readers
        //             </button>
        //         </div>
        //         <div>
        //             The chart has 1 X axis displaying Time from December 2010 to
        //             September 2019.{' '}
        //         </div>
        //         <div>
        //             The chart has 1 Y axis displaying Percentage usage. Data
        //             ranges from 5.3 to 72.4.
        //         </div>
        //     </div>
        // </div>;
        this.$chartAfter
            .attr('class', 'chart-sr-desc-container')
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
    }

    createNavigation() {
        this._navGroups = [
            { type: 'a', index: 0, currIndex: [0, 0] },
            { type: 'x', index: 1, currIndex: [0, 0] },
            { type: 'y', index: 2, currIndex: [0, 0] },
        ];
        this._navigateBy = '';
        this._currGroup = this._navGroups[0];

        const clampLoop = (i, length) => {
            return i >= length ? 0 : i < 0 ? length - 1 : i;
        };

        this.$chartWrapper.on('keydown', (event) => {
            console.log(event);
            switch (event.keyCode) {
                // Arrow Right & Arrow Up
                case 39:
                case 38:
                    if (this._navigateBy.startsWith('d')) {
                        this._currGroup.currIndex[1]++;
                    } else if (this._navigateBy === 'g') {
                        this._currGroup =
                            this._navGroups[
                                clampLoop(
                                    this._currGroup.index + 1,
                                    this._navGroups.length
                                )
                            ];
                    } else {
                        this._currGroup.currIndex[0]++;
                    }
                    break;
                // Arrow Left & Arrow Down
                case 37:
                case 40:
                    if (this._navigateBy.startsWith('d')) {
                        this._currGroup.currIndex[1]--;
                    } else if (this._navigateBy === 'g') {
                        this._currGroup =
                            this._navGroups[
                                clampLoop(
                                    this._currGroup.index - 1,
                                    this._navGroups.length
                                )
                            ];
                    } else {
                        this._currGroup.currIndex[0]--;
                    }
                    break;
                // Enter
                case 13:
                    if (event.shiftKey) {
                        this._sonifier.togglePlay();
                    } else {
                        if (this._navigateBy.startsWith('d')) {
                        } else if (this._navigateBy === 'g') {
                            this._navigateBy = this._currGroup.type;
                        } else if (this._navigateBy === '') {
                            this._navigateBy = 'g';
                        } else {
                            this._navigateBy = 'd' + this._currGroup.type;
                            this._currGroup.currIndex[1] = 0;
                        }
                    }

                    break;
                // Esc
                case 27:
                    if (this._navigateBy.startsWith('d')) {
                        this._navigateBy = this._currGroup.type;
                        this._currGroup.currIndex[1] = -1;
                    } else if (this._navigateBy === 'g') {
                        this._navigateBy = '';
                    } else if (this._navigateBy === '') {
                    } else {
                        this._navigateBy = 'g';
                    }
                    if (this._sonifier.isPlaying) this._sonifier.togglePlay();
                    break;
            }

            if (
                (event.keyCode >= 37 && event.keyCode <= 40) ||
                event.keyCode === 13 ||
                event.keyCode === 27
            ) {
                event.preventDefault();
                let nav = this._navigateBy.startsWith('d')
                    ? this._navigateBy.slice(1)
                    : this._navigateBy;

                if (this._navigateBy === '') {
                    this.$chartWrapper.node().focus();
                } else if (this._navigateBy === 'g') {
                    this._currGroup.node.focus();

                    this.clearHighlightClassed();
                    this.$dataTip.style('visibility', 'hidden');
                    this.$tooltipContainer.style('visibility', 'hidden');
                } else {
                    let { currIndex, dataTable } = this._currGroup;

                    currIndex[0] = clampLoop(currIndex[0], dataTable.length);
                    let value = dataTable[currIndex[0]];
                    let selectClass = this._currGroup.getClass(
                        value,
                        currIndex[0]
                    );

                    if (this._navigateBy.startsWith('d')) {
                        let subTable = this._currGroup.getSubTable(value);

                        // When at the end or beginning - jump to the next grouping
                        if (
                            currIndex[1] < 0 ||
                            currIndex[1] >= subTable.length
                        ) {
                            currIndex[0] =
                                currIndex[1] < 0
                                    ? currIndex[0] - 1
                                    : currIndex[0] + 1;
                            currIndex[0] = clampLoop(
                                currIndex[0],
                                dataTable.length
                            );

                            value = dataTable[currIndex[0]];
                            selectClass = currGroup.getClass(
                                value,
                                currIndex[0]
                            );
                            subTable = this._currGroup.getSubTable(value);

                            let extraFocus = this.$ghostG
                                .select(selectClass)
                                .node();
                            if (extraFocus) {
                                extraFocus.focus();
                            }
                            currIndex[1] =
                                currIndex[1] < 0 ? subTable.length - 1 : 0;
                        }

                        let subValue = subTable[currIndex[1]];
                        selectClass =
                            '.bar.value-' +
                            formatDateClass(subValue[this.config.x.name]);
                    }
                    let toFocus = this.$ghostG.select(selectClass).node();

                    if (toFocus) {
                        toFocus.focus();
                    }
                }
            }
        });
    }

    createSonification() {
        const onPlayData = (d, i) => {
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

            this.$tooltip.style(
                'transform',
                'translate(' +
                    this._scales.tooltip(d[this._config.x.name]) +
                    '%, 0px)'
            );
            this.$tooltipContainer
                .style('visibility', 'visible')
                .style(
                    'left',
                    this._scales.x(d[this.config.x.name]) + this.margin.l + 'px'
                )
                .style(
                    'top',
                    this._scales.y(d[this.config.y.name]) + this.margin.t + 'px'
                );
            this.$tooltipDate.text(
                this.config.x.format_long(d[this.config.x.name])
            );
            this.$tooltipValue.text(
                this.config.y.label_tooltip +
                    this.config.y.format_long(d[this.config.y.name])
            );
        };
        this._sonifier = new Sonifier(onPlayData);
    }

    async loadData(dataConfig, dataLoadedCallback) {
        this._data.raw = await loadDataCsv(
            dataConfig.raw.url,
            dataConfig.raw.fields,
            dataConfig.raw.filters
        );

        this._data.annotations = await loadAnnotations(
            dataConfig.annotations.url
        );

        this._data.x = computeSubstrateData(
            this.config.x,
            this.config.y,
            this._data.raw
        );
        this._data.y = computeSubstrateData(
            this.config.y,
            this.config.x,
            this._data.raw
        );

        const xExtent = d3.extent(this._data.raw, (d) => d[this.config.x.name]),
            yExtent = d3.extent(this._data.raw, (d) => d[this.config.y.name]);

        this._scales.x.domain(xExtent);
        this._scales.y.domain([0, yExtent[1]]);
        this._scales.tooltip.domain(xExtent);

        console.log(this._data);

        dataLoadedCallback();
    }

    drawBaseMarks() {
        let $areaSelect = this.$markG
            .selectAll('.area.base-mark.field-' + this._config.y.name)
            .data([this._data.raw]);

        let $areaEnter = $areaSelect
            .enter()
            .append('path')
            .attr('class', 'area base-mark field-' + this._config.y.name);

        let $areaMerge = $areaSelect
            .merge($areaEnter)
            .datum((d) => d)
            .attr('d', this._shapes.area);

        let $lineSelect = this.$markG
            .selectAll('.line.base-mark.field-' + this._config.y.name)
            .data([this._data.raw]);

        let $lineEnter = $lineSelect
            .enter()
            .append('path')
            .attr('class', 'line base-mark field-' + this._config.y.name);

        let $lineMerge = $lineSelect
            .merge($lineEnter)
            .datum((d) => d)
            .attr('d', this._shapes.line);
    }

    drawAxisGroupLayer() {
        let $xGroupSelect = this.$markG
            .selectAll('.x-group.field-' + this._config.x.name)
            .data(this._data.x);

        let $xGroupEnter = $xGroupSelect
            .enter()
            .append('g')
            .attr(
                'class',
                (d) =>
                    'x-group value-' +
                    formatDateClass(d.values[0][this._config.x.name]) +
                    ' field-' +
                    this._config.x.name
            );

        let $xGroupMerge = $xGroupSelect.merge($xGroupEnter);

        let $areaXGroupSelect = $xGroupMerge
            .selectAll('.area.field-' + this._config.x.name)
            .data((d) => [d]);

        let $areaXGroupEnter = $areaXGroupSelect
            .enter()
            .append('path')
            .attr('class', 'area field-' + this._config.x.name);

        let $areaXGroupMonth = $areaXGroupSelect
            .merge($areaXGroupEnter)
            .datum((d) => d.values)
            .attr('d', this._shapes.area);

        let $lineXGroupSelect = $xGroupMerge
            .selectAll('.line.field-' + this._config.x.name)
            .data((d) => [d]);

        let $lineXGroupEnter = $lineXGroupSelect
            .enter()
            .append('path')
            .attr('class', 'line field-' + this._config.x.name);

        let $lineXGroupMerge = $lineXGroupSelect
            .merge($lineXGroupEnter)
            .datum((d) => d.values)
            .attr('d', this._shapes.line);

        let $thresholdXGroupSelect = $xGroupMerge
            .selectAll('.threshold.field-' + this._config.x.name)
            .data((d) => [d, d]);

        let $thresholdXGroupEnter = $thresholdXGroupSelect
            .enter()
            .append('path')
            .attr(
                'class',
                (d, i) =>
                    'threshold field-' + this._config.x.name + ' threshold-' + i
            );

        let $thresholdXGroupMerge = $thresholdXGroupSelect
            .merge($thresholdXGroupEnter)
            .attr('d', (d, i) => {
                let y =
                    i === 0
                        ? this._scales.y.range()[0]
                        : this._scales.y(d['mean']);
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

        let $bgXGroupSelect = $xGroupMerge.selectAll('.bg').data((d) => [d, d]);

        let $bgXGroupEnter = $bgXGroupSelect
            .enter()
            .append('rect')
            .attr('class', (d, i) => 'bg bg-' + i);

        let $bgXGroupMerge = $bgXGroupSelect
            .merge($bgXGroupEnter)
            .attr('height', 36)
            .attr('width', 70)
            .attr('rx', 6)
            .attr('ry', 6)
            .attr('transform', (d, i) => {
                let y =
                        i === 0
                            ? this._scales.y.range()[0] + 2
                            : this._scales.y(d['mean']) - 12,
                    x =
                        i === 0
                            ? this._scales.x(
                                  d.values[Math.floor(d.values.length / 2)][
                                      this._config.x.name
                                  ]
                              ) - 35
                            : this._scales.x(d.values[0][this._config.x.name]) -
                              74;
                return 'translate(' + [x, y] + ')';
            });

        let $labelXGroupSelect = $xGroupMerge
            .selectAll('.x-group-label')
            .data((d) => [d]);

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

        let $yearXGroupSelect = $xGroupMerge
            .selectAll('.year-label')
            .data((d) => [d]);

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

        let $valueXGroupSelect = $xGroupMerge
            .selectAll('.text-value')
            .data((d) => [d]);

        let $valueXGroupEnter = $valueXGroupSelect
            .enter()
            .append('text')
            .attr('class', 'text-value');

        let $valueXGroupMerge = $valueXGroupSelect
            .merge($valueXGroupEnter)
            .attr(
                'transform',
                (d) =>
                    'translate(' +
                    [
                        this._scales.x(d.values[0][this.config.x.name]) - 6,
                        this._scales.y(d['mean']),
                    ] +
                    ')'
            )
            .attr('dy', '0.3em')
            .text((d) => this.config.y.format_long(d['mean']));

        let $textXGroupSelect = $xGroupMerge
            .selectAll('.text-label')
            .data((d) => [d]);

        let $textXGroupEnter = $textXGroupSelect
            .enter()
            .append('text')
            .attr('class', 'text-label');

        let $textXGroupMerge = $textXGroupSelect
            .merge($textXGroupEnter)
            .attr(
                'transform',
                (d) =>
                    'translate(' +
                    [
                        this._scales.x(d.values[0][this.config.x.name]) - 6,
                        this._scales.y(d['mean']) + 10,
                    ] +
                    ')'
            )
            .attr('dy', '0.7em')
            .text(this.config.x.label_group);

        // Y Groups
        let $yGroupSelect = this.$markG
            .selectAll('.y-group.field-' + this._config.y.name)
            .data(this._data.y);

        let $yGroupEnter = $yGroupSelect
            .enter()
            .append('g')
            .attr(
                'class',
                (d) =>
                    'y-group value-' +
                    d['consecutive_days'][0].range[0] +
                    ' field-' +
                    this._config.y.name
            );

        let $yGroupMerge = $yGroupSelect.merge($yGroupEnter);

        let $areaYGroupSelect = $yGroupMerge
            .selectAll('.area')
            .data((d) => d.consecutive_days);

        let $areaYGroupEnter = $areaYGroupSelect
            .enter()
            .append('path')
            .attr('class', 'area');

        // TODO Make the days complete to the end of day for area and lines
        let $areaYGroupMerge = $areaYGroupSelect
            .merge($areaYGroupEnter)
            .datum((d) => d.values)
            .attr('d', this._shapes.area);

        let $lineYGroupSelect = $yGroupMerge
            .selectAll('.line')
            .data((d) => d.consecutive_days);

        let $lineYGroupEnter = $lineYGroupSelect
            .enter()
            .append('path')
            .attr('class', 'line');

        let $lineYGroupMerge = $lineYGroupSelect
            .merge($lineYGroupEnter)
            .datum((d) => d.values)
            .attr('d', this._shapes.line);

        let $thresholdYGroupSelect = $yGroupMerge
            .selectAll('.threshold')
            .data((d) => d['consecutive_days'][0].range);

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

        let $bgYGroupSelect = $yGroupMerge
            .selectAll('.bg')
            .data((d) => d['consecutive_days'][0].range);

        let $bgYGroupEnter = $bgYGroupSelect
            .enter()
            .append('rect')
            .attr('class', (d, i) => 'bg bg-' + i);

        let $bgYGroupMerge = $bgYGroupSelect
            .merge($bgYGroupEnter)
            .attr('height', 14)
            .attr('width', 50)
            .attr(
                'transform',
                (d) => 'translate(' + [-50, this._scales.y(d) - 16] + ')'
            );

        let $tickYGroupSelect = $yGroupMerge
            .selectAll('.tick')
            .data((d) => d['consecutive_days'][0].range);

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

        let $labelYGroupSelect = $yGroupMerge
            .selectAll('.label')
            .data((d) => [d['consecutive_days'][0].range[1]]);

        let $labelYGroupEnter = $labelYGroupSelect
            .enter()
            .append('text')
            .attr('class', 'label');

        // TODO remove hard code value, do based on how far up y axis
        let $labelYGroupMerge = $labelYGroupSelect
            .merge($labelYGroupEnter)
            .attr(
                'transform',
                (d) =>
                    'translate(' +
                    [d < 1e5 ? -5 : 2, this._scales.y(d) - 4] +
                    ')'
            )
            .text(this.config.y.label_group);

        let $spanLineYGroupSelect = $yGroupMerge
            .selectAll('.span-line')
            .data((d) => d['consecutive_days']);

        let $spanLineYGroupEnter = $spanLineYGroupSelect
            .enter()
            .append('path')
            .attr('class', (d) => 'span-line value-' + d.date_class);

        // TODO values should complete to next day
        let $spanLineYGroupMerge = $spanLineYGroupSelect
            .merge($spanLineYGroupEnter)
            .attr('d', (d) => {
                let y = this._scales.y(d.range[0]);
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

        let $spanBgYGroupSelect = $yGroupMerge
            .selectAll('.span-bg')
            .data((d) => d['consecutive_days']);

        let $spanBgYGroupEnter = $spanBgYGroupSelect
            .enter()
            .append('rect')
            .attr('class', (d) => 'span-bg value-' + d.date_class);

        let $spanBgYGroupMerge = $spanBgYGroupSelect
            .merge($spanBgYGroupEnter)
            .attr('width', (d) => d.date_label.length * 6)
            .attr('height', 16)
            .attr('rx', 2)
            .attr('ry', 2)
            .attr('transform', (d) => {
                let y = this._scales.y(d.range[0]),
                    x0 = this._scales.x(d.values[0][this._config.x.name]),
                    x1 = this._scales.x(
                        d.values[d.values.length - 1][this._config.x.name]
                    ),
                    x = x0 + (x1 - x0) / 2 - d.date_label.length * 3;
                return 'translate(' + [x, y + 1.5] + ')';
            });

        let $spanDateYGroupSelect = $yGroupMerge
            .selectAll('.span-date')
            .data((d) => d['consecutive_days']);

        let $spanDateYGroupEnter = $spanDateYGroupSelect
            .enter()
            .append('text')
            .attr('dy', '0.7em')
            .attr('class', (d) => 'span-date value-' + d.date_class);

        let $spanDateYGroupMerge = $spanDateYGroupSelect
            .merge($spanDateYGroupEnter)
            .attr('transform', (d) => {
                let y = this._scales.y(d.range[0]),
                    x0 = this._scales.x(d.values[0][this._config.x.name]),
                    x1 = this._scales.x(
                        d.values[d.values.length - 1][this._config.x.name]
                    ),
                    x = x0 + (x1 - x0) / 2;
                return 'translate(' + [x, y + 5.5] + ')';
            })
            .text((d) => d.date_label);
    }

    drawAnnotationLayer() {
        const indexScale = d3
            .scaleLinear()
            .domain(this._scales.x.domain())
            .range([0, this._data.raw.length]);

        let $annotSelect = this.$annotG
            .selectAll('.annotation')
            .data(this._data.annotations);

        let $annotEnter = $annotSelect
            .enter()
            .append('g')
            .attr(
                'class',
                (d, i) => 'annotation ' + d.target.type + ' annotation-' + i
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

        const raw = this._data.raw;
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
                dValues = iValues.map((i) => raw[i]);
            d.target.data = raw.slice(iValues[0], iValues[1] + 1);
            let yValues = d.target.data.map((dd) =>
                scales.y(dd[config.y.name])
            );
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
                scales.y(dValues[1][config.y.name]),
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
            .data(this._data.annotations);

        let $groupAnnotEnter = $groupAnnotSelect
            .enter()
            .append('g')
            .attr(
                'class',
                (d, i) =>
                    'annotation-group ' + d.target.type + ' annotation-' + i
            );

        let $groupAnnotMerge = $groupAnnotSelect.merge($groupAnnotEnter);

        let $areaAnnotSelect = $groupAnnotMerge
            .selectAll('.area')
            .data((d) => [d.target.data]);

        let $areaAnnotEnter = $areaAnnotSelect
            .enter()
            .append('path')
            .attr('class', 'area');

        let $areaAnnotMerge = $areaAnnotSelect
            .merge($areaAnnotEnter)
            .datum((d) => d)
            .attr('d', this._shapes.area);

        let $lineAnnotSelect = $groupAnnotMerge
            .selectAll('.line')
            .data((d) => [d.target.data]);

        let $lineAnnotEnter = $lineAnnotSelect
            .enter()
            .append('path')
            .attr('class', 'line');

        let $lineAnnotMerge = $lineAnnotSelect
            .merge($lineAnnotEnter)
            .datum((d) => d)
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

        let $aLabelSelect = this.$axesG
            .selectAll('.axis-label.axis-label-a')
            .data(['Annotated Insights']);

        let $aLabelEnter = $aLabelSelect
            .enter()
            .append('text')
            .attr('class', 'axis-label axis-label-a');

        let $aLabelMerge = $aLabelSelect
            .merge($aLabelEnter)
            .attr(
                'transform',
                'translate(' + [this._scales.x.range()[1] - 398, -46] + ')'
            )
            .attr('dy', '0.7em')
            .style('text-anchor', 'start')
            .text((t) => t);
    }

    clearHighlightClassed() {
        this.$markG
            .selectAll(
                '.y-group.highlight,.x-group.highlight,.annotation-group.highlight'
            )
            .classed('highlight', false);
        this.$annotG
            .selectAll('.annotation.highlight')
            .classed('highlight', false);
        this.$ghostG
            .selectAll('.annotation-ghost.highlight')
            .classed('highlight', false);
        this.$markG.selectAll('.base-mark').classed('fade', false);
    }

    fadeBaseMarks() {
        this.$markG.selectAll('.base-mark').classed('fade', true);
    }

    ghostBaseMarks() {
        const barWidth = this._scales.x.range()[1] / this._data.raw.length;

        // TODO should this be done with a voronoi?
        let $barContainer = this.$ghostG
            .append('g')
            .attr('class', 'bar-ghost-container')
            .attr('aria-label', 'Interactive data points of this chart.')
            .attr('aria-hidden', 'false')
            .attr('tabindex', '-1')
            .on('focus', function (event, d) {
                console.log('Bar has focus!!');
            });

        let $barSelect = $barContainer.selectAll('.bar').data(this._data.raw);

        let $barEnter = $barSelect
            .enter()
            .append('rect')
            .attr(
                'class',
                (d) => 'bar value-' + formatDateClass(d[this._config.x.name])
            )
            .attr('aria-hidden', 'false')
            .attr('tabindex', '-1');

        // Change first and last day of month aria-label
        let $barMerge = $barSelect
            .merge($barEnter)
            .attr('width', barWidth)
            .attr('height', (d) => this._scales.y.range()[0])
            .attr('y', 0)
            .attr(
                'x',
                (d) => this._scales.x(d[this._config.x.name]) - barWidth / 2
            )
            .attr('aria-label', (d) => {
                // If first of month, give full date
                return (
                    this.config.x.format_short(d[this._config.x.name]) +
                    ': ' +
                    this.config.y.format_long(d[this._config.y.name]) +
                    ' ' +
                    this.config.y.label_group +
                    '.'
                );
            })
            .on('focus', (event, d) => {
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

                this.$tooltip.style(
                    'transform',
                    'translate(' +
                        this._scales.tooltip(d[this._config.x.name]) +
                        '%, 0px)'
                );
                this.$tooltipContainer
                    .style('visibility', 'visible')
                    .style(
                        'left',
                        this._scales.x(d[this.config.x.name]) +
                            this.margin.l +
                            'px'
                    )
                    .style(
                        'top',
                        this._scales.y(d[this.config.y.name]) +
                            this.margin.t +
                            'px'
                    );
                this.$tooltipDate.text(
                    this.config.x.format_long(d[this.config.x.name])
                );
                this.$tooltipValue.text(
                    this.config.y.label_tooltip +
                        this.config.y.format_long(d[this.config.y.name])
                );
                if (this._navigateBy === 'g' || this._navigateBy === '') {
                    this.clearHighlightClassed();
                    this.fadeBaseMarks();
                }
            })
            .on('mouseover', function (event, d) {
                this.focus();
            });
    }

    ghostAxisGroupLayer() {
        let $xGhostContainer = this.$ghostG
            .append('g')
            .attr('class', 'x-ghost-container')
            .attr(
                'aria-label',
                'Interactive x axis, ' +
                    this.config.x.label_group +
                    ' grouped by ' +
                    this.config.x.interval +
                    ' from ' +
                    this.config.x.format_group[0](this._scales.x.domain()[0]) +
                    ' to ' +
                    this.config.x.format_group[0](this._scales.x.domain()[1]) +
                    '. ' +
                    this._data.x.length +
                    ' groups available.'
            )
            .attr('aria-hidden', 'false')
            .attr('tabindex', '-1')
            .on('focus', function (event, d) {
                console.log('X axis has focus!!');
            });

        this._navGroups[1].node = $xGhostContainer.node();
        this._navGroups[1].dataTable = this._data.x;
        this._navGroups[1].getClass = (v) =>
            '.x-ghost.value-' +
            formatDateClass(v.values[0][this._config.x.name]);
        this._navGroups[1].getSubTable = (v) => v.values;

        let $yGhostContainer = this.$ghostG
            .append('g')
            .attr('class', 'y-ghost-container')
            .attr(
                'aria-label',
                'Interactive y axis, ' +
                    this.config.y.label_group +
                    ' grouped by ' +
                    this.config.y.format_long(this.config.y.interval) +
                    ' increments,  from' +
                    this.config.y.format_long(this._scales.y.domain()[0]) +
                    ' to ' +
                    this.config.y.format_long(this._scales.y.domain()[1]) +
                    this.config.y.label_group +
                    '. ' +
                    this._data.y.length +
                    ' groups available.'
            )
            .attr('aria-hidden', 'false')
            .attr('tabindex', '-1')
            .on('focus', function (event, d) {
                console.log('Y axis has focus!!');
            });

        this._navGroups[2].node = $yGhostContainer.node();
        this._navGroups[2].dataTable = this._data.y;
        this._navGroups[2].getClass = (v) =>
            '.y-ghost.value-' + v['consecutive_days'][0].range[0];
        this._navGroups[2].getSubTable = (v) => v.values;

        let $yGhostSelect = $yGhostContainer
            .selectAll('.y-ghost')
            .data(this._data.y);

        let $yGhostEnter = $yGhostSelect
            .enter()
            .append('g')
            .attr(
                'class',
                (v) => 'y-ghost value-' + v['consecutive_days'][0].range[0]
            )
            .attr('aria-hidden', 'false')
            .attr('tabindex', '-1');

        $yGhostEnter
            .append('rect')
            .attr(
                'height',
                this._scales.y(0) - this._scales.y(this.config.y.interval)
            )
            .attr('width', 100)
            .attr('transform', (v) => {
                return (
                    'translate(-100,' +
                    this._scales.y(v['consecutive_days'][0].range[1]) +
                    ')'
                );
            });

        let $yGhostMerge = $yGhostSelect
            .merge($yGhostEnter)
            .attr('aria-label', (v, i) => {
                return (
                    this.config.y.format_long(
                        v['consecutive_days'][0].range[0]
                    ) +
                    ' to ' +
                    this.config.y.format_long(
                        v['consecutive_days'][0].range[1]
                    ) +
                    ' ' +
                    this.config.y.label_group +
                    ' occured ' +
                    v['consecutive_days']
                        .map((vv) => vv.date_aria)
                        .join(', and ') +
                    '. ' +
                    (i + 1) +
                    ' of ' +
                    this._data.y.length +
                    ' groups.'
                );
            })
            .on('focus', (event, d) => {
                this.clearHighlightClassed();
                this.fadeBaseMarks();

                let classYGroup =
                    '.y-group.value-' + d['consecutive_days'][0].range[0];
                let $yGroup = this.$markG.selectAll(classYGroup);

                $yGroup.classed('highlight', true);

                if (this._sonifier.isPlaying) this._sonifier.togglePlay();
                this._sonifier.updateData(d.values, this.config.y.name);

                if (!this._navigateBy.startsWith('d')) {
                    this.$dataTip.style('visibility', 'hidden');
                    this.$tooltipContainer.style('visibility', 'hidden');
                }
            })
            .on('mouseover', function (event, d) {
                this.focus();
            });

        let $xGhostSelect = $xGhostContainer
            .selectAll('.x-ghost')
            .data(this._data.x);

        let $xGhostEnter = $xGhostSelect
            .enter()
            .append('g')
            .attr(
                'class',
                (d) =>
                    'x-ghost value-' +
                    formatDateClass(d.values[0][this.config.x.name])
            )
            .attr('aria-hidden', 'false')
            .attr('tabindex', '-1');

        $xGhostEnter
            .append('rect')
            .attr('height', 60)
            .attr(
                'width',
                (d) =>
                    this._scales.x(
                        d.values[d.values.length - 1][this.config.x.name]
                    ) - this._scales.x(d.values[0][this.config.x.name])
            )
            .attr(
                'transform',
                (d) =>
                    'translate(' +
                    [
                        this._scales.x(d.values[0][this.config.x.name]),
                        this._scales.y.range()[0],
                    ] +
                    ')'
            );

        let $xGhostMerge = $xGhostSelect
            .merge($xGhostEnter)
            .attr('aria-label', (d, i) => {
                return (
                    this.config.x.format_group[0](
                        d.values[0][this.config.x.name]
                    ) +
                    ': ' +
                    this.config.y.format_long(d['mean']) +
                    ' ' +
                    this.config.x.label_group +
                    '. ' +
                    (i + 1) +
                    ' of ' +
                    this._data.x.length +
                    ' groups.'
                );
            })
            .on('focus', (event, d) => {
                this.clearHighlightClassed();
                this.fadeBaseMarks();

                let classXGroup =
                    '.x-group.value-' +
                    formatDateClass(d.values[0][this._config.x.name]);
                let $xGroup = this.$markG.selectAll(classXGroup);
                $xGroup.classed('highlight', true);

                if (this._sonifier.isPlaying) this._sonifier.togglePlay();
                this._sonifier.updateData(d.values, this.config.y.name);

                if (!this._navigateBy.startsWith('d')) {
                    this.$dataTip.style('visibility', 'hidden');
                    this.$tooltipContainer.style('visibility', 'hidden');
                }
            })
            .on('mouseover', function (event, d) {
                this.focus();
            });
    }

    ghostAnnotionLayer() {
        let $annotContainer = this.$ghostG
            .append('g')
            .attr('class', 'annotation-ghost-container')
            .attr(
                'aria-label',
                'Interactive insights about this chart. ' +
                    this._data.annotations.length +
                    ' groups available.'
            )
            .attr('aria-hidden', 'false')
            .attr('tabindex', '-1')
            .on('focus', function (event, d) {
                console.log('Annotation has focus!!');
            });

        this._navGroups[0].node = $annotContainer.node();
        this._navGroups[0].dataTable = this._data.annotations;
        this._navGroups[0].getClass = (value, index) =>
            '.annotation-ghost.annotation-' + index;
        this._navGroups[0].getSubTable = (value) => value.target.data;

        let $annotGhostSelect = $annotContainer
            .selectAll('.annotation-ghost')
            .data(this._data.annotations);

        let $annotGhostEnter = $annotGhostSelect
            .enter()
            .append('g')
            .attr(
                'class',
                (d) =>
                    'annotation-ghost annotation-' +
                    d.index +
                    ' ' +
                    d.target.type
            )
            .attr('aria-hidden', 'false')
            .attr('tabindex', '-1')
            .attr(
                'transform',
                (d) =>
                    'translate(' +
                    [
                        this._scales.x.range()[1] -
                            (this._data.annotations.length - d.index - 1) * 30,
                        -20,
                    ] +
                    ')'
            );

        $annotGhostEnter.append('circle').attr('r', 10);

        $annotGhostEnter
            .append('text')
            .style('text-anchor', 'middle')
            .attr('dy', '0.3em')
            .text((d, i) => i + 1);

        $annotGhostEnter
            .append('rect')
            .attr('width', 30)
            .attr('height', 30)
            .attr('x', -15)
            .attr('y', -15);

        let $annotGhostMerge = $annotGhostSelect
            .merge($annotGhostEnter)
            .attr('aria-label', (d, i) => {
                // Consolidate the description? Should this add specific dates and info?
                return (
                    d.note.title.join(' ') +
                    '. ' +
                    d.note.label.join(' ') +
                    '. ' +
                    (i + 1) +
                    ' of ' +
                    this._data.annotations.length +
                    ' groups.'
                );
            })
            .on('focus', (event, d) => {
                this.clearHighlightClassed();
                this.fadeBaseMarks();

                this.$ghostG
                    .selectAll('.annotation-ghost.annotation-' + d.index)
                    .classed('highlight', true);
                this.$markG
                    .selectAll('.annotation-group.annotation-' + d.index)
                    .classed('highlight', true);
                this.$annotG
                    .selectAll('.annotation.annotation-' + d.index)
                    .classed('highlight', true);

                if (this._sonifier.isPlaying) this._sonifier.togglePlay();
                this._sonifier.updateData(d.target.data, this.config.y.name);

                if (!this._navigateBy.startsWith('d')) {
                    this.$dataTip.style('visibility', 'hidden');
                    this.$tooltipContainer.style('visibility', 'hidden');
                }
            })
            .on('mouseover', function (event, d) {
                this.focus();
            });
    }

    drawChart() {
        if (!this._data.raw || !this._data.x || !this._data.y) {
            return;
        }

        this.drawBaseMarks();
        this.drawAxisGroupLayer();
        this.drawAnnotationLayer();
        this.drawAxesLegends();

        this.ghostBaseMarks();
        this.ghostAxisGroupLayer();
        this.ghostAnnotionLayer();
    }

    onResize() {
        const rect = this.$chartWrapper.node().getBoundingClientRect();
        this._dimensions.height = rect.height;
        this._dimensions.width = rect.width;
    }
}

const updateConfigWithFormats = (config) => {
    if (config.type === 'number') {
        config.format_long = d3.format(',d');
        config.format_short = d3.format('~s');
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
    // TODO handle other data types
};

const parseDate = d3.timeParse('%Y-%m-%d'),
    formatDateClass = d3.timeFormat('%b-%d-%y');
// formatDate = d3.timeFormat('%b %-d, %Y'),
// formatDateLong = d3.timeFormat('%B %-d, %Y'),
// formatDateShort = d3.timeFormat('%b %-d'),
// formatDateMonth = d3.timeFormat('%B %Y'),
// formatDateMonthOnly = d3.timeFormat('%B'),
// formatValue = d3.format(',d');

let createDateLabel = (v, configBase, configValue) => {
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

let createDateClass = (v, configBase, configValue) => {
    let d0 = v[0][configValue.name],
        d1 = v[v.length - 1][configValue.name];
    return formatDateClass(d0) + '_' + formatDateClass(d1);
};

let createDateAria = (v, configBase, configValue) => {
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

const AGGREGATE = {
    MEAN: [
        'mean',
        (v, configBase, configValue) => d3.mean(v, (d) => d[configValue.name]),
    ],
    MAX: [
        'max',
        (v, configBase, configValue) => d3.max(v, (d) => d[configValue.name]),
    ],
    MIN: [
        'min',
        (v, configBase, configValue) => d3.min(v, (d) => d[configValue.name]),
    ],
    COUNT: ['count', (v, configBase, configValue) => v.length],
    CONSECUTIVE_DAYS: [
        'consecutive_days',
        (v, configBase, configValue) => {
            let timePeriod = d3['time' + configValue.period];
            let ai = 0;
            let m = v.reduce((arr, d, i) => {
                let curr = arr[ai],
                    p = curr ? curr[curr.length - 1] : undefined;

                if (
                    p &&
                    timePeriod.count(p[configValue.name], d[configValue.name]) >
                        1
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
                range: [
                    Math.floor(vv[0][configBase.name] / configBase.interval) *
                        configBase.interval,
                    Math.ceil(vv[0][configBase.name] / configBase.interval) *
                        configBase.interval,
                ],
            }));
        },
    ],
};

const computeSubstrateData = (configBase, configValue, raw) => {
    const rollupValues = (v) => {
        const r = { values: v };
        configBase.aggregate.forEach((a) => {
            r[AGGREGATE[a][0]] = AGGREGATE[a][1](v, configBase, configValue);
        });
        return r;
    };

    const rollupKey = (d) => {
        if (configBase.type === 'date') {
            let timeInterval = d3['time' + configBase.interval];
            return timeInterval(d[configBase.name]).toString();
        } else if (configBase.type === 'number') {
            return Math.floor(d[configBase.name] / configBase.interval);
        }
    };

    return [...d3.rollup(raw, rollupValues, rollupKey).values()];
};

export { Chart };
