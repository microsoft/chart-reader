import * as d3 from 'd3';

class Sonifier {
    private _nextNoteTime: number;
    private _currentDataIndex: number;
    private _currentDataSeries: number;
    private _navType: string;
    private _data: any[];
    private _name: string;

    private _gainNodeQueue: GainNode[];
    private _highlightTimerQueue: number[];
    private _timerId: number;
    private _speed: number;
    private _isLocked: boolean;
    private _isPlaying: boolean;
    private _audioContext: AudioContext;
    private _compressor: DynamicsCompressorNode;
    private _sounds: { bonk?: AudioBuffer; drop?: AudioBuffer };
    private _onPlayData: (value: any, index: number, series: number) => void;

    private _scales: { normalize: any; gain: any };

    constructor(
        onPlayData: (value: any, index: number, series: number) => void
    ) {
        this._nextNoteTime = 0.0;
        this._currentDataIndex = 0;
        this._currentDataSeries = 0;
        this._data = [];
        this._name = '';
        this._navType = '';
        this._gainNodeQueue = [];
        this._highlightTimerQueue = [];
        this._timerId = -1;
        this._speed = 1.0;
        this._isLocked = true;
        this._isPlaying = false;
        this._onPlayData = onPlayData;
        this._scales = {
            normalize: d3.scaleLinear().range([0, 1]),
            gain: d3.scaleLinear().domain(ISO226fqSPL).range(ISO226gnSPL),
        };
    }

    get isPlaying() {
        return this._isPlaying;
    }

    get dataLength() {
        return this._navType === 'series_reverse'
            ? this._data[this._currentDataSeries].values.length
            : this._data.length;
    }

    updateDomain(domain: number[]) {
        this._scales.normalize.domain(domain);
    }

    updateData(
        data: any[],
        name: string,
        type: string,
        index: number,
        series: number
    ) {
        console.log('update data called');
        this._data = data;
        this._name = name;
        this._navType = type;
        this._currentDataIndex = index;
        this._currentDataSeries = series;
        if (this.dataLength >= 50) {
            this._speed = 0.6667;
        } else {
            this._speed = 1.0;
        }
        console.log('NEW SPEED is ' + this._speed);
    }

    scheduleDataToSonify(value: any, time: number) {
        let normalized = this._scales.normalize(value),
            noteNumber = normalized * 44 + 40, // Between 1 to 88
            frequency = A4 * Math.pow(2, (noteNumber - 49) / 12),
            g = Math.min(2, Math.max(0.2, this._scales.gain(frequency)));

        let oscillatorFirst = this._audioContext.createOscillator(),
            oscillatorSecond = this._audioContext.createOscillator(),
            gain = this._audioContext.createGain();
        oscillatorSecond.connect(gain);
        oscillatorFirst.connect(gain);

        gain.connect(this._compressor);
        this._compressor.connect(this._audioContext.destination);

        oscillatorFirst.frequency.value = frequency;
        oscillatorSecond.frequency.value = frequency * 2.0;
        oscillatorFirst.type = 'sine';
        oscillatorSecond.type = 'sine';
        oscillatorFirst.start(time);
        oscillatorSecond.start(time);

        gain.gain.setValueAtTime(0.00001, time);
        gain.gain.exponentialRampToValueAtTime(
            g,
            time + NOTE_LENGTH * 0.1 * this._speed
        );
        gain.gain.setValueAtTime(g, time + NOTE_LENGTH * 0.5 * this._speed);
        gain.gain.exponentialRampToValueAtTime(
            0.00001,
            time + NOTE_LENGTH * 0.6 * this._speed
        );

        this._gainNodeQueue.push(gain);

        if (this._gainNodeQueue.length > 4) {
            this._gainNodeQueue = this._gainNodeQueue.slice(1, 5);
        }

        oscillatorFirst.stop(time + NOTE_LENGTH * this._speed);
        oscillatorSecond.stop(time + NOTE_LENGTH * this._speed);
    }

    scheduleDataToSpatialSonify(values: number[], time: number) {
        values.forEach((value: number, index: number) => {
            let normalized = this._scales.normalize(value),
                noteNumber = normalized * 44 + 40, // Between 1 to 88
                frequency = A4 * Math.pow(2, (noteNumber - 49) / 12),
                g = Math.min(2, Math.max(0.2, this._scales.gain(frequency)));

            const noteTime = time + NOTE_LENGTH * 0.67 * index * this._speed;

            let oscillatorFirst = this._audioContext.createOscillator(),
                oscillatorSecond = this._audioContext.createOscillator(),
                stereoPanner = this._audioContext.createStereoPanner(),
                gain = this._audioContext.createGain();
            oscillatorSecond.connect(stereoPanner);
            oscillatorFirst.connect(stereoPanner);
            stereoPanner.connect(gain);

            gain.connect(this._compressor);
            this._compressor.connect(this._audioContext.destination);

            oscillatorFirst.frequency.value = frequency;
            oscillatorSecond.frequency.value = frequency * 2.0;
            oscillatorFirst.type = 'sine';
            oscillatorSecond.type = 'sine';
            oscillatorFirst.start(noteTime);
            oscillatorSecond.start(noteTime);

            let adjLength = values.length > 1 ? values.length - 1 : 1;
            if (values.length === 1) {
                stereoPanner.pan.value = 0;
            } else {
                stereoPanner.pan.value = (index / adjLength) * 2 - 1;
            }

            gain.gain.setValueAtTime(0.00001, noteTime);
            gain.gain.exponentialRampToValueAtTime(
                g,
                noteTime + NOTE_LENGTH * 0.1 * this._speed
            );
            gain.gain.setValueAtTime(
                g,
                noteTime + NOTE_LENGTH * 0.5 * this._speed
            );
            gain.gain.exponentialRampToValueAtTime(
                0.00001,
                noteTime + NOTE_LENGTH * 0.6 * this._speed
            );

            this._gainNodeQueue.push(gain);

            if (this._gainNodeQueue.length > 4) {
                this._gainNodeQueue = this._gainNodeQueue.slice(1, 5);
            }

            oscillatorFirst.stop(noteTime + NOTE_LENGTH * this._speed);
            oscillatorSecond.stop(noteTime + NOTE_LENGTH * this._speed);
        });
    }

    scheduleEffect(value?: AudioBuffer, time?: number) {
        if (value) {
            let bufferSource = this._audioContext.createBufferSource(),
                gain = this._audioContext.createGain();

            bufferSource.buffer = value;
            gain.gain.value = 0.5;

            bufferSource.connect(gain);
            gain.connect(this._compressor);
            this._compressor.connect(this._audioContext.destination);

            this._gainNodeQueue.push(gain);

            bufferSource.start();

            if (this._gainNodeQueue.length > 4) {
                this._gainNodeQueue = this._gainNodeQueue.slice(1, 5);
            }
        }
    }

    scheduleDataToHighlight = (d, i, s, time) => {
        let highlightTimerId = window.setTimeout(() => {
            this._onPlayData(d, i, s);

            let timerIndex =
                this._highlightTimerQueue.indexOf(highlightTimerId);
            if (timerIndex > -1) {
                this._highlightTimerQueue.splice(timerIndex, 1);
            }
        }, time * 1e3);
        this._highlightTimerQueue.push(highlightTimerId);
    };

    nextNote() {
        this._nextNoteTime += NOTE_LENGTH * this._speed;
        this._currentDataIndex++;
    }

    nextSpatialNote() {
        this._nextNoteTime +=
            (NOTE_LENGTH * this._speed * this._data[0].length * 3) / 4;
        this._currentDataIndex++;
    }

    cleanUpSonifier() {
        // Come up with a way to turn off all nodes playing
        this._gainNodeQueue.forEach((gain) => {
            console.log('clean up gain node');
            gain.gain.cancelScheduledValues(this._audioContext.currentTime);
            gain.gain.exponentialRampToValueAtTime(
                0.00001,
                this._audioContext.currentTime + NOTE_LENGTH * this._speed
            );
        });
        this._highlightTimerQueue.forEach((highlightTimerId) => {
            window.clearTimeout(highlightTimerId);
        });
        this._gainNodeQueue = [];
        this._highlightTimerQueue = [];
    }

    scheduler() {
        while (
            this._nextNoteTime <
                this._audioContext.currentTime +
                    SCHEDULE_AHEAD_TIME * this._speed &&
            this._currentDataIndex < this.dataLength
        ) {
            let currData = undefined;
            switch (this._navType) {
                case 'series_normal':
                    currData =
                        this._data[this._currentDataIndex][
                            this._currentDataSeries
                        ];
                    break;
                case 'series_reverse':
                    currData =
                        this._data[this._currentDataSeries].values[
                            this._currentDataIndex
                        ];
                    break;
                case 'data-sonify-values':
                    console.log(this._data[this._currentDataIndex]);
                    currData = this._data[this._currentDataIndex];
                    break;
            }

            if (this._navType === 'data-sonify-values') {
                this.scheduleDataToSpatialSonify(
                    currData.map((d) => d[this._name]),
                    this._nextNoteTime
                );
                this.scheduleDataToHighlight(
                    currData,
                    this._currentDataIndex,
                    this._currentDataSeries,
                    this._nextNoteTime - this._audioContext.currentTime
                );
                this.nextSpatialNote();
            } else {
                this.scheduleDataToSonify(
                    currData[this._name],
                    this._nextNoteTime
                );
                this.scheduleDataToHighlight(
                    currData,
                    this._currentDataIndex,
                    this._currentDataSeries,
                    this._nextNoteTime - this._audioContext.currentTime
                );
                this.nextNote();
            }
        }

        // If at the end of playback, toggle play and clean up in the future
        if (this._currentDataIndex >= this.dataLength) {
            window.clearInterval(this._timerId);

            window.setTimeout(() => {
                console.log('Delayed playback stop is called');
                this._currentDataIndex = 0;
                if (this._isPlaying) {
                    this.togglePlay();
                }
            }, (this._nextNoteTime - this._audioContext.currentTime) * 1e3);
        }
    }

    notePlay(value: number) {
        this.initSonifierFromUserEvent();

        this._isPlaying = false;

        this.scheduleDataToSonify(value, this._audioContext.currentTime);
    }

    effectPlay(value: string) {
        console.log('bonk called');
        this.initSonifierFromUserEvent();
        this._isPlaying = false;
        switch (value) {
            case 'bonk':
                this.scheduleEffect(
                    this._sounds.bonk,
                    this._audioContext.currentTime
                );
                break;
            case 'drop':
                this.scheduleEffect(
                    this._sounds.drop,
                    this._audioContext.currentTime
                );
                break;
            default:
                break;
        }
    }

    spatialPlay(values: number[]) {
        this.initSonifierFromUserEvent();

        this._isPlaying = false;

        this.scheduleDataToSpatialSonify(
            values,
            this._audioContext.currentTime
        );
    }

    initSonifierFromUserEvent() {
        if (!this._audioContext) {
            this._audioContext = new AudioContext();
        }
        if (!this._compressor) {
            this._compressor = this._audioContext.createDynamicsCompressor();
        }
        if (this._isLocked) {
            // play silent buffer to unlock the audio
            let buffer = this._audioContext.createBuffer(1, 1, 22050);
            let node = this._audioContext.createBufferSource();
            node.buffer = buffer;
            node.start(0);
            this._isLocked = false;
        }
        if (!this._sounds) {
            this._sounds = {};
            this.fetchSound('/assets/media/bonk-sound-effect.mp3').then(
                (value) => {
                    this._sounds.bonk = value;
                }
            );
            this.fetchSound('/assets/media/water-drop-sound.mp3').then(
                (value) => {
                    this._sounds.drop = value;
                }
            );
        }
    }

    fetchSound(url: string): Promise<AudioBuffer> {
        return window
            .fetch(url)
            .then((response: Response) => response.arrayBuffer())
            .then((arrayBuffer: ArrayBuffer) =>
                this._audioContext.decodeAudioData(arrayBuffer)
            );
    }

    togglePlay() {
        this.initSonifierFromUserEvent();

        this._isPlaying = !this._isPlaying;

        if (this._isPlaying) {
            this._audioContext.resume();

            this._nextNoteTime = this._audioContext.currentTime;
            this.scheduler();
            if (this.dataLength > Math.ceil(LOOKAHEAD / NOTE_LENGTH / 1e3)) {
                this._timerId = window.setInterval(
                    this.scheduler.bind(this),
                    LOOKAHEAD * this._speed
                );
            }
        } else {
            window.clearInterval(this._timerId);
            this.cleanUpSonifier();
        }
    }
}

const LOOKAHEAD = 600.0;
const SCHEDULE_AHEAD_TIME = 0.6;

const NOTE_LENGTH = 0.2;

const ISO226dbSPL = [
    93.94, 88.17, 82.63, 77.78, 73.08, 68.48, 64.37, 60.59, 56.7, 53.41, 50.4,
    47.58, 44.98, 43.05, 41.34, 40.06, 40.01, 41.82, 42.51, 39.23,
];

const ISO226fqSPL = [
    25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800,
    1000, 1250, 1600, 2000,
];

const A4 = 440;

const ISO226gnSPL = ISO226dbSPL.map((db) => Math.pow(10, (db - 50) / 10));

export { Sonifier };
