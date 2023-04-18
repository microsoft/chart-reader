// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ChartConfig } from './core';
import { Sonifier } from './sonify';

import * as d3 from 'd3';

class NavigationController {
    private _valueAtLevels: any[];
    // private _selectedAtLevels: number[];
    private _tree: Map<number, NavigationTreeNode>;
    private _sonifier: Sonifier;
    private _focusMode: boolean;
    private _timeouts: number[];
    private _highlightPoint: (d: any) => void;

    private _currEl: NavigationElement;

    constructor(
        sonifier: Sonifier,
        tree: Map<number, NavigationTreeNode>,
        root: NavigationElement,
        highlightPoint: (d: any) => void
    ) {
        this._valueAtLevels = ['-', undefined, undefined, undefined, undefined];

        this._tree = tree;

        this._sonifier = sonifier;
        this._highlightPoint = highlightPoint;

        this._timeouts = [];
        this._currEl = root;
    }

    public toggleSonifier(
        data: any,
        config: ChartConfig,
        $ariaG: d3.selection,
        $chartWrapper: d3.selection
    ) {
        if (this._sonifier.isPlaying) {
            this._timeouts.forEach((t) => {
                window.clearTimeout(t);
            });
            this._timeouts = [];
            this._sonifier.togglePlay();

            this.action('none', 1, data, config, $ariaG, $chartWrapper, false);
        } else {
            if (
                this._currEl.type.startsWith('series') ||
                this._currEl.type === 'data-sonify-values'
            ) {
                this._sonifier.togglePlay();
            } else {
                this._sonifier.effectPlay('drop');
            }
        }

        console.log('Toggle Sonifier!!!');
    }

    public updateSonifier(
        data: any,
        config: ChartConfig,
        $ariaG: d3.selection,
        $chartWrapper: d3.selection,
        index: number,
        series: number
    ) {
        if (
            this._currEl.type === 'series_reverse' ||
            this._currEl.type === 'series_normal' ||
            this._currEl.type === 'data-sonify-values'
        ) {
            this._currEl.selected = index;
            let dataLength =
                this._currEl.type === 'series_reverse'
                    ? this._currEl.values[0].values.length
                    : this._currEl.values.length;
            if (index + 1 >= dataLength) {
                this.action(
                    'none',
                    1,
                    data,
                    config,
                    $ariaG,
                    $chartWrapper,
                    false
                );
            }
        } else if (this._currEl.type === 'data-sonify-values') {
            
        }
    }

    public getSelectedIndex() {
        return this._currEl.selected;
    }

    public getSelectedLength() {
        switch (this._currEl.type) {
            case 'series_reverse':
                return this._currEl.values[this._currEl.series].values.length;
            // case 'control':
            //     return this._tree.get(this._tree.get(this._currEl.id).parent).children.length;
            default:
                return this._currEl.values.length;
        }
    }

    public action(
        direction: string,
        distance: number,
        data: any,
        config: ChartConfig,
        $ariaG: d3.selection,
        $chartWrapper: d3.selection,
        isSonify: boolean
    ) {
        console.log(direction, distance, isSonify);
        switch (direction) {
            case 'up_down':
                if (distance > 0) {
                    // Go down a level if possible
                    let children = this._tree.get(this._currEl.id).children;

                    if (children.length > 0) {
                        let firstChild = this._tree.get(children[0]).element;
                        if (firstChild.type === 'control') {
                            this._currEl = this._tree.get(
                                firstChild.values[firstChild.selected]
                            ).element;
                        } else {
                            this._currEl = firstChild;
                            this._currEl.values = this._currEl.getData(
                                data,
                                this._valueAtLevels
                            );
                        }
                    } else {
                        this._sonifier.effectPlay('bonk');
                    }
                } else {
                    // Esc gets out of focus mode
                    if (!this._focusMode) {
                        // Go up a level if possible
                        let parentId = this._tree.get(this._currEl.id).parent;

                        if (parentId > 0) {
                            this._currEl = this._tree.get(parentId).element;
                        } else {
                            this._sonifier.effectPlay('bonk');
                        }
                    } else {
                        this._focusMode = false;
                    }
                }
                break;
            case 'left_right':
                const newSelected = this._currEl.selected + distance;
                if (this._currEl.type.startsWith('series')) {
                    const length =
                        this._currEl.type === 'series_reverse'
                            ? this._currEl.values[this._currEl.series].values
                                  .length
                            : this._currEl.values.length;

                    // Jump if supported and outside of bounds
                    if (
                        this._currEl.jump !== 'disabled' &&
                        (newSelected < 0 || newSelected >= length)
                    ) {
                        let parent = this._tree.get(
                            this._tree.get(this._currEl.id).parent
                        )?.element;
                        if (
                            parent &&
                            parent.selected + distance >= 0 &&
                            parent.selected + distance < parent.values?.length
                        ) {
                            parent.selected += newSelected < 0 ? -1 : 1;
                            this._valueAtLevels[parent.level] =
                                parent.values[parent.selected];
                            this._currEl.values = this._currEl.getData(
                                data,
                                this._valueAtLevels
                            );
                            const newLength =
                                this._currEl.type === 'series_reverse'
                                    ? this._currEl.values[this._currEl.series]
                                          .values.length
                                    : this._currEl.values.length;
                            this._currEl.selected =
                                newSelected < 0 ? newLength - 1 : 0;
                            const newSeries =
                                this._currEl.type === 'series_reverse'
                                    ? this._currEl.values.length
                                    : this._currEl.values[this._currEl.selected]
                                          .length;
                            this._currEl.series =
                                this._currEl.series >= newSeries
                                    ? newSeries - 1
                                    : this._currEl.series;
                        }
                    } else {
                        this._currEl.selected = Math.min(
                            Math.max(newSelected, 0),
                            length - 1
                        );
                        if (newSelected < 0 || newSelected >= length) {
                            this._sonifier.effectPlay('bonk');
                        }
                    }
                } else {
                    this._currEl.selected = Math.min(
                        Math.max(newSelected, 0),
                        this._currEl.values.length - 1
                    );
                    if (
                        newSelected < 0 ||
                        newSelected >= this._currEl.values.length
                    ) {
                        this._sonifier.effectPlay('bonk');
                    }
                    if (this._currEl.jump !== 'disabled') {
                    } else {
                    }
                }
                if (this._currEl.type === 'control') {
                    let parentId = this._tree.get(this._currEl.id).parent;
                    let children = this._tree
                        .get(parentId)
                        .children.map((c) => this._tree.get(c).element);
                    children.forEach(
                        (c) => (c.selected = this._currEl.selected)
                    );
                    this._currEl = children[this._currEl.selected];
                } else {
                    let children = this._tree
                        .get(this._currEl.id)
                        .children.map((c) => this._tree.get(c).element);
                    children.forEach((c) => {
                        c.selected = 0;
                        c.series = 0;
                    });
                }
                break;
            case 'series_up_down':
                if (this._currEl.type.startsWith('series')) {
                    this._currEl.series = clampLoop(
                        this._currEl.series + distance,
                        this._currEl.type === 'series_normal'
                            ? this._currEl.values[this._currEl.selected].length
                            : this._currEl.values.length
                    );
                }
                break;
            case 'control':
                let parentId = distance;
                switch (distance) {
                    // I | X | Y | D | C | F
                    case 73:
                        parentId = 2;
                        break;
                    case 88:
                        parentId = 3;
                        break;
                    case 89:
                        parentId = 4;
                        break;
                    case 68:
                        parentId = 5;
                        break;
                    case 67:
                        parentId = 16;
                        break;
                    case 70:
                        parentId = 19;
                        break;
                }
                if (parentId > 0) {
                    this._currEl = this._tree.get(parentId).element;
                } else {
                    this._sonifier.effectPlay('bonk');
                }
                break;
        }

        let currValue = this._currEl.values[this._currEl.selected];

        switch (this._currEl.type) {
            case 'series_normal':
            case 'series_reverse':
                this._sonifier.updateData(
                    this._currEl.values,
                    config.y.name,
                    this._currEl.type,
                    this._currEl.selected,
                    this._currEl.series
                );
                break;
            case 'data-sonify-values':
                let yName = this._currEl.sonify
                    ? this._currEl.sonify
                    : config.y.name;
                let currValues =
                    this._currEl.values[0] &&
                    this._currEl.values[0][0] &&
                    this._currEl.values[0][0].length
                        ? this._currEl.values?.map((v) => v[0])
                        : this._currEl.values;
                this._sonifier.updateData(
                    currValues,
                    yName,
                    this._currEl.type,
                    this._currEl.selected,
                    this._currEl.series
                );
                break;
            case 'data-no-sonify':
                this._sonifier.updateData(
                    [],
                    config.y.name,
                    this._currEl.type,
                    0,
                    0
                );
                break;
        }

        // If any move action happens, stop any timeouts from starting sonifier later
        if (this._timeouts.length > 0) {
            this._timeouts.forEach((t) => {
                window.clearTimeout(t);
            });
            this._timeouts = [];
        }

        // Stop sonifying if any move action happens
        if (!isSonify && this._sonifier.isPlaying) {
            this.toggleSonifier(data, config, $ariaG, $chartWrapper);
        }
        if (this._currEl.type.startsWith('series')) {
            currValue =
                this._currEl.type === 'series_normal'
                    ? this._currEl.values[this._currEl.selected][
                          this._currEl.series
                      ]
                    : this._currEl.values[this._currEl.series].values[
                          this._currEl.selected
                      ];

            if (isSonify) {
                this._sonifier.notePlay(currValue[config.y.name]);
                this._highlightPoint(currValue);
            }
        }

        if (isSonify && !this._currEl.type.startsWith('series')) {
            if (
                this._currEl.type !== 'data-no-sonify' &&
                this._currEl.type !== 'control'
            ) {
                let yName = this._currEl.sonify
                    ? this._currEl.sonify
                    : config.y.name;
                if (currValue[0].length) {
                    this._sonifier.spatialPlay(
                        currValue[0].map((d) => d[yName])
                    );
                } else {
                    this._sonifier.spatialPlay(currValue.map((d) => d[yName]));
                }
            } else {
                this._sonifier.effectPlay('drop');
            }
        }

        this._valueAtLevels[this._currEl.level] = currValue;

        let selectClass = this._currEl.getClass(
            currValue,
            this._valueAtLevels,
            config
        );
        const $selected =
            this._currEl.level === 0
                ? $chartWrapper
                : $ariaG.select(selectClass);

        if (direction === 'focus') {
            if (this._currEl.type !== 'filter') {
                this._focusMode = !this._focusMode;
            } else {
                this._currEl.values[this._currEl.selected].filtered =
                    !this._currEl.values[this._currEl.selected].filtered;
                $selected.dispatch('click');
            }
        }

        if (this._focusMode) {
            const ariaLabel = $selected.attr('aria-label');
            $chartWrapper
                .select('.chart-sr-focus .chart-sr-focus-content')
                .text(ariaLabel);
            $chartWrapper
                .select('.chart-sr-desc-container.chart-sr-focus')
                .node()
                .focus();
        } else {
            if (
                config.z &&
                direction === 'series_up_down' &&
                (this._currEl.type === 'series_normal' ||
                    this._currEl.type === 'series_reverse')
            ) {
                const ariaLabel = $selected.attr('aria-label');
                const seriesLabel =
                    config.z.map[currValue[config.z.name]] + ' Series. ';
                $selected.attr('aria-label', seriesLabel + ariaLabel);
                // Set timeout here to remove the text that was added
                window.setTimeout(() => {
                    $selected.attr('aria-label', ariaLabel);
                }, 4e3);
            }

            console.log(this._currEl);

            // If not sonify announce right away
            if (!isSonify) {
                $selected.node().focus();
            } else if (
                this._currEl.type.startsWith('series') ||
                this._currEl.type === 'data-sonify-values'
            ) {
                // Else if point sonifying, wait to focus the element
                const tid = window.setTimeout(() => {
                    $selected.node().focus();
                    this._timeouts = this._timeouts.filter((t) => t !== tid);
                }, 350);
                this._timeouts.push(tid);
            }
        }
    }
}

const clampLoop = (i, length) => {
    return i >= length ? 0 : i < 0 ? length - 1 : i;
};

interface NavigationElement {
    type: string;
    jump: string;
    sonify: string;
    level: number;
    id: number;
    selected: number;
    series?: number;
    values?: any[];
    getData?: (data: any, valueAtLevels: any[]) => any;
    getClass?: (d: any, valueAtLevels: any[], config: ChartConfig) => string;
}

interface NavigationTreeNode {
    children: number[];
    parent: number;
    element: NavigationElement;
}

export { NavigationController, NavigationElement, NavigationTreeNode };
