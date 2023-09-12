const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const { exec } = require("child_process");

const encode = () => {
  const inputVideoFile = "input.mp4";
  const outputDirectory = "output";
  const outputDirectorydash = "outputdash";

  const resolutions = [
    { width: 1920, height: 1080 },
    { width: 1280, height: 720 },
    { width: 640, height: 360 },
  ];

  const bitrates = ["4000k", "2000k", "1000k"];
  const outputVideoFiles = [];
  const permissions = 0o777;

  if (fs.existsSync(outputDirectory)) {
    fs.rmSync(outputDirectory, { recursive: true });
  }

  fs.mkdirSync(outputDirectory);
  fs.chmodSync(outputDirectory, permissions);

  let attempts = 0;
  const pollingInterval = 1000;

  const myPromise = new Promise((resolve, reject) => {
    const pollFunction = () => {
      resolutions.forEach((resolution, resIndex) => {
        bitrates.forEach((bitrate, bitrateIndex) => {
          const outputVideoFile = `${outputDirectory}/output_${resolution.width}x${resolution.height}_${bitrate}.mp4`;

          ffmpeg(inputVideoFile)
            .videoBitrate(bitrate)
            .size(`${resolution.width}x${resolution.height}`)
            .output(outputVideoFile)
            .on("end", () => {
                console.log("arr size ", outputVideoFiles.length);
              console.log(
                `Encoding of ${resolution.width}x${resolution.height}_${bitrate} finished.`
              );
              outputVideoFiles.push(outputVideoFile);
              if (outputVideoFiles.length === resolutions.lenght * bitrates.length) {
                resolve("success");
              } else if (attempts < 100) {
                attempts++;
                setTimeout(pollFunction, pollingInterval);
              } else {
                reject("Max attempts reached, result not found.");
              }
            })
            .run();
        });
      });
    };

    // Start the initial polling.
    pollFunction();
  });

  myPromise.then((result) => {
    console.log(`${result}`);
    if (fs.existsSync(outputDirectorydash)) {
      fs.rmSync(outputDirectorydash, { recursive: true });
    }

    runDash(outputDirectorydash, resolutions);
  });
};

const runDash = (outputDirectory, resolutions) => {
  const mpdOutputFile = `${outputDirectory}/stream.mpd`;
  const fragmentedFiles = [];

  const myPromise = new Promise((resolve, reject) => {
    setTimeout(() => {
      resolutions.forEach((resolution) => {
        resolution.outputFiles.forEach((bitrateOutFile) => {
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
        });
      });

      if (
        fragmentedFiles.length ===
        resolutions.length * resolutions[0].outputFiles.length
      ) {
        resolve("success");
      } else {
        reject("failed");
      }
    }, 1000);
  });

  myPromise
    .then((result) => {
      console.log(`${result}`);
      const inputFiles = fragmentedFiles.join(" ");
      const mp4dashCommand = `mp4dash --output-dir=${outputDirectory} ${inputFiles}`;

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
