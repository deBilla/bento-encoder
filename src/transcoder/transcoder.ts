import ffmpegStatic from "ffmpeg-static";
import ffmpeg from "fluent-ffmpeg";
import dotenv from 'dotenv';
import { TranscodeConfig } from "../entities/transcode-config";
import fs from "fs";
import { exec } from "child_process";
import { FOLDER_PERMISSION } from "../common/constants";

dotenv.config();

ffmpeg.setFfmpegPath(ffmpegStatic as string);

export class Transcoder {
  configList: TranscodeConfig[];
  inputMedia: string;
  fragmentedOutputPath: string;
  transcodedOutputPath: string;


  constructor(inputMedia: string, transcodedOutputPath: string, fragmentedOutputPath: string, configList: TranscodeConfig[]) {
    this.configList = configList;
    this.inputMedia = inputMedia;
    this.fragmentedOutputPath = fragmentedOutputPath;
    this.transcodedOutputPath = transcodedOutputPath;
  }

  private transcode(config: TranscodeConfig): Promise<string> {
    return new Promise((resolve, reject) => {
      ffmpeg(this.inputMedia)
        .videoCodec("libx264")
        .audioCodec("aac")
        .videoBitrate(config.videoBitRate)
        .audioBitrate(config.audioBitRate)
        .size(config.resolution)
        .output(`${this.transcodedOutputPath}/${config.transcodedOutputName}`)
        .on("end", () => {
          console.log(`Finished encoding ${config.transcodedOutputName}`);
          resolve(`${this.transcodedOutputPath}/${config.transcodedOutputName}`);
        })
        .on("error", (err) => {
          console.error(`Error encoding ${config.transcodedOutputName}: ${err}`);
          reject(err);
        })
        .run();
    });
  }

  private fragment(transcodeMedia: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const strArr = transcodeMedia.split("/");
      const fragmentedVideoFile = `${this.fragmentedOutputPath}/fragmented_${strArr[1]}`;
      const mp4fragmentCommand = `mp4fragment ${this.fragmentedOutputPath} ${fragmentedVideoFile}`;
      exec(mp4fragmentCommand, (error, stdout, stderr) => {
        if (error) {
          console.error(`Error running mp4fragment: ${error.message}`);
          reject(stderr);
        }
        console.log(stdout);
        resolve(fragmentedVideoFile);
      });
    });
  }

  public async transcodeMedia(): Promise<string[]> {
    const encodingQueue: Promise<string>[] = [];

    for (const config of this.configList) {
      encodingQueue.push(this.transcode(config));
    }

    const transcodedFiles = await Promise.all(encodingQueue);
    console.log("All encoding tasks completed.");

    if (fs.existsSync(this.fragmentedOutputPath)) {
      fs.rmSync(this.fragmentedOutputPath, { recursive: true });
    }

    fs.mkdirSync(this.fragmentedOutputPath);
    fs.chmodSync(this.fragmentedOutputPath, FOLDER_PERMISSION);

    const fragmentingQueue: Promise<string>[] = [];

    for (const transcodedMedia of transcodedFiles) {
      fragmentingQueue.push(this.fragment(transcodedMedia));
    }

    const fragmentedFiles = await Promise.all(fragmentingQueue);
    console.log("All fragmenting tasks completed.");

    return fragmentedFiles;
  }
}