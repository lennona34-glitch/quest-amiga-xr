class EJS_COMPRESSION {
    constructor(EJS) {
        this.EJS = EJS;
    }
    isCompressed(data) { //https://www.garykessler.net/library/file_sigs.html
        //todo. Use hex instead of numbers
        if ((data[0] === 80 && data[1] === 75) && ((data[2] === 3 && data[3] === 4) || (data[2] === 5 && data[3] === 6) || (data[2] === 7 && data[3] === 8))) {
            return "zip";
        } else if (data[0] === 55 && data[1] === 122 && data[2] === 188 && data[3] === 175 && data[4] === 39 && data[5] === 28) {
            return "7z";
        } else if ((data[0] === 82 && data[1] === 97 && data[2] === 114 && data[3] === 33 && data[4] === 26 && data[5] === 7) && ((data[6] === 0) || (data[6] === 1 && data[7] == 0))) {
            return "rar";
        }
        return null;
    }
    async fastUnzip(data, updateMsg, fileCbFunc) {
        const buffer = data;
        const files = {};
        const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
        let off = 0;
        const totalLen = buffer.length;

        while (off < totalLen - 4) {
            const sig = view.getUint32(off, true);
            if (sig === 0x04034b50) { // Local file header
                const method = view.getUint16(off + 8, true);
                const compSize = view.getUint32(off + 18, true);
                const uncompSize = view.getUint32(off + 22, true);
                const fnLen = view.getUint16(off + 26, true);
                const extraLen = view.getUint16(off + 28, true);
                const name = new TextDecoder('utf-8').decode(buffer.subarray(off + 30, off + 30 + fnLen));
                const dataStart = off + 30 + fnLen + extraLen;
                const compData = buffer.subarray(dataStart, dataStart + compSize);

                let uncompressed;
                if (method === 0) {
                    uncompressed = compData;
                } else if (method === 8) {
                    if (typeof DecompressionStream === 'function') {
                        const stream = new Response(compData).body.pipeThrough(new DecompressionStream('deflate-raw'));
                        const res = await new Response(stream).arrayBuffer();
                        uncompressed = new Uint8Array(res);
                    } else {
                        throw new Error('DecompressionStream not supported');
                    }
                } else {
                    throw new Error(`Unsupported ZIP compression method: ${method}`);
                }

                if (typeof fileCbFunc === 'function') {
                    await fileCbFunc(name, uncompressed);
                    files[name] = true;
                } else {
                    files[name] = uncompressed;
                }

                off = dataStart + compSize;
                if (typeof updateMsg === 'function') {
                    const pct = Math.min(100, Math.floor((off / totalLen) * 100));
                    updateMsg(` ${pct}%`, true);
                    await new Promise(r => setTimeout(r, 0));
                }
            } else if (sig === 0x02014b50 || sig === 0x06054b50) {
                // Central directory or End of Central Directory reached
                break;
            } else {
                off++;
            }
        }
        if (typeof updateMsg === 'function') {
            updateMsg(' 100%', true);
            await new Promise(r => setTimeout(r, 0));
        }
        return files;
    }
    async decompress(data, updateMsg, fileCbFunc) {
        const compressed = this.isCompressed(data.slice(0, 10));
        console.log('[COMPRESSION DEBUG] isCompressed returned:', compressed, 'data len:', data.length);
        if (compressed === null) {
            if (typeof fileCbFunc === "function") {
                await fileCbFunc("!!notCompressedData", data);
            }
            return { "!!notCompressedData": data };
        }
        if (compressed === "zip") {
            try {
                return await this.fastUnzip(data, updateMsg, fileCbFunc);
            } catch (err) {
                console.warn('[EmulatorJS] Fast unzip failed, falling back to worker:', err.message);
                return this.decompressFile(compressed, data, updateMsg, fileCbFunc);
            }
        }
        return this.decompressFile(compressed, data, updateMsg, fileCbFunc);
    }
    getWorkerFile(method) {
        return new Promise(async (resolve, reject) => {
            let path, obj;
            if (method === "7z") {
                path = "compression/extract7z.js";
                obj = "sevenZip";
            } else if (method === "zip") {
                path = "compression/extractzip.js";
                obj = "zip";
            } else if (method === "rar") {
                path = "compression/libunrar.js";
                obj = "rar";
            }
            const res = await this.EJS.downloadFile(path, null, false, { responseType: "text", method: "GET" });
            if (res === -1) {
                this.EJS.startGameError(this.EJS.localization("Network Error"));
                return;
            }
            if (method === "rar") {
                const res2 = await this.EJS.downloadFile("compression/libunrar.wasm", null, false, { responseType: "arraybuffer", method: "GET" });
                if (res2 === -1) {
                    this.EJS.startGameError(this.EJS.localization("Network Error"));
                    return;
                }
                const path = URL.createObjectURL(new Blob([res2.data], { type: "application/wasm" }));
                let script = `
                    let dataToPass = [];
                    Module = {
                        monitorRunDependencies: function(left) {
                            if (left == 0) {
                                setTimeout(function() {
                                    unrar(dataToPass, null);
                                }, 100);
                            }
                        },
                        onRuntimeInitialized: function() {},
                        locateFile: function(file) {
                            console.log("locateFile");
                            return "` + path + `";
                        }
                    };
                    ` + res.data + `
                    let unrar = function(data, password) {
                        let cb = function(fileName, fileSize, progress) {
                            postMessage({ "t": 4, "current": progress, "total": fileSize, "name": fileName });
                        };
                        let rarContent = readRARContent(data.map(function(d) {
                            return {
                                name: d.name,
                                content: new Uint8Array(d.content)
                            }
                        }), password, cb)
                        let rec = function(entry) {
                            if (!entry) return;
                            if (entry.type === "file") {
                                postMessage({ "t": 2, "file": entry.fullFileName, "size": entry.fileSize, "data": entry.fileContent });
                            } else if (entry.type === "dir") {
                                Object.keys(entry.ls).forEach(function(k) {
                                    rec(entry.ls[k]);
                                });
                            } else {
                                throw "Unknown type";
                            }
                        }
                        rec(rarContent);
                        postMessage({ "t": 1 });
                        return rarContent;
                    };
                    onmessage = function(data) {
                        dataToPass.push({ name: "test.rar", content: data.data });
                    };
                `;
                const blob = new Blob([script], {
                    type: "application/javascript"
                })
                resolve(blob);
            } else {
                const blob = new Blob([res.data], {
                    type: "application/javascript"
                })
                resolve(blob);
            }
        })
    }
    decompressFile(method, data, updateMsg, fileCbFunc) {
        return new Promise(async callback => {
            const file = await this.getWorkerFile(method);
            const worker = new Worker(URL.createObjectURL(file));
            const files = {};
            worker.onmessage = (data) => {
                if (!data.data) return;
                //data.data.t/ 4=progress, 2 is file, 1 is zip done
                if (data.data.t === 4) {
                    const pg = data.data;
                    const num = Math.floor(pg.current / pg.total * 100);
                    if (isNaN(num)) return;
                    const progress = " " + num.toString() + "%";
                    updateMsg(progress, true);
                }
                if (data.data.t === 2) {
                    if (typeof fileCbFunc === "function") {
                        fileCbFunc(data.data.file, data.data.data);
                        files[data.data.file] = true;
                    } else {
                        files[data.data.file] = data.data.data;
                    }
                }
                if (data.data.t === 1) {
                    callback(files);
                }
            }
            worker.postMessage(data);
        });
    }
}

window.EJS_COMPRESSION = EJS_COMPRESSION;
