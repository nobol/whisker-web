const EventEmitter = require('events');

const ScratchStorage = require('scratch-storage');
const ScratchRender = require('scratch-render');
const ScratchSVGRenderer = require('scratch-svg-renderer');
const AudioEngine = require('scratch-audio');
const VirtualMachine = require('scratch-vm');

const ASSET_SERVER = 'https://cdn.assets.scratch.mit.edu';
const PROJECT_SERVER = 'https://cdn.projects.scratch.mit.edu';

/**
 * <canvas></canvas>
 */
class Scratch extends EventEmitter {
    constructor (canvas) {
        super();
        this.canvas = canvas;
        this.vm = Scratch.prepareVM(this.canvas);
        this.project = null;

        this._onMouseMove = this.onMouseMove.bind(this);
        this._onMouseDown = this.onMouseDown.bind(this);
        this._onMouseUp = this.onMouseUp.bind(this);
        this._onKeyDown = this.onKeyDown.bind(this);
        this._onKeyUp = this.onKeyUp.bind(this);
    }

    async loadProject (project) {
        this.project = project;
        this.vm.clear();
        await this.vm.loadProject(project);
        this.vm.runtime._step();
    }

    async reset () {
        return await this.loadProject(this.project);
    }

    start () {
        clearInterval(this.vm.runtime._steppingInterval);
        this.vm.start();
    }

    greenFlag () {
        this.start();
        this.vm.greenFlag();
    }

    stop () {
        clearInterval(this.vm.runtime._steppingInterval);
        this.vm.runtime._steppingInterval = -1;
        this.vm.stopAll();
        this.vm.runtime._step();
    }

    enableInput () {
        this.canvas.addEventListener('mousemove', this._onMouseMove);
        this.canvas.addEventListener('mousedown', this._onMouseDown);
        this.canvas.addEventListener('mouseup', this._onMouseUp);
        this.canvas.addEventListener('keydown', this._onKeyDown);
        this.canvas.addEventListener('keyup', this._onKeyUp);
    }

    disableInput () {
        this.canvas.removeEventListener('mousemove', this._onMouseMove);
        this.canvas.removeEventListener('mousedown', this._onMouseDown);
        this.canvas.removeEventListener('mouseup', this._onMouseUp);
        this.canvas.removeEventListener('keydown', this._onKeyDown);
        this.canvas.removeEventListener('keyup', this._onKeyUp);
    }

    static prepareVM (canvas) {
        const storage = new ScratchStorage();
        const AssetType = storage.AssetType;
        storage.addWebStore([AssetType.Project], Scratch.getProjectUrl, Scratch.getProjectUrl,
            Scratch.getProjectUrl);
        storage.addWebStore([AssetType.ImageVector, AssetType.ImageBitmap, AssetType.Sound], Scratch.getAssetUrl,
            Scratch.getAssetUrl, Scratch.getAssetUrl);

        const renderer = new ScratchRender(canvas);
        const audioEngine = new AudioEngine();
        const SVGAdapter = new ScratchSVGRenderer.SVGRenderer();
        const bitmapAdapter = new ScratchSVGRenderer.BitmapAdapter();

        const vm = new VirtualMachine();
        vm.attachRenderer(renderer);
        vm.attachAudioEngine(audioEngine);
        vm.attachStorage(storage);
        vm.attachV2SVGAdapter(SVGAdapter);
        vm.attachV2BitmapAdapter(bitmapAdapter);
        vm.runtime.setCompatibilityMode(true);

        return vm;
    }

    static getProjectUrl (asset) {
        const assetIdParts = asset.assetId.split('.');
        const assetUrlParts = [PROJECT_SERVER, '/internalapi/project/', assetIdParts[0], '/get/'];
        if (assetIdParts[1]) {
            assetUrlParts.push(assetIdParts[1]);
        }
        return assetUrlParts.join('');
    }

    static getAssetUrl (asset) {
        const assetUrlParts = [
            ASSET_SERVER,
            '/internalapi/asset/',
            asset.assetId,
            '.',
            asset.dataFormat,
            '/get/'
        ];
        return assetUrlParts.join('');
    }

    onMouseMove (e) {
        e.preventDefault();
        this.canvas.focus();
        const rect = this.canvas.getBoundingClientRect();
        const data = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
            canvasWidth: rect.width,
            canvasHeight: rect.height
        };
        this.vm.postIOData('mouse', data);
        this.emit('input', {device: 'mouse', ...data});
    }

    onMouseDown (e) {
        e.preventDefault();
        this.canvas.focus();
        const rect = this.canvas.getBoundingClientRect();
        const data = {
            isDown: true,
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
            canvasWidth: rect.width,
            canvasHeight: rect.height
        };
        this.vm.postIOData('mouse', data);
        this.emit('input', {device: 'mouse', ...data});
    }

    onMouseUp (e) {
        e.preventDefault();
        this.canvas.focus();
        const rect = this.canvas.getBoundingClientRect();
        const data = {
            isDown: false,
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
            canvasWidth: rect.width,
            canvasHeight: rect.height
        };
        this.vm.postIOData('mouse', data);
        this.emit('input', {device: 'mouse', ...data});
    }

    onKeyDown (e) {
        e.preventDefault();
        const data = {
            keyCode: e.keyCode,
            key: e.key,
            isDown: true
        };
        this.vm.postIOData('keyboard', data);
        this.emit('input', {device: 'keyboard', ...data});
    }

    onKeyUp (e) {
        e.preventDefault();
        const data = {
            key: e.key,
            isDown: false
        };
        this.vm.postIOData('keyboard', data);
        this.emit('input', {device: 'keyboard', ...data});
    }
}

module.exports = Scratch;
