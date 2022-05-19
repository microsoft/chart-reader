import * as d3 from 'd3';

class Sonifier {
    constructor(onPlayData) {
        this._nextNoteTime = 0.0;
        this._currentDataIndex = 0;
        this._data = [];
        this._name = '';
        this._gainNodeQueue = [];
        this._highlightTimerQueue = [];
        this._timerId = -1;
        this._isLocked = true;
        this._isPlaying = false;
        this._audioContext = undefined;
        this._onPlayData = onPlayData;
        this._scales = {
            normalize: d3.scaleLinear().range([0, 1]),
            gain: d3.scaleLinear().domain(ISO226fqSPL).range(ISO226gnSPL),
        };
    }

    get isPlaying() {
        return this._isPlaying;
    }

    updateData(data, name) {
        this._data = data;
        this._name = name;
        this._currentDataIndex = 0;
        // TODO only set domain once
        this._scales.normalize.domain(d3.extent(data, (d) => d[this._name]));
    }

    scheduleDataToSonify(value, i, time) {
        let normalized = this._scales.normalize(value),
            noteNumber = normalized * 44 + 40, // Between 1 to 88
            frequency = A4 * Math.pow(2, (noteNumber - 49) / 12),
            g = Math.min(2.5, Math.max(0.2, this._scales.gain(frequency)));

        let oscillator = this._audioContext.createOscillator(),
            gain = this._audioContext.createGain();
        oscillator.connect(gain);
        gain.connect(this._compressor);
        this._compressor.connect(this._audioContext.destination);

        oscillator.frequency.value = frequency;
        oscillator.type = 'triangle';
        oscillator.start(time);

        gain.gain.setValueAtTime(0.00001, time);
        gain.gain.exponentialRampToValueAtTime(g, time + NOTE_LENGTH * 0.1);
        gain.gain.setValueAtTime(g, time + NOTE_LENGTH * 0.5);
        gain.gain.exponentialRampToValueAtTime(
            0.00001,
            time + NOTE_LENGTH * 0.6
        );

        this._gainNodeQueue.push(gain);

        if (this._gainNodeQueue.length > 4) {
            this._gainNodeQueue = this._gainNodeQueue.slice(1, 5);
        }

        oscillator.stop(time + NOTE_LENGTH);
    }

    scheduleDataToHighlight = (d, i, time) => {
        console.log({ d, i, time });

        let highlightTimerId = setTimeout(() => {
            this._onPlayData(d, i);

            let timerIndex =
                this._highlightTimerQueue.indexOf(highlightTimerId);
            if (timerIndex > -1) {
                this._highlightTimerQueue.splice(timerIndex, 1);
            }
        }, time * 1e3);
        this._highlightTimerQueue.push(highlightTimerId);
    };

    nextNote() {
        this._nextNoteTime += NOTE_LENGTH;
        this._currentDataIndex++;
    }

    cleanUpSonifier() {
        // Come up with a way to turn off all nodes playing
        this._gainNodeQueue.forEach((gain) => {
            console.log('clean up gain node');
            gain.gain.cancelScheduledValues(this._audioContext.currentTime);
            gain.gain.exponentialRampToValueAtTime(
                0.00001,
                this._audioContext.currentTime + NOTE_LENGTH
            );
        });
        this._highlightTimerQueue.forEach((highlightTimerId) => {
            clearTimeout(highlightTimerId);
        });
        this._gainNodeQueue = [];
        this._highlightTimerQueue = [];
    }

    scheduler() {
        console.log(this);
        while (
            this._nextNoteTime <
                this._audioContext.currentTime + SCHEDULE_AHEAD_TIME &&
            this._currentDataIndex < this._data.length
        ) {
            this.scheduleDataToSonify(
                this._data[this._currentDataIndex][this._name],
                this._currentDataIndex,
                this._nextNoteTime
            );
            this.scheduleDataToHighlight(
                this._data[this._currentDataIndex],
                this._currentDataIndex,
                this._nextNoteTime - this._audioContext.currentTime
            );
            this.nextNote();
        }

        // If at the end of playback, toggle play and clean up in the future
        if (this._currentDataIndex >= this._data.length) {
            clearInterval(this._timerId);

            setTimeout(() => {
                console.log('Delayed playback stop is called');
                this._currentDataIndex = 0;
                this.togglePlay();
            }, (this._nextNoteTime - this._audioContext.currentTime) * 1e3);
        }
    }

    togglePlay() {
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

        this._isPlaying = !this._isPlaying;

        if (this._isPlaying) {
            this._audioContext.resume();

            this._nextNoteTime = this._audioContext.currentTime;
            this.scheduler();

            if (this._data.length > Math.ceil(LOOKAHEAD / NOTE_LENGTH / 1e3)) {
                this._timerId = setInterval(this.scheduler.bind(this), LOOKAHEAD);
            }
        } else {
            clearInterval(this._timerId);
            this.cleanUpSonifier();
        }
        // console.log(
        //     this._timerId,
        //     this._isPlaying,
        //     this._currentDataIndex
        // );
    }
}

const LOOKAHEAD = 1500.0;
const SCHEDULE_AHEAD_TIME = 1.5;

const NOTE_LENGTH = 0.5;

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
