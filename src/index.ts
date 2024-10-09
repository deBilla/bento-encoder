import { TranscodeConfig } from "./entities/transcode-config";
import { MediaPackager } from "./packager/media-packager";
import { Transcoder } from "./transcoder/transcoder";

const main = async (): Promise<string> => {
  const inputVideo = "input.mp4";
  const outputDirectory = "output_folder";
  const outputDirectoryDash = "output_dash";
  const outputDirectoryFragment = "output_fragment";

  const bitrates: TranscodeConfig[] = [
    {
      resolution: "1280x720",
      videoBitRate: "1500k",
      audioBitRate: "128k",
      transcodedOutputName: "output_720p.mp4",
    },
    {
      resolution: "854x480",
      videoBitRate: "500k",
      audioBitRate: "96k",
      transcodedOutputName: "output_480p.mp4",
    },
    {
      resolution: "640x360",
      videoBitRate: "250k",
      audioBitRate: "64k",
      transcodedOutputName: "output_360p.mp4",
    },
  ];

  const transcoder = new Transcoder(inputVideo, outputDirectory, outputDirectoryFragment, bitrates);
  const fragmentedFiles = await transcoder.transcodeMedia();

  const packager = new MediaPackager(fragmentedFiles, outputDirectoryDash, '', false);
  const response = await packager.packageMedia();
  return response;
}

main().catch(err => console.error(err)).then((response) => console.log('Successfully Completed !!!', response));