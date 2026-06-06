import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setConcurrency(4);
// crisp paper background, no alpha needed for the social MP4
Config.setPixelFormat("yuv420p");
