// From https://github.com/susielu/react-annotation/blob/master/src/components/Note/Note.js

/**
 * AnnotationAlignment value for the annotation in relation to target
 */
 enum AnnotationAlignment {
    dynamic = 'dynamic',
    top = 'top',
    bottom = 'bottom',
    middle = 'middle',
    left = 'left',
    right = 'right',
}

enum AnnotationOrientation {
    topBottom = 'topBottom',
    top = 'top',
    bottom = 'bottom',
    leftRight = 'leftRight',
    left = 'left',
    right = 'right',
}

/**
 * Computes the outer bounding box for a list of SVGGraphicsElement
 * @param svgNodes SVGGraphicsElement[]
 * @returns DOMRect
 */
const getOuterBBox = (...svgNodes: SVGGraphicsElement[]) => {
    return [...svgNodes].reduce((p: DOMRect, c: SVGGraphicsElement) => {
        if (c) {
            const bbox = c.getBBox();
            p.x = Math.min(p.x, bbox.x);
            p.y = Math.min(p.y, bbox.y);
            p.width = Math.max(p.width, bbox.width);
            const yOffset = c && c.attributes && c.attributes['y'];
            p.height = Math.max(
                p.height,
                ((yOffset && parseFloat(yOffset.value)) || 0) + bbox.height
            );
        }
        return p;
    }, new DOMRect(0, 0, 0, 0));
};

/**
 *
 * @param align AnnotationAlignment
 * @param y
 * @returns
 */
const leftRightDynamic = (align: AnnotationAlignment, y: number) => {
    if (
        !align ||
        align === AnnotationAlignment.dynamic ||
        align === AnnotationAlignment.left ||
        align === AnnotationAlignment.right
    ) {
        if (y < 0) {
            align = AnnotationAlignment.top;
        } else {
            align = AnnotationAlignment.bottom;
        }
    }
    return align;
};

/**
 *
 * @param align
 * @param x
 * @returns
 */
const topBottomDynamic = (align: AnnotationAlignment, x: number) => {
    if (
        !align ||
        align === AnnotationAlignment.dynamic ||
        align === AnnotationAlignment.top ||
        align === AnnotationAlignment.bottom
    ) {
        if (x < 0) {
            align = AnnotationAlignment.right;
        } else {
            align = AnnotationAlignment.left;
        }
    }
    return align;
};

const alignment = (note: AnnotationNote) => {
    let x = -note.bbox.x;
    let y = -note.bbox.y;
    if (orientationTopBottom.indexOf(note.orientation) !== -1) {
        note.align = topBottomDynamic(note.align, note.offset.x);
        if (
            (note.offset.y < 0 &&
                note.orientation === AnnotationOrientation.topBottom) ||
            note.orientation === AnnotationOrientation.top
        ) {
            y -= note.bbox.height + note.padding;
        } else {
            y += note.padding;
        }

        if (note.align === AnnotationAlignment.middle) {
            x -= note.bbox.width / 2;
        } else if (note.align === AnnotationAlignment.right) {
            x -= note.bbox.width;
        }
    } else if (orientationLeftRight.indexOf(note.orientation) !== -1) {
        note.align = leftRightDynamic(note.align, note.offset.y);
        if (
            (note.offset.x < 0 &&
                note.orientation === AnnotationOrientation.leftRight) ||
            note.orientation === AnnotationOrientation.left
        ) {
            x -= note.bbox.width + note.padding;
        } else {
            x += note.padding;
        }

        if (note.align === AnnotationAlignment.middle) {
            y -= note.bbox.height / 2;
        } else if (note.align === AnnotationAlignment.top) {
            y -= note.bbox.height;
        }
    }

    return { x, y };
};

/**
 *
 * @param param0
 * @returns
 */
const horizontalLine = (note: AnnotationNote) => {
    let x = 0,
        y = 0;
    note.align = topBottomDynamic(note.align, note.offset.x);

    if (note.align === AnnotationAlignment.right) {
        x -= note.bbox.width;
    } else if (note.align === AnnotationAlignment.middle) {
        x -= note.bbox.width / 2;
    }

    const data = [
        [x, y],
        [x + note.bbox.width, y],
    ];
    return data;
};

/**
 *
 * @param param0
 * @returns
 */
const elbowLine = (annot: Annotation): number[][] => {
    let x1 = 0,
        x2 = annot.dx,
        y1 = 0,
        y2 = annot.dy;

    if (annot.width && annot.height) {
        if (
            (annot.width > 0 && annot.dx > 0) ||
            (annot.width < 0 && annot.dx < 0)
        ) {
            if (Math.abs(annot.width) > Math.abs(annot.dx)) {
                x1 = annot.width / 2;
            } else {
                x1 = annot.width;
            }
        }
        if (
            (annot.height > 0 && annot.dy > 0) ||
            (annot.height < 0 && annot.dy < 0)
        ) {
            if (Math.abs(annot.height) > Math.abs(annot.dy)) {
                y1 = annot.height / 2;
            } else {
                y1 = annot.height;
            }
        }
        if (x1 === annot.width / 2 && y1 === annot.height / 2) {
            x1 = x2;
            y1 = y2;
        }
    }

    let data = [
            [x1, y1],
            [x2, y2],
        ],
        diffY = y2 - y1,
        diffX = x2 - x1,
        xe = x2,
        ye = y2;

    let opposite = (y2 < y1 && x2 > x1) || (x2 < x1 && y2 > y1) ? -1 : 1;

    if (Math.abs(diffX) < Math.abs(diffY)) {
        xe = x2;
        ye = y1 + diffX * opposite;
    } else {
        ye = y2;
        xe = x1 + diffY * opposite;
    }

    if (annot.outerRadius || annot.radius) {
        const r =
            (annot.outerRadius || annot.radius) + (annot.radiusPadding || 0);
        const length = r / Math.sqrt(2);

        if (Math.abs(diffX) > length && Math.abs(diffY) > length) {
            x1 = length * (x2 < 0 ? -1 : 1);
            y1 = length * (y2 < 0 ? -1 : 1);
            data = [
                [x1, y1],
                [xe, ye],
                [x2, y2],
            ];
        } else if (Math.abs(diffX) > Math.abs(diffY)) {
            const angle = Math.asin(-y2 / r);
            x1 = Math.abs(Math.cos(angle) * r) * (x2 < 0 ? -1 : 1);
            data = [
                [x1, y2],
                [x2, y2],
            ];
        } else {
            const angle = Math.acos(x2 / r);
            y1 = Math.abs(Math.sin(angle) * r) * (y2 < 0 ? -1 : 1);
            data = [
                [x2, y1],
                [x2, y2],
            ];
        }
    } else {
        data = [
            [x1, y1],
            [xe, ye],
            [x2, y2],
        ];
    }
    return data;
};

const orientationTopBottom = ['topBottom', 'top', 'bottom'];
const orientationLeftRight = ['leftRight', 'left', 'right'];

interface Annotation {
    target: AnnotationTarget;
    dx: number;
    dy: number;
    radius?: number;
    outerRadius?: number;
    radiusPadding?: number;
    width?: number;
    height?: number;
    translate?: number[];
    connectorPath?: string;
    subjectPath?: string;
    notePath?: string;
    note: AnnotationNote;
}

interface AnnotationTarget {
    type: string;
    axis: 'x' | 'y';
    values: number[];
    dates?: Date[];
    data: any[];
    height?: number;
    width?: number;
    x?: number;
    y?: number;
}

interface AnnotationNote {
    title: string[];
    label: string[];
    bbox?: DOMRect;
    align?: AnnotationAlignment;
    orientation?: AnnotationOrientation;
    offset?: { x: number; y: number };
    padding?: number;
    width?: number;
    height?: number;
    dx?: number;
    dy?: number;
}

export {
    getOuterBBox,
    leftRightDynamic,
    topBottomDynamic,
    alignment,
    horizontalLine,
    elbowLine,
    Annotation,
    AnnotationTarget,
    AnnotationNote,
};
