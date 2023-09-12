const ffmpegStatic = require('ffmpeg-static');
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const { exec } = require("child_process");

ffmpeg.setFfmpegPath(ffmpegStatic);

const encode = () => {
  const inputVideoFile = "input.mp4";
  const outputDirectory = "output";
  const outputDirectorydash = "outputdash";

  const bitrates = ["1000k", "500k", "250k"];
  const outputVideoFiles = [];
  const permissions = 0o777;

  if (fs.existsSync(outputDirectory)) {
    fs.rmSync(outputDirectory, { recursive: true });
  }

  fs.mkdirSync(outputDirectory);
  fs.chmodSync(outputDirectory, permissions);
  const myPromise = new Promise((resolve, reject) => {
    setTimeout(() => {
      bitrates.forEach((bitrate, index) => {
        const outputVideoFile = `${outputDirectory}/output_${bitrate}.mp4`;

        ffmpeg(inputVideoFile)
          .videoBitrate(bitrate)
          .output(outputVideoFile)
          .on("end", () => {
            console.log(`Encoding of ${bitrate} finished.`);
            outputVideoFiles.push(outputVideoFile);

            if (index === bitrates.length - 1) {
                console.log('okkkkk');
              resolve("success");
            } else {
              reject("failed");
            }
          })
          .run();
      });
    }, 1000);
  });

  myPromise.then((result) => {
    console.log(`${result}`);
    if (fs.existsSync(outputDirectorydash)) {
      fs.rmSync(outputDirectorydash, { recursive: true });
    }

    runDash(outputDirectorydash, outputVideoFiles);
  });
};

const runDash = (outputDirectory, outputVideoFiles) => {
  const mpdOutputFile = `${outputDirectory}/stream.mpd`;
  const fragmentedFiles = [];

  const myPromise = new Promise((resolve, reject) => {
    setTimeout(() => {
      for (const bitrateOutFile of outputVideoFiles) {
        const strArr = bitrateOutFile.split("/");
        console.log(bitrateOutFile);
        const fragmentedVideoFile = `fragmented_${strArr[1]}`;
        const mp4fragmentCommand = `mp4fragment ${bitrateOutFile} ${fragmentedVideoFile}`;
        exec(mp4fragmentCommand, (error, stdout, stderr) => {
          if (error) {
            console.error(`Error running mp4fragment: ${error.message}`);
            return;
          }
        });
        fragmentedFiles.push(fragmentedVideoFile);
      }

      if (fragmentedFiles.length === outputVideoFiles.length) {
        resolve("success");
      } else {
        reject("failed");
      }
    }, 1000);
  });

  myPromise
    .then((result) => {
      console.log(`${result}`);
      const mp4dashCommand = `mp4dash --output-dir=${outputDirectory} ${fragmentedFiles[0]} ${fragmentedFiles[1]} ${fragmentedFiles[2]}`;

      exec(mp4dashCommand, (error, stdout, stderr) => {
        console.log(`1`);

        if (error) {
          console.error(`Error running mp4dash: ${error.message}`);
          return;
        }

        console.log(`2`);
        const mpdContent = fs.readFileSync(mpdOutputFile, "utf8");
        const dashManifest = `<?xml version="1.0" encoding="utf-8"?>
        <MPD xmlns="urn:mpeg:dash:schema:mpd:2011" minBufferTime="PT1.500S" profiles="urn:mpeg:dash:profile:isoff-live:2011" type="dynamic" mediaPresentationDuration="PT0H3M17.13S" maxSegmentDuration="PT0H0M4.800S">
          ${mpdContent}
        </MPD>`;

        const dashManifestFile = `${outputDirectory}/manifest.mpd`;
        fs.writeFileSync(dashManifestFile, dashManifest);
      });
    })
    .catch((error) => {
      console.error(`Error: ${error}`);
    });
};

encode();
