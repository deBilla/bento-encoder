export class TranscodeConfig {
  resolution: string;
  videoBitRate: string;
  audioBitRate: string;
  transcodedOutputName: string;

  constructor(config: TranscodeConfig) {
    this.resolution = config.resolution;
    this.videoBitRate = config.videoBitRate;
    this.audioBitRate = config.audioBitRate;
    this.transcodedOutputName = config.transcodedOutputName;
  }
}