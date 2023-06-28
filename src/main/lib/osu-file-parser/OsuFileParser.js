import fs from 'fs';
import readline from 'readline';
import path from 'path';
import getAudioDurationInSeconds from 'get-audio-duration';
import { WatchFile } from './WatchFile';
import { none, some } from '../rust-like-utils-backend/Optional';
import { fail, ok } from '../rust-like-utils-backend/Result';
const bgFileNameRegex = /.*"(?<!Video.*)(.*)".*/;
const beatmapSetIDRegex = /([0-9]+) .*/;
const propertiesMap = new Map([
    ['AudioFilename', 'audioSrc'],
    ['BeatmapSetID', 'beatmapSetID'],
    ['Title', 'title'],
    ['TitleUnicode', 'titleUnicode'],
    ['Artist', 'artist'],
    ['ArtistUnicode', 'artistUnicode'],
    ['Creator', 'creator'],
    ['Tags', 'tags'],
    ['Mode', 'mode']
]);
const OFFSET = 0;
const BPM = 1;
const audioSourceNotFound = 'Audio does not exists.';
export class OsuFileParser {
    file;
    audioSourceToken = 'AudioFilename: ';
    constructor(file) {
        this.file = file;
    }
    static new(file) {
        if (!fs.existsSync(file)) {
            return none();
        }
        return some(new OsuFileParser(file));
    }
    static async parseSong(osuFile, obj) {
        const config = WatchFile.new(osuFile);
        if (config.isError) {
            return fail(config.error);
        }
        obj.config = config.value;
        if (obj.audioSrc === undefined) {
            return fail(audioSourceNotFound);
        }
        obj.dir = path.dirname(osuFile);
        obj.id = path.join(obj.dir, obj.audioSrc);
        const audio = WatchFile.new(obj.id);
        if (audio.isError) {
            return fail(audio.error);
        }
        obj.audio = audio.value;
        delete obj.audioSrc;
        if (obj.bgSrc !== undefined) {
            const bg = WatchFile.new(path.join(obj.dir, obj.bgSrc));
            if (!bg.isError) {
                obj.bg = bg.value;
                delete obj.bgSrc;
            }
        }
        if (obj.mode !== undefined) {
            obj.mode = Number(obj.mode);
        }
        if (obj.beatmapSetID !== undefined) {
            obj.beatmapSetID = Number(obj.beatmapSetID);
        }
        if (typeof obj.tags === 'string') {
            obj.tags = obj.tags.split(' ');
        }
        if (obj.beatmapSetID === undefined) {
            const beatmapSetID = beatmapSetIDRegex.exec(path.basename(obj.dir));
            if (beatmapSetID !== null) {
                obj.beatmapSetID = Number(beatmapSetID[1]);
            }
        }
        obj.duration = await getAudioDurationInSeconds(obj.id);
        return ok(obj);
    }
    static async parseDir(dir, update) {
        if (!fs.existsSync(dir)) {
            return fail('Directory does not exists.');
        }
        const dirs = fs.readdirSync(dir);
        const audioSources = new Set();
        const songs = new Map();
        for (let i = 0; i < dirs.length; i++) {
            if (update !== undefined) {
                update.value = {
                    i: i + 1,
                    total: dirs.length
                };
            }
            const subDirPath = path.join(dir, dirs[i]);
            if (!fs.lstatSync(subDirPath).isDirectory()) {
                continue;
            }
            const files = fs.readdirSync(subDirPath);
            for (let j = 0; j < files.length; j++) {
                if (!files[j].endsWith('.osu')) {
                    continue;
                }
                const parser = OsuFileParser.new(path.join(subDirPath, files[j]));
                if (parser.isNone) {
                    continue;
                }
                const audioSource = parser.value.getAudioSource();
                if (audioSource.isNone || audioSources.has(audioSource.value)) {
                    continue;
                }
                const song = await parser.value.parseFile();
                if (song.isError) {
                    continue;
                }
                songs.set(song.value.id, song.value);
                audioSources.add(audioSource.value);
            }
        }
        return ok(songs);
    }
    getAudioSource() {
        const content = fs.readFileSync(this.file, { encoding: 'utf8' });
        const start = content.indexOf(this.audioSourceToken) + this.audioSourceToken.length;
        for (let i = start; i < content.length; i++) {
            if (content[i] === '\n'
                || content[i] === '\r'
                || (content[i] === '\r' && content[i + 1] === '\n')) {
                return some(content.substring(start, i));
            }
        }
        return none();
    }
    async parseFile() {
        const fileLines = readline.createInterface({
            input: fs.createReadStream(this.file),
            crlfDelay: Infinity
        });
        let state = 'Initial';
        const song = {};
        song.bpm = [];
        for await (const line of fileLines) {
            const trimmed = line.trim();
            if (trimmed === '') {
                continue;
            }
            if (trimmed[0] === '[' && trimmed[trimmed.length - 1] === ']') {
                state = trimmed.substring(1, trimmed.length - 1);
                if (state === 'HitObjects') {
                    break;
                }
                continue;
            }
            if (state === 'Initial' || state === 'Editor' || state === 'Difficulty' || state === 'Colours') {
                continue;
            }
            if (state === 'Events') {
                const bg = bgFileNameRegex.exec(trimmed);
                if (bg !== null) {
                    song['bgSrc'] = bg[1];
                }
                continue;
            }
            if (state === 'TimingPoints') {
                const timingPoint = trimmed.split(',').map(x => Number(x));
                if (timingPoint.length === 2) {
                    song.bpm.push(timingPoint);
                    continue;
                }
                if (timingPoint[timingPoint.length - 2] === 0) {
                    continue;
                }
                if (song.bpm.length !== 0 && song.bpm[song.bpm.length - 1][BPM] === timingPoint[BPM]) {
                    continue;
                }
                song.bpm.push([timingPoint[OFFSET], timingPoint[BPM]]);
            }
            const useSpaceAfterColon = state === 'General';
            const split = trimmed.split(useSpaceAfterColon ? ': ' : ':');
            if (split.length !== 2) {
                continue;
            }
            const property = propertiesMap.get(split[0]);
            if (property === undefined) {
                continue;
            }
            song[property] = split[1];
        }
        return await OsuFileParser.parseSong(this.file, song);
    }
}