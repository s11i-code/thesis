import { JSHandle } from "puppeteer";

export type Resolution = {
  width: number;
  height: number;
};

export type ContainerList = JSHandle<HTMLElement[]>;
