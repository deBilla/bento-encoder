# Video Encoder for streaming using Node JS, FFMPEG and Bento4 (Javascript Promise to asynchronize)

In this tutorial we are going to work on a more robust video encoding solution using bento4 and ffmpeg. Only change is last time, we did all the encoding operation using ffmpeg including video segmentation, here that part will be done using Bento4. So converting our video to different bit rate outputs will be done by ffmpeg and fragmenting the set of encoded videos and convert it to dash format will be done by bento4.

So now you might wonder what is converting to a fragmented video. Normal mp4 file and a fragmented mp4 files are not similar. A fragmented MP4 contains a series of segments which can be requested individually if your server supports byte-range requests. A MP4 file is made of a number of discrete units called atoms (or 'boxes'). So the arrangement of the atoms in a normal mp4 and a fragmented mp4 is different.

## Prerequisites

As the first step, we have to install bento4. Here we will install Bento4 in our local environment. For Mac users it's a simple command

```bash
brew install bento4
```

For other operating systems, Please go to https://www.bento4.com/downloads/ and download the zip file and add the path to bento4 bin folder to your Path.
Now As I previously mentioned we have 3 things to do

* Encode a video in to different resolutions and bitrates
* Fragment those encoded videos
* Dash convertion of those fragmented files

Let's tackle the first one first. Create a file called encoder.js and add the following lines.

```
const ffmpegStatic = require("ffmpeg-static");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");

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

const encoder = () => {
  const inputVideo = "input.mp4";
  const outputDirectory = "output_folder";

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

    Promise.all(encodingQueue)
      .then((outPutVideoFiles) => {
        console.log("All encoding tasks completed.");
      })
      .catch((errorEncoding) => console.log(errorEncoding));
  } catch (err) {
    console.error("Error during encoding:", err);
  }
};

encoder();
```

Now we have a function named encoder and it's the one running. What it basically does is creating a folder named output_folder to store encoded files and then call encoding function for different bit rates. So ffmpeg run is not giving us an instant result, it has callback method and we have to wait till it run. So to confirm all the media is encoded we use Javascript Promises. So one encoding job will be returning a promise and when all the promises are completed only we go print "All encoding tasks completed". I'm not going deep in to ffmpeg configurations as we have discussed this in the previous article.

Now the next step is to fragment these encoded videos. For that there will be a new addition to the code.
```
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

const encoder = () => {
  const inputVideo = "input.mp4";
  const outputDirectory = "output_folder";
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

    Promise.all(encodingQueue)
      .then((outPutVideoFiles) => {
        console.log("All encoding tasks completed.");

        if (fs.existsSync(outputDirectoryFragment)) {
          fs.rmSync(outputDirectoryFragment, { recursive: true });
        }

        fs.mkdirSync(outputDirectoryFragment);
        fs.chmodSync(outputDirectoryFragment, permissions);

        const fragmentingQueue = [];

        for (const bitrateFile of outPutVideoFiles) {
          fragmentingQueue.push(fragmentVideo(bitrateFile, outputDirectoryFragment));
        }

        Promise.all(fragmentingQueue)
          .then((fragmentedFiles) => {
            console.log("All fragmenting tasks completed.");
          })
          .catch((errorFragmenting) => console.log(errorFragmenting));
      })
      .catch((errorEncoding) => console.log(errorEncoding));
  } catch (err) {
    console.error("Error during encoding:", err);
  }
};

encoder();
```

We directly execute commands inside the program for this and we are using "exec" for that. Now after all the videos are encoded, we create a folder called output_fragment to store fragmented files and give permissions. Next same as encoding using a Promise I'm checking whether all the fragmenting jobs are completed. This is the simple task done by fragmenting command.

```
mp4fragment INPUT_VIDEO OUTPUT_VIDEO
```

Next step is to Dash encode the fragmented videos. This is simple we just have to call the following command

```
mp4dash --output-dir=OUTPUT_FOLDER FRAGMENTED_VIDEO1 FRAGMENTED_VIDEO2 ..
```

So the code will change like this.

```
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

const encoder = () => {
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

    Promise.all(encodingQueue)
      .then((outPutVideoFiles) => {
        console.log("All encoding tasks completed.");

        if (fs.existsSync(outputDirectoryFragment)) {
          fs.rmSync(outputDirectoryFragment, { recursive: true });
        }

        fs.mkdirSync(outputDirectoryFragment);
        fs.chmodSync(outputDirectoryFragment, permissions);

        const fragmentingQueue = [];

        for (const bitrateFile of outPutVideoFiles) {
          fragmentingQueue.push(fragmentVideo(bitrateFile, outputDirectoryFragment));
        }

        Promise.all(fragmentingQueue)
          .then((fragmentedFiles) => {
            console.log("All fragmenting tasks completed.");

            if (fs.existsSync(outputDirectoryDash)) {
              fs.rmSync(outputDirectoryDash, { recursive: true });
            }

            dashEncodeVideo(fragmentedFiles, outputDirectoryDash)
              .then((dashManifest) => {
                console.log("Encoding successfully completed");
                console.log(dashManifest);
              })
              .catch((error) => console.log(error));
          })
          .catch((errorFragmenting) => console.log(errorFragmenting));
      })
      .catch((errorEncoding) => console.log(errorEncoding));
  } catch (err) {
    console.error("Error during encoding:", err);
  }
};

encoder();
```

Now if you run this code you will get the final manifest mpd files as a console log output. And if you refer the previous tutorial, there I created a index.html file and a server.js file to render this video. Using that you can view the dash format video in here as well.

Github code: https://github.com/deBilla/bento-encoder

So this is the end of this tutorial and I hope you all enjoyed this. If you have any question related to this comment here. Happy Coding Guys !!! :P
