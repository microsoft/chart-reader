interface ChartConfig {
    description: { title: string; caption: string };
    x: AxisConfig;
    y: AxisConfig;
    z?: any;
    stroke?: any;
}

interface AxisConfig {
    name: string;
    label_group: string;
    label_axis: string;
    label_tooltip: string;
    format_short: (v: any) => string;
    format_long: (v: any) => string;
    format_abbrev: (v: any) => string;
    format_group: (v: any) => string;
    encode: 'x' | 'y' | 'z';
    type: 'date' | 'number' | 'string';
    aggregate: Aggregate[];
    period?: TimePeriod;
    interval?: TimePeriod | number;
    layout?: 'stack' | 'group';
}

interface DimensionConfig {
    width: number;
    height: number;
    margin: MarginConfig;
}

interface MarginConfig {
    l: number;
    t: number;
    r: number;
    b: number;
}

interface ColumnConfig {
    name: string;
    type: 'date' | 'number' | 'string';
    format?: string;
}

interface DataConfig {
    annotations: { url: string };
    raw: { url: string; columns: ColumnConfig[] };
}

enum Aggregate {
    mean = 'mean',
    max = 'max',
    min = 'min',
    count = 'count',
    consecutive_days = 'consecutive_days',
    layout_sum = 'layout_sum'
}

enum TimePeriod {
    Second = 'Second',
    Minute = 'Minute',
    Hour = 'Hour',
    Day = 'Day',
    Week = 'Week',
    Month = 'Month',
    Year = 'Year',
}

export { ChartConfig, AxisConfig, DimensionConfig, MarginConfig, DataConfig, Aggregate, TimePeriod }