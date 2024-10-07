import fs from "fs";
import { exec } from "child_process";
import { FOLDER_PERMISSION } from "../common/constants";

export class MediaPackager {
  dashOutputPath: string
  hlsOutputPath: string;
  fragmentedFiles: string[];
  drmEnabled: boolean;

  constructor(fragmentedFiles: string[], dashOutputPath: string, hlsOutputPath: string, drmEnabled: boolean) {
    this.dashOutputPath = dashOutputPath;
    this.hlsOutputPath = hlsOutputPath;
    this.fragmentedFiles = fragmentedFiles;
    this.drmEnabled = drmEnabled;
  }

  private getDashPackageCommand(): string {
    if (this.drmEnabled) {
      return `mp4dash --widevine-header ${process.env.CPIX_HEADER} --encryption-key=${process.env.KEY_ID}:${process.env.KEY} --output-dir=${this.dashOutputPath}`;
    } else {
      return `mp4dash --output-dir=${this.dashOutputPath}`
    }
  }

  private async packageDash(): Promise<string> {
    return new Promise((resolve, reject) => {
      const mpdOutputFile = `${this.dashOutputPath}/stream.mpd`;
      let mp4dashCommand = this.getDashPackageCommand();
  
      for (const fragmentedFile of this.fragmentedFiles) {
        mp4dashCommand = mp4dashCommand + ` ${fragmentedFile}`;
      }
  
      exec(mp4dashCommand, (error, stdout, stderr) => {
        if (error) {
          console.error(`Error running mp4dash: ${error.message}`);
          reject(stderr);
        }
  
        const mpdContent = fs.readFileSync(mpdOutputFile, "utf8");
        const dashManifest = `<?xml version="1.0" encoding="utf-8"?>
        <MPD xmlns="urn:mpeg:dash:schema:mpd:2011" minBufferTime="PT1.500S" profiles="urn:mpeg:dash:profile:isoff-live:2011" type="dynamic" mediaPresentationDuration="PT0H3M17.13S" maxSegmentDuration="PT0H0M4.800S">
          ${mpdContent}
        </MPD>`;
  
        const dashManifestFile = `${this.dashOutputPath}/manifest.mpd`;
        fs.writeFileSync(dashManifestFile, dashManifest);
        resolve(dashManifest);
      });
    });
  }


  public async packageMedia(): Promise<string> {
    if (fs.existsSync(this.dashOutputPath)) {
      fs.rmSync(this.dashOutputPath, { recursive: true });
    }

    fs.mkdirSync(this.dashOutputPath);
    fs.chmodSync(this.dashOutputPath, FOLDER_PERMISSION);

    const dashManifest = await this.packageDash();
    console.log("Packaging successfully completed");

    return dashManifest;
  }
}