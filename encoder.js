const ffmpegStatic = require("ffmpeg-static");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const { exec } = require("child_process");

ffmpeg.setFfmpegPath(ffmpegStatic);

const bitrates = [
  {
    resolution: "1280x720",
    videoBitrate: "1500k",
    audioBitrate: "128k",
    outputName: "output_720p.mp4",
  },
  {
    resolution: "854x480",
    videoBitrate: "500k",
    audioBitrate: "96k",
    outputName: "output_480p.mp4",
  },
  {
    resolution: "640x360",
    videoBitrate: "250k",
    audioBitrate: "64k",
    outputName: "output_360p.mp4",
  },
];

const encodeVideo = (inputVideo, outputFolder, config) => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputVideo)
      .videoCodec("libx264")
      .audioCodec("aac")
      .videoBitrate(config.videoBitrate)
      .audioBitrate(config.audioBitrate)
      .size(config.resolution)
      .output(`${outputFolder}/${config.outputName}`)
      .on("end", () => {
        console.log(`Finished encoding ${config.outputName}`);
        resolve(`${outputFolder}/${config.outputName}`);
      })
      .on("error", (err) => {
        console.error(`Error encoding ${config.outputName}: ${err}`);
        reject(err);
      })
      .run();
  });
};

const fragmentVideo = (inputVideo, outputFolder) => {
  return new Promise((resolve, reject) => {
    const strArr = inputVideo.split("/");
    const fragmentedVideoFile = `${outputFolder}/fragmented_${strArr[1]}`;
    const mp4fragmentCommand = `mp4fragment ${inputVideo} ${fragmentedVideoFile}`;
    exec(mp4fragmentCommand, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error running mp4fragment: ${error.message}`);
        reject(stderr);
      }
      console.log(stdout);
      resolve(fragmentedVideoFile);
    });
  });
};

const dashEncodeVideo = (fragmentedFiles, outputDirectory) => {
  return new Promise((resolve, reject) => {
    const mpdOutputFile = `${outputDirectory}/stream.mpd`;
    let mp4dashCommand = `mp4dash --output-dir=${outputDirectory}`;

    for (const fragmentedFile of fragmentedFiles) {
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

      const dashManifestFile = `${outputDirectory}/manifest.mpd`;
      fs.writeFileSync(dashManifestFile, dashManifest);
      resolve(dashManifest);
    });
  });
};

const encoder = async () => {
  const inputVideo = "input.mp4";
  const outputDirectory = "output_folder";
  const outputDirectoryDash = "output_dash";
  const outputDirectoryFragment = "output_fragment";

  const permissions = 0o777;

  try {
    if (fs.existsSync(outputDirectory)) {
      fs.rmSync(outputDirectory, { recursive: true });
    }

    fs.mkdirSync(outputDirectory);
    fs.chmodSync(outputDirectory, permissions);

    const encodingQueue = [];

    for (const config of bitrates) {
      encodingQueue.push(encodeVideo(inputVideo, outputDirectory, config));
    }

    const outPutVideoFiles = await Promise.all(encodingQueue);
    console.log("All encoding tasks completed.");
    if (fs.existsSync(outputDirectoryFragment)) {
      fs.rmSync(outputDirectoryFragment, { recursive: true });
    }

    fs.mkdirSync(outputDirectoryFragment);
    fs.chmodSync(outputDirectoryFragment, permissions);

    const fragmentingQueue = [];

    for (const bitrateFile of outPutVideoFiles) {
      fragmentingQueue.push(
        fragmentVideo(bitrateFile, outputDirectoryFragment)
      );
    }

    const fragmentedFiles = await Promise.all(fragmentingQueue);
    console.log("All fragmenting tasks completed.");

    if (fs.existsSync(outputDirectoryDash)) {
      fs.rmSync(outputDirectoryDash, { recursive: true });
    }
    const dashManifest = await dashEncodeVideo(
      fragmentedFiles,
      outputDirectoryDash
    );
    console.log("Encoding successfully completed");
    console.log(dashManifest);
  } catch (err) {
    console.error("Error during encoding:", err);
  }
};

encoder();
