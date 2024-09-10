"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var video_exports = {};
__export(video_exports, {
  StreamInput: () => StreamInput,
  StreamOutput: () => StreamOutput,
  ffmpegPreviewImage: () => ffmpegPreviewImage,
  ffmpegStreamToGo2rtc: () => ffmpegStreamToGo2rtc,
  ffmpegStreamToHls: () => ffmpegStreamToHls,
  streamToGo2rtc: () => streamToGo2rtc
});
module.exports = __toCommonJS(video_exports);
var import_net = __toESM(require("net"));
var import_path = __toESM(require("path"));
var import_fluent_ffmpeg = __toESM(require("@bropat/fluent-ffmpeg"));
var import_ffmpeg_for_homebridge = __toESM(require("ffmpeg-for-homebridge"));
var import_eufy_security_client = require("eufy-security-client");
var import_os = require("os");
var import_fs_extra = __toESM(require("fs-extra"));
var import_node_stream = __toESM(require("node:stream"));
var import_promises = require("node:stream/promises");
var import_utils = require("./utils");
class UniversalStream {
  url;
  static socks = /* @__PURE__ */ new Set();
  server;
  sock_id;
  constructor(namespace, onSocket) {
    let sockpath = "";
    const unique_sock_id = (0, import_utils.lowestUnusedNumber)([...UniversalStream.socks], 1);
    UniversalStream.socks.add(unique_sock_id);
    this.sock_id = unique_sock_id;
    if (process.platform === "win32") {
      const pipePrefix = "\\\\.\\pipe\\";
      const pipeName = `node-webrtc.${namespace}.${unique_sock_id}.sock`;
      sockpath = import_path.default.join(pipePrefix, pipeName);
      this.url = sockpath;
    } else {
      const pipeName = `${namespace}.${unique_sock_id}.sock`;
      sockpath = import_path.default.join((0, import_os.tmpdir)(), pipeName);
      this.url = "unix:" + sockpath;
      try {
        if (import_fs_extra.default.existsSync(sockpath))
          import_fs_extra.default.unlinkSync(sockpath);
      } catch (error) {
      }
    }
    this.server = import_net.default.createServer(onSocket);
    this.server.listen(sockpath);
    this.server.on("error", () => {
    });
  }
  close() {
    if (this.server)
      this.server.close();
    UniversalStream.socks.delete(this.sock_id);
  }
}
const StreamInput = function(namespace, stream2) {
  return new UniversalStream(namespace, (socket) => stream2.pipe(socket, { end: true }).on("error", (_error) => {
  }));
};
const StreamOutput = function(namespace, stream2) {
  return new UniversalStream(namespace, (socket) => socket.pipe(stream2, { end: true }).on("error", (_error) => {
  }));
};
const ffmpegPreviewImage = (config, input, output, log, skip_seconds = 2) => {
  return new Promise((resolve, reject) => {
    try {
      if (import_ffmpeg_for_homebridge.default) {
        import_fluent_ffmpeg.default.setFfmpegPath(import_ffmpeg_for_homebridge.default);
        (0, import_fluent_ffmpeg.default)().withProcessOptions({
          detached: true
        }).addOptions([
          `-ss ${skip_seconds}`,
          "-frames:v 1"
        ]).input(input).inputFormat("hls").outputFormat("image2").output(output).on("error", function(err, stdout, stderr) {
          log.error(`ffmpegPreviewImage(): An error occurred: ${err.message}`);
          log.error(`ffmpegPreviewImage(): ffmpeg output:
${stdout}`);
          log.error(`ffmpegPreviewImage(): ffmpeg stderr:
${stderr}`);
          reject(err);
        }).on("end", () => {
          log.debug("ffmpegPreviewImage(): Preview image generated!");
          resolve();
        }).run();
      } else {
        reject(new Error("ffmpeg binary not found"));
      }
    } catch (error) {
      log.error(`ffmpegPreviewImage(): Error: ${error}`);
      reject(error);
    }
  });
};
const ffmpegStreamToHls = (config, namespace, metadata, videoStream, audioStream, output, log) => {
  return new Promise((resolve, reject) => {
    try {
      if (import_ffmpeg_for_homebridge.default) {
        import_fluent_ffmpeg.default.setFfmpegPath(import_ffmpeg_for_homebridge.default);
        videoStream.on("error", (error) => {
          log.error("ffmpegStreamToHls(): Videostream Error", error);
        });
        audioStream.on("error", (error) => {
          log.error("ffmpegStreamToHls(): Audiostream Error", error);
        });
        const uVideoStream = StreamInput(namespace, videoStream);
        const uAudioStream = StreamInput(namespace, audioStream);
        let videoFormat = "h264";
        let audioFormat = "";
        const options = [
          "-hls_init_time 0",
          "-hls_time 2",
          "-hls_segment_type mpegts",
          //"-start_number 1",
          "-sc_threshold 0",
          `-g ${metadata.videoFPS}`,
          "-fflags genpts+nobuffer+flush_packets",
          //"-flush_packets 1",
          "-hls_playlist_type event"
          //"-hls_flags split_by_time"
        ];
        switch (metadata.videoCodec) {
          case import_eufy_security_client.VideoCodec.H264:
            videoFormat = "h264";
            break;
          case import_eufy_security_client.VideoCodec.H265:
            videoFormat = "hevc";
            break;
        }
        switch (metadata.audioCodec) {
          case import_eufy_security_client.AudioCodec.AAC:
            audioFormat = "aac";
            break;
        }
        const command = (0, import_fluent_ffmpeg.default)().withProcessOptions({
          detached: true
        }).input(uVideoStream.url).inputFormat(videoFormat).inputFps(metadata.videoFPS);
        if (audioFormat !== "") {
          command.input(uAudioStream.url).inputFormat(audioFormat).videoCodec("copy").audioCodec("copy");
          options.push("-absf aac_adtstoasc");
        } else {
          log.warn(`ffmpegStreamToHls(): Not support audio codec or unknown audio codec (${import_eufy_security_client.AudioCodec[metadata.audioCodec]})`);
        }
        command.output(output).addOptions(options).on("error", function(err, stdout, stderr) {
          log.error(`ffmpegStreamToHls(): An error occurred: ${err.message}`);
          log.error(`ffmpegStreamToHls(): ffmpeg output:
${stdout}`);
          log.error(`ffmpegStreamToHls(): ffmpeg stderr:
${stderr}`);
          uVideoStream.close();
          uAudioStream.close();
          reject(err);
        }).on("end", () => {
          log.debug("ffmpegStreamToHls(): Processing finished!");
          uVideoStream.close();
          uAudioStream.close();
          resolve();
        });
        command.run();
      } else {
        reject(new Error("ffmpeg binary not found"));
      }
    } catch (error) {
      log.error(`ffmpegStreamToHls(): Error: ${error}`);
      reject(error);
    }
  });
};
const ffmpegStreamToGo2rtc = (config, namespace, camera, metadata, videoStream, audioStream, log) => {
  return new Promise((resolve, reject) => {
    try {
      if (import_ffmpeg_for_homebridge.default) {
        import_fluent_ffmpeg.default.setFfmpegPath(import_ffmpeg_for_homebridge.default);
        videoStream.on("error", (error) => {
          log.error("ffmpegStreamToGo2rtc(): Videostream Error", error);
        });
        audioStream.on("error", (error) => {
          log.error("ffmpegStreamToGo2rtc(): Audiostream Error", error);
        });
        const uVideoStream = StreamInput(namespace, videoStream);
        const uAudioStream = StreamInput(namespace, audioStream);
        let videoFormat = "h264";
        let audioFormat = "";
        const options = [
          "-rtsp_transport tcp",
          "-sc_threshold 0",
          "-fflags genpts+nobuffer+flush_packets"
          //"-rtpflags latm",
        ];
        switch (metadata.videoCodec) {
          case import_eufy_security_client.VideoCodec.H264:
            videoFormat = "h264";
            break;
          case import_eufy_security_client.VideoCodec.H265:
            videoFormat = "hevc";
            break;
        }
        switch (metadata.audioCodec) {
          case import_eufy_security_client.AudioCodec.AAC:
            audioFormat = "aac";
            break;
        }
        const command = (0, import_fluent_ffmpeg.default)().withProcessOptions({
          detached: true
        }).input(uVideoStream.url).inputFormat(videoFormat);
        if (metadata.videoFPS > 0) {
          options.push(`-g ${metadata.videoFPS}`);
          command.inputFps(metadata.videoFPS);
        }
        command.videoCodec("copy");
        if (audioFormat !== "") {
          command.input(uAudioStream.url).inputFormat(audioFormat).audioCodec("opus");
        } else {
          log.warn(`ffmpegStreamToGo2rtc(): Not support audio codec or unknown audio codec (${import_eufy_security_client.AudioCodec[metadata.audioCodec]})`);
        }
        command.output(`rtsp://localhost:${config.go2rtc_rtsp_port}/${camera}`).outputFormat("rtsp").addOptions(options).on("start", (commandline) => {
          log.debug(`ffmpegStreamToGo2rtc(): commandline: ${commandline}`);
        }).on("error", function(err, stdout, stderr) {
          log.error(`ffmpegStreamToGo2rtc(): An error occurred: ${err.message}`);
          log.error(`ffmpegStreamToGo2rtc(): ffmpeg output:
${stdout}`);
          log.error(`ffmpegStreamToGo2rtc(): ffmpeg stderr:
${stderr}`);
          uVideoStream.close();
          uAudioStream.close();
          reject(err);
        }).on("end", () => {
          log.debug("ffmpegStreamToGo2rtc(): Processing finished!");
          uVideoStream.close();
          uAudioStream.close();
          resolve();
        });
        command.run();
      } else {
        reject(new Error("ffmpeg binary not found"));
      }
    } catch (error) {
      log.error(`ffmpegStreamToGo2rtc(): Error: ${error}`);
      reject(error);
    }
  });
};
const streamToGo2rtc = async (camera, videoStream, audioStream, log, _config, _namespace, _metadata) => {
  const { default: got } = await import("got");
  const api = got.extend({
    hooks: {
      beforeError: [
        (error) => {
          const { response, options } = error;
          const { method, url, prefixUrl } = options;
          const shortUrl = (0, import_utils.getShortUrl)(typeof url === "string" ? new URL(url) : url === void 0 ? new URL("") : url, typeof prefixUrl === "string" ? prefixUrl : prefixUrl.toString());
          const body = (response == null ? void 0 : response.body) ? response.body : error.message;
          error.message = `${error.message} | method: ${method} url: ${shortUrl}`;
          if (response == null ? void 0 : response.body) {
            error.message = `${error.message} body: ${body}`;
          }
          return error;
        }
      ]
    }
  });
  videoStream.on("error", (error) => {
    log.error("streamToGo2rtc(): Videostream Error", error);
  });
  audioStream.on("error", (error) => {
    log.error("streamToGo2rtc(): Audiostream Error", error);
  });
  return Promise.allSettled([
    (0, import_promises.pipeline)(
      videoStream,
      api.stream.post(`http://localhost:1984/api/stream?dst=${camera}`).on("error", (error) => {
        var _a, _b;
        if (!((_b = (_a = error.response) == null ? void 0 : _a.body) == null ? void 0 : _b.startsWith("EOF"))) {
          log.error(`streamToGo2rtc(): Got Videostream Error: ${error.message}`);
        }
      }),
      new import_node_stream.default.PassThrough()
    ),
    (0, import_promises.pipeline)(
      audioStream,
      api.stream.post(`http://localhost:1984/api/stream?dst=${camera}`).on("error", (error) => {
        var _a, _b;
        if (!((_b = (_a = error.response) == null ? void 0 : _a.body) == null ? void 0 : _b.startsWith("EOF"))) {
          log.error(`streamToGo2rtc(): Got Audiostream Error: ${error.message}`);
        }
      }),
      new import_node_stream.default.PassThrough()
    )
    // Alternative implementation in case of go2rtc audio bitstream isn't working (<= 1.8.5)
    /*new Promise<void>((resolve, reject) => {
                try {
                    if (pathToFfmpeg) {
                        ffmpeg.setFfmpegPath(pathToFfmpeg);
    
                        const uAudioStream = StreamInput(namespace, audioStream);
    
                        let audioFormat = "";
                        const options: string[] = [
                            "-rtsp_transport tcp",
                            "-fflags genpts+nobuffer+flush_packets",
                            //"-rtpflags latm",
                            //"-compression_level 5",
                            "-application lowdelay",
                        ];
    
                        switch(metadata.audioCodec) {
                            case AudioCodec.AAC:
                                audioFormat = "aac";
                                break;
                        }
    
                        const command = ffmpeg()
                            .withProcessOptions({
                                detached: true
                            });
    
                        if (audioFormat !== "") {
                            command.input(uAudioStream.url)
                                .inputFormat(audioFormat)
                                .audioCodec("opus");
                        } else {
                            log.warn(`streamToGo2rtc(): ffmpeg - Not support audio codec or unknown audio codec (${AudioCodec[metadata.audioCodec]})`);
                        }
                        command.output(`rtsp://localhost:${config.go2rtc_rtsp_port}/${camera}`)
                            .outputFormat("rtsp")
                            .addOptions(options)
                            .on("start", (commandline) => {
                                log.debug(`streamToGo2rtc(): ffmpeg - commandline: ${commandline}`);
                            })
                            .on("error", function(err, stdout, stderr) {
                                log.error(`streamToGo2rtc(): ffmpeg - An error occurred: ${err.message}`);
                                log.error(`streamToGo2rtc(): ffmpeg output:\n${stdout}`);
                                log.error(`streamToGo2rtc(): ffmpeg stderr:\n${stderr}`);
                                uAudioStream.close();
                                reject(err);
                            })
                            .on("end", (stdout, stderr) => {
                                log.debug(`streamToGo2rtc(): ffmpeg output:\n${stdout}`);
                                log.debug(`streamToGo2rtc(): ffmpeg stderr:\n${stderr}`);
                                log.debug("streamToGo2rtc(): Processing finished!");
                                uAudioStream.close();
                                resolve();
                            });
                        command.run();
                    } else {
                        reject(new Error("ffmpeg binary not found"));
                    }
                } catch (error) {
                    log.error(`streamToGo2rtc(): Audio Error: ${error}`);
                    reject(error);
                }
            })*/
  ]);
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  StreamInput,
  StreamOutput,
  ffmpegPreviewImage,
  ffmpegStreamToGo2rtc,
  ffmpegStreamToHls,
  streamToGo2rtc
});
//# sourceMappingURL=video.js.map
