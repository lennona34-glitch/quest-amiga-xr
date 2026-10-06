class EJS_GameManager {
    constructor(Module, EJS) {
        this.EJS = EJS;
        this.Module = Module;
        this.FS = this.Module.FS;
        if (this.FS && this.FS.open && !this.FS.__traced) {
            this.FS.__traced = true;
            const origOpen = this.FS.open;
            this.FS.open = function(path, flags, mode) {
                try {
                    const res = origOpen.apply(this, arguments);
                    if (!path.includes('retroarch.cfg') && !path.includes('content_history') && !path.includes('.glsl')) {
                        console.log('[FS OPEN OK]', path);
                    }
                    return res;
                } catch(e) {
                    console.warn('[FS OPEN FAIL]', path, e.message);
                    throw e;
                }
            };
        }
        this.functions = {
            restart: this.Module.cwrap("system_restart", "", []),
            saveStateInfo: this.Module.cwrap("save_state_info", "string", []),
            loadState: this.Module.cwrap("load_state", "number", ["string", "number"]),
            screenshot: this.Module.cwrap("cmd_take_screenshot", "", []),
            simulateInput: this.Module.cwrap("simulate_input", "null", ["number", "number", "number"]),
            toggleMainLoop: this.Module.cwrap("toggleMainLoop", "null", ["number"]),
            getCoreOptions: this.Module.cwrap("get_core_options", "string", []),
            setVariable: this.Module.cwrap("ejs_set_variable", "null", ["string", "string"]),
            setCheat: this.Module.cwrap("set_cheat", "null", ["number", "number", "string"]),
            resetCheat: this.Module.cwrap("reset_cheat", "null", []),
            toggleShader: this.Module.cwrap("shader_enable", "null", ["number"]),
            getDiskCount: this.Module.cwrap("get_disk_count", "number", []),
            getCurrentDisk: this.Module.cwrap("get_current_disk", "number", []),
            setCurrentDisk: this.Module.cwrap("set_current_disk", "null", ["number"]),
            getSaveFilePath: this.Module.cwrap("save_file_path", "string", []),
            saveSaveFiles: this.Module.cwrap("cmd_savefiles", "", []),
            supportsStates: this.Module.cwrap("supports_states", "number", []),
            loadSaveFiles: this.Module.cwrap("refresh_save_files", "null", []),
            toggleFastForward: this.Module.cwrap("toggle_fastforward", "null", ["number"]),
            setFastForwardRatio: this.Module.cwrap("set_ff_ratio", "null", ["number"]),
            toggleRewind: this.Module.cwrap("toggle_rewind", "null", ["number"]),
            setRewindGranularity: this.Module.cwrap("set_rewind_granularity", "null", ["number"]),
            toggleSlowMotion: this.Module.cwrap("toggle_slow_motion", "null", ["number"]),
            setSlowMotionRatio: this.Module.cwrap("set_sm_ratio", "null", ["number"]),
            getFrameNum: this.Module.cwrap("get_current_frame_count", "number", [""]),
            setVSync: this.Module.cwrap("set_vsync", "null", ["number"]),
            setVideoRoation: this.Module.cwrap("set_video_rotation", "null", ["number"]),
            getVideoDimensions: this.Module.cwrap("get_video_dimensions", "number", ["string"]),
            setKeyboardEnabled: this.Module.cwrap("ejs_set_keyboard_enabled", "null", ["number"])
        }

        this.writeFile("/home/web_user/.config/retroarch/retroarch.cfg", this.getRetroArchCfg());

        this.preWriteCoreOptions();
        this.writeConfigFile();
        this.initShaders();
        this.setupPreLoadSettings();

        this.EJS.on("exit", () => {
            if (!this.EJS.failedToStart) {
                this.saveSaveFiles();
                this.functions.restart();
                this.saveSaveFiles();
            }
            this.toggleMainLoop(0);
            this.FS.unmount("/data/saves");
            setTimeout(() => {
                try {
                    this.Module.abort();
                } catch(e) {
                    console.warn(e);
                };
            }, 1000);
        })
    }
    setupPreLoadSettings() {
        this.Module.callbacks.setupCoreSettingFile = (filePath) => {
            if (this.EJS.debug) console.log("Setting up core settings with path:", filePath);
            this.writeFile(filePath, this.EJS.getCoreSettings());
        }
    }
    mountFileSystems() {
        return new Promise(resolve => {
            try {
                if (!this.FS || !this.FS.filesystems || !this.FS.filesystems.IDBFS) {
                    console.warn('[PUAE DEBUG] IDBFS not available, skipping mount');
                    return resolve();
                }
                this.mkdir("/data");
                this.mkdir("/data/saves");
                try {
                    this.FS.mount(this.FS.filesystems.IDBFS, { autoPersist: true }, "/data/saves");
                } catch(mErr) {
                    console.warn('[PUAE DEBUG] FS.mount IDBFS warning:', mErr);
                }
                let resolved = false;
                const done = () => {
                    if (!resolved) {
                        resolved = true;
                        resolve();
                    }
                };
                const timer = setTimeout(() => {
                    console.warn('[PUAE DEBUG] syncfs timeout, continuing boot...');
                    done();
                }, 1000);

                this.FS.syncfs(true, (err) => {
                    clearTimeout(timer);
                    if (err) console.warn('[PUAE DEBUG] syncfs error:', err);
                    done();
                });
            } catch(e) {
                console.warn('[PUAE DEBUG] mountFileSystems error:', e);
                resolve();
            }
        });
    }
    writeConfigFile() {
        if (!this.EJS.defaultCoreOpts.file || !this.EJS.defaultCoreOpts.settings) {
            return;
        }
        let output = "";
        for (const k in this.EJS.defaultCoreOpts.settings) {
            output += k + ' = "' + this.EJS.defaultCoreOpts.settings[k] + '"\n';
        }

        this.writeFile("/home/web_user/retroarch/userdata/config/" + this.EJS.defaultCoreOpts.file, output);
    }
    preWriteCoreOptions() {
        const coreOpts = this.EJS.getCoreSettings();
        if (!coreOpts) return;

        console.log('[RetroArch Config] Pre-writing core options before core boot:\n' + coreOpts);

        // Pre-write to standard RetroArch option file locations so core initializes with explicit user settings
        this.writeFile("/home/web_user/.config/retroarch/retroarch-core-options.cfg", coreOpts);
        this.writeFile("/home/web_user/retroarch/userdata/config/retroarch-core-options.cfg", coreOpts);
        this.writeFile("/home/web_user/retroarch/userdata/retroarch-core-options.cfg", coreOpts);
        this.writeFile("/retroarch-core-options.cfg", coreOpts);

        const core = (this.EJS.getCore() || '').toLowerCase();
        if (core.includes('puae') || core === 'amiga' || core === 'cd32') {
            this.writeFile("/home/web_user/.config/retroarch/PUAE/PUAE.opt", coreOpts);
            this.writeFile("/home/web_user/.config/retroarch/puae_libretro.opt", coreOpts);
            this.writeFile("/home/web_user/retroarch/userdata/config/PUAE/PUAE.opt", coreOpts);
            this.writeFile("/home/web_user/.config/retroarch/config/PUAE/PUAE.opt", coreOpts);
        } else if (core.includes('x128')) {
            this.writeFile("/home/web_user/.config/retroarch/VICE x128/VICE x128.opt", coreOpts);
            this.writeFile("/home/web_user/.config/retroarch/vice_x128_libretro.opt", coreOpts);
            this.writeFile("/home/web_user/retroarch/userdata/config/VICE x128/VICE x128.opt", coreOpts);

            const vicerc = "[C128]\nDrive8Type=1541\nAutostartPrgMode=1\nAutostartHandleTrueDriveEmulation=0\n";
            const vicercPaths = [
                "/.vice/vicerc",
                "/home/web_user/.vice/vicerc",
                "/home/web_user/retroarch/userdata/system/vice/vicerc",
                "/home/web_user/retroarch/userdata/system/.vice/vicerc",
                "/home/web_user/retroarch/userdata/system/vicerc",
                "/home/web_user/retroarch/system/vice/vicerc",
                "/home/web_user/retroarch/userdata/saves/vicerc",
                "/home/web_user/retroarch/userdata/saves/VICE x128/vicerc",
                "/data/saves/vicerc",
                "/data/saves/VICE x128/vicerc"
            ];
            for (const vp of vicercPaths) {
                try { this.writeFile(vp, vicerc); } catch(e) {}
            }
        } else if (core.includes('x64')) {
            this.writeFile("/home/web_user/.config/retroarch/VICE x64sc/VICE x64sc.opt", coreOpts);
            this.writeFile("/home/web_user/.config/retroarch/vice_x64sc_libretro.opt", coreOpts);
            this.writeFile("/home/web_user/retroarch/userdata/config/VICE x64sc/VICE x64sc.opt", coreOpts);
        }
    }
    loadExternalFiles() {
        return new Promise(async (resolve, reject) => {
            if (this.EJS.config.externalFiles && this.EJS.config.externalFiles.constructor.name === "Object") {
                const fetchedCache = {};
                for (const key in this.EJS.config.externalFiles) {
                    await new Promise(done => {
                        const fileUrl = this.EJS.config.externalFiles[key];
                        const processData = async (fileData) => {
                            let path = key;
                            if (key.trim().endsWith("/")) {
                                const invalidCharacters = /[#<$+%>!`&*'|{}/\\?"=@:^\r\n]/ig;
                                let name = fileUrl.split("/").pop().split("#")[0].split("?")[0].replace(invalidCharacters, "").trim();
                                if (!name) return done();
                                const files = await this.EJS.checkCompression(new Uint8Array(fileData), this.EJS.localization("Decompress Game Assets"));
                                if (files["!!notCompressedData"]) {
                                    path += name;
                                } else {
                                    for (const k in files) {
                                        this.writeFile(path + k, files[k]);
                                    }
                                    return done();
                                }
                            }
                            try {
                                this.writeFile(path, fileData);
                            } catch(e) {
                                if (this.EJS.debug) console.warn("Failed to write file to '" + path + "':", e.message || e);
                            }
                            done();
                        };

                        if (fetchedCache[fileUrl]) {
                            processData(fetchedCache[fileUrl]);
                            return;
                        }

                        this.EJS.downloadFile(fileUrl, null, true, { responseType: "arraybuffer", method: "GET" }).then(async (res) => {
                            if (res === -1 || !res.data) {
                                if (this.EJS.debug) console.warn("Failed to fetch file from '" + fileUrl + "'. Make sure the file exists.");
                                return done();
                            }
                            fetchedCache[fileUrl] = res.data;
                            processData(res.data);
                        });
                    });
                }
            }
            resolve();
        });
    }
    writeFile(path, data) {
        if (data instanceof ArrayBuffer) {
            data = new Uint8Array(data);
        } else if (!(data instanceof Uint8Array) && typeof data === 'object' && data && data.buffer instanceof ArrayBuffer) {
            data = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
        }
        const parts = path.split("/");
        let current = "";
        for (let i = 0; i < parts.length - 1; i++) {
            if (!parts[i].trim()) continue;
            current += "/" + parts[i];
            this.mkdir(current);
        }
        try {
            if (this.FS.analyzePath(path).exists) {
                this.FS.unlink(path);
            }
        } catch(e) {}
        this.FS.writeFile(path, data);
    }
    mkdir(path) {
        try {
            if (!this.FS.analyzePath(path).exists) {
                this.FS.mkdir(path);
            }
        } catch(e) {}
    }
    getRetroArchCfg() {
        let cfg = "autosave_interval = 60\n" +
            "screenshot_directory = \"/\"\n" +
            "system_directory = \"/system\"\n" +
            "core_options_path = \"/home/web_user/.config/retroarch/retroarch-core-options.cfg\"\n" +
            "block_sram_overwrite = false\n" +
            "video_gpu_screenshot = false\n" +
            "audio_latency = 64\n" +
            "video_top_portrait_viewport = true\n" +
            "video_vsync = true\n" +
            "video_smooth = false\n" +
            "fastforward_ratio = 3.0\n" +
            "slowmotion_ratio = 3.0\n" +
            "aspect_ratio_index = 0\n" +
            "video_aspect_ratio_auto = false\n" +
            (this.EJS.rewindEnabled ? "rewind_enable = true\n" : "") +
            (this.EJS.rewindEnabled ? "rewind_granularity = 6\n" : "") +
            "savefile_directory = \"/data/saves\"\n";

        if (this.EJS.retroarchOpts && Array.isArray(this.EJS.retroarchOpts)) {
            this.EJS.retroarchOpts.forEach(option => {
                let selected = this.EJS.preGetSetting(option.name);
                console.log(selected);
                if (!selected) {
                    selected = option.default;
                }
                const value = option.isString === false ? selected : '"' + selected + '"';
                cfg += option.name + " = " + value + "\n"
            })
        }
        return cfg;
    }
    initShaders() {
        if (!this.EJS.config.shaders) return;
        this.mkdir("/shader");
        for (const shaderFileName in this.EJS.config.shaders) {
            const shader = this.EJS.config.shaders[shaderFileName];
            if (typeof shader === "string") {
                this.FS.writeFile(`/shader/${shaderFileName}`, shader);
            } else if (shader && typeof shader === "object") {
                if (shader.shader && shader.shader.value) {
                    const mainVal = shader.shader.type === "base64" ? atob(shader.shader.value) : shader.shader.value;
                    this.FS.writeFile(`/shader/${shaderFileName}`, mainVal);
                }
                if (shader.resources && Array.isArray(shader.resources)) {
                    shader.resources.forEach(res => {
                        const resVal = res.type === "base64" ? atob(res.value) : res.value;
                        this.FS.writeFile(`/shader/${res.name}`, resVal);
                    });
                }
            }
        }
    }
    clearEJSResetTimer() {
        if (this.EJS.resetTimeout) {
            clearTimeout(this.EJS.resetTimeout);
            delete this.EJS.resetTimeout;
        }
    }
    restart() {
        this.clearEJSResetTimer();
        this.functions.restart();
    }
    getState() {
        const state = this.functions.saveStateInfo().split("|");
        if (state[2] !== "1") {
            console.error(state[0]);
            throw new Error(state[0]);
        }
        const size = parseInt(state[0]);
        const dataStart = parseInt(state[1]);
        const data = this.Module.HEAPU8.subarray(dataStart, dataStart + size);
        return new Uint8Array(data);
    }
    loadState(state) {
        try {
            this.FS.unlink("game.state");
        } catch(e) {}
        this.FS.writeFile("/game.state", state);
        this.clearEJSResetTimer();
        this.functions.loadState("game.state", 0);
        setTimeout(() => {
            try {
                this.FS.unlink("game.state");
            } catch(e) {}
        }, 5000)
    }
    screenshot() {
        try {
            this.FS.unlink("screenshot.png");
        } catch(e) {}
        this.functions.screenshot();
        return new Promise(async resolve => {
            while (1) {
                try {
                    this.FS.stat("/screenshot.png");
                    return resolve(this.FS.readFile("/screenshot.png"));
                } catch(e) {}
                await new Promise(res => setTimeout(res, 50));
            }
        })
    }
    quickSave(slot) {
        if (!slot) slot = 1;
        let name = slot + "-quick.state";
        try {
            this.FS.unlink(name);
        } catch(e) {}
        try {
            let data = this.getState();
            this.FS.writeFile("/" + name, data);
        } catch(e) {
            return false;
        }
        return true;
    }
    quickLoad(slot) {
        if (!slot) slot = 1;
        (async () => {
            let name = slot + "-quick.state";
            this.clearEJSResetTimer();
            this.functions.loadState(name, 0);
        })();
    }
    simulateInput(player, index, value) {
        if (this.EJS.isNetplay) {
            this.EJS.netplay.simulateInput(player, index, value);
            return;
        }
        if ([24, 25, 26, 27, 28, 29].includes(index)) {
            if (index === 24 && value === 1) {
                const slot = this.EJS.settings["save-state-slot"] ? this.EJS.settings["save-state-slot"] : "1";
                if (this.quickSave(slot)) {
                    this.EJS.displayMessage(this.EJS.localization("SAVED STATE TO SLOT") + " " + slot);
                } else {
                    this.EJS.displayMessage(this.EJS.localization("FAILED TO SAVE STATE"));
                }
            }
            if (index === 25 && value === 1) {
                const slot = this.EJS.settings["save-state-slot"] ? this.EJS.settings["save-state-slot"] : "1";
                this.quickLoad(slot);
                this.EJS.displayMessage(this.EJS.localization("LOADED STATE FROM SLOT") + " " + slot);
            }
            if (index === 26 && value === 1) {
                let newSlot;
                try {
                    newSlot = parseFloat(this.EJS.settings["save-state-slot"] ? this.EJS.settings["save-state-slot"] : "1") + 1;
                } catch(e) {
                    newSlot = 1;
                }
                if (newSlot > 9) newSlot = 1;
                this.EJS.displayMessage(this.EJS.localization("SET SAVE STATE SLOT TO") + " " + newSlot);
                this.EJS.changeSettingOption("save-state-slot", newSlot.toString());
            }
            if (index === 27) {
                this.functions.toggleFastForward(this.EJS.isFastForward ? !value : value);
            }
            if (index === 29) {
                this.functions.toggleSlowMotion(this.EJS.isSlowMotion ? !value : value);
            }
            if (index === 28) {
                if (this.EJS.rewindEnabled) {
                    this.functions.toggleRewind(value);
                }
            }
            return;
        }
        this.functions.simulateInput(player, index, value);
    }
    getFileNames() {
        if (this.EJS.getCore() === "picodrive") {
            return ["bin", "gen", "smd", "md", "32x", "cue", "iso", "sms", "68k", "chd"];
        } else {
            return ["toc", "ccd", "exe", "pbp", "chd", "img", "bin", "iso"];
        }
    }
    createCueFile(fileNames) {
        try {
            if (fileNames.length > 1) {
                fileNames = fileNames.filter((item) => {
                    return this.getFileNames().includes(item.split(".").pop().toLowerCase());
                })
                fileNames = fileNames.sort((a, b) => {
                    if (isNaN(a.charAt()) || isNaN(b.charAt())) throw new Error("Incorrect file name format");
                    return (parseInt(a.charAt()) > parseInt(b.charAt())) ? 1 : -1;
                })
            }
        } catch(e) {
            if (fileNames.length > 1) {
                console.warn("Could not auto-create cue file(s).");
                return null;
            }
        }
        for (let i = 0; i < fileNames.length; i++) {
            if (fileNames[i].split(".").pop().toLowerCase() === "ccd") {
                console.warn("Did not auto-create cue file(s). Found a ccd.");
                return null;
            }
        }
        if (fileNames.length === 0) {
            console.warn("Could not auto-create cue file(s).");
            return null;
        }
        let baseFileName = fileNames[0].split("/").pop();
        if (baseFileName.includes(".")) {
            baseFileName = baseFileName.substring(0, baseFileName.length - baseFileName.split(".").pop().length - 1);
        }
        for (let i = 0; i < fileNames.length; i++) {
            const contents = " FILE \"" + fileNames[i] + "\" BINARY\n  TRACK 01 MODE1/2352\n   INDEX 01 00:00:00";
            this.FS.writeFile("/" + baseFileName + "-" + i + ".cue", contents);
        }
        if (fileNames.length > 1) {
            let contents = "";
            for (let i = 0; i < fileNames.length; i++) {
                contents += "/" + baseFileName + "-" + i + ".cue\n";
            }
            this.FS.writeFile("/" + baseFileName + ".m3u", contents);
        }
        return (fileNames.length === 1) ? baseFileName + "-0.cue" : baseFileName + ".m3u";
    }
    loadPpssppAssets() {
        return new Promise(resolve => {
            this.EJS.downloadFile("cores/ppsspp-assets.zip", null, false, { responseType: "arraybuffer", method: "GET" }).then((res) => {
                this.EJS.checkCompression(new Uint8Array(res.data), this.EJS.localization("Decompress Game Data")).then((pspassets) => {
                    if (pspassets === -1) {
                        this.EJS.textElem.innerText = this.localization("Network Error");
                        this.EJS.textElem.style.color = "red";
                        return;
                    }
                    this.mkdir("/PPSSPP");

                    for (const file in pspassets) {
                        const data = pspassets[file];
                        const path = "/PPSSPP/" + file;
                        const paths = path.split("/");
                        let cp = "";
                        for (let i = 0; i < paths.length - 1; i++) {
                            if (paths[i] === "") continue;
                            cp += "/" + paths[i];
                            if (!this.FS.analyzePath(cp).exists) {
                                this.FS.mkdir(cp);
                            }
                        }
                        if (!path.endsWith("/")) {
                            this.FS.writeFile(path, data);
                        }
                    }
                    resolve();
                })
            });
        })
    }
    setVSync(enabled) {
        this.functions.setVSync(enabled);
    }
    toggleMainLoop(playing) {
        this.functions.toggleMainLoop(playing);
    }
    getCoreOptions() {
        return this.functions.getCoreOptions();
    }
    setVariable(option, value) {
        this.functions.setVariable(option, value);
    }
    setCheat(index, enabled, code) {
        this.functions.setCheat(index, enabled, code);
    }
    resetCheat() {
        this.functions.resetCheat();
    }
    toggleShader(active) {
        this.functions.toggleShader(active);
    }
    getDiskCount() {
        return this.functions.getDiskCount();
    }
    getCurrentDisk() {
        return this.functions.getCurrentDisk();
    }
    setCurrentDisk(disk) {
        this.functions.setCurrentDisk(disk);
    }
    getSaveFilePath() {
        return this.functions.getSaveFilePath();
    }
    saveSaveFiles() {
        this.functions.saveSaveFiles();
        this.EJS.callEvent("saveSaveFiles", this.getSaveFile(false));
        //this.FS.syncfs(false, () => {});
    }
    supportsStates() {
        return !!this.functions.supportsStates();
    }
    getSaveFile(save) {
        if (save !== false) {
            this.saveSaveFiles();
        }
        const exists = this.FS.analyzePath(this.getSaveFilePath()).exists;
        return (exists ? this.FS.readFile(this.getSaveFilePath()) : null);
    }
    loadSaveFiles() {
        this.clearEJSResetTimer();
        this.functions.loadSaveFiles();
    }
    setFastForwardRatio(ratio) {
        this.functions.setFastForwardRatio(ratio);
    }
    toggleFastForward(active) {
        this.functions.toggleFastForward(active);
    }
    setSlowMotionRatio(ratio) {
        this.functions.setSlowMotionRatio(ratio);
    }
    toggleSlowMotion(active) {
        this.functions.toggleSlowMotion(active);
    }
    setRewindGranularity(value) {
        this.functions.setRewindGranularity(value);
    }
    getFrameNum() {
        return this.functions.getFrameNum();
    }
    setVideoRotation(rotation) {
        this.functions.setVideoRoation(rotation);
    }
    getVideoDimensions(type) {
        try {
            return this.functions.getVideoDimensions(type);
        } catch(e) {
            console.warn(e);
        }
    }
    setKeyboardEnabled(enabled) {
        this.functions.setKeyboardEnabled(enabled === true ? 1 : 0);
    }
    setAltKeyEnabled(enabled) {
        this.functions.setKeyboardEnabled(enabled === true ? 3 : 2);
    }
}

window.EJS_GameManager = EJS_GameManager;
